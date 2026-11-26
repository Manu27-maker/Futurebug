"""Parser-backed smell detection for FutureBug.

Python keeps its built-in AST analysis and JavaScript keeps its existing
Node syntax check and conservative pattern checks. The other supported
languages use Tree-sitter syntax trees; style/maintainability signals are
always marked as possible risks, never as proven bugs.
"""

import ast
import re
import threading
from collections import Counter
from functools import lru_cache

from .smell_rules import SMELL_RULES


_PARSE_LOCK = threading.Lock()
TREE_SITTER_LANGUAGES = {
    "java": "java", "typescript": "typescript", "c": "c",
    "cpp": "cpp", "go": "go", "rust": "rust", "php": "php",
    "ruby": "ruby", "dart": "dart",
}


def validate_javascript_syntax(source):
    """Validate JavaScript, including JSX, with the Tree-sitter grammar."""
    from tree_sitter import Parser
    from tree_sitter_language_pack import get_language

    parser = Parser(get_language("javascript"))
    with _PARSE_LOCK:
        tree = parser.parse(source.encode("utf-8"))
    if tree is None:
        return False, "JavaScript parser did not return a syntax tree."

    pending = [tree.root_node]
    while pending:
        node = pending.pop()
        if node.is_error or node.is_missing:
            line = node.start_point.row + 1
            column = node.start_point.column + 1
            return False, f"Syntax error near line {line}, column {column}."
        pending.extend(reversed(node.children))
    return True, ""


def _enclosing_function(node):
    parent = getattr(node, "_parent", None)
    while parent is not None:
        if isinstance(parent, (ast.FunctionDef, ast.AsyncFunctionDef)):
            return parent.name
        parent = getattr(parent, "_parent", None)
    return "<module>"


def _attach_parents(tree):
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            child._parent = parent


def _risk(kind, line, detail, evidence):
    return {"type": kind, "line": max(1, line), "detail": detail,
            "classification": "possible_risk", "evidence": evidence}


class _PythonSmellVisitor(ast.NodeVisitor):
    def __init__(self, source):
        self.source = source
        self.lines = source.splitlines()
        self.smells = []
        self._imports = set()
        self._used_names = set()
        self._import_details = {}

    def visit_FunctionDef(self, node):
        self._check_function_length(node)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node):
        self._check_function_length(node)
        self.generic_visit(node)

    def _check_function_length(self, node):
        start = node.lineno
        length = getattr(node, "end_lineno", start) - start + 1
        if length > SMELL_RULES["long_function"]["threshold_lines"]:
            count = sum(isinstance(child, (ast.If, ast.For, ast.While, ast.Try, ast.With, ast.Call)) for child in ast.walk(node))
            self.smells.append(_risk("long_function", start, {"function_name": node.name, "line_count": length, "responsibility_count": count}, "Function span exceeds the configured line threshold; this is a maintainability signal."))

    def visit_Try(self, node):
        for handler in node.handlers:
            if handler.type is None:
                self.smells.append(_risk("bare_except", handler.lineno, {"function_name": _enclosing_function(handler)}, "Python AST confirms a bare except clause; runtime impact depends on surrounding code."))
        self.generic_visit(node)

    def _check_condition(self, node):
        count = sum(1 for child in ast.walk(node.test) if isinstance(child, ast.BoolOp))
        leaves = sum(1 for child in ast.walk(node.test) if isinstance(child, ast.Compare))
        parts = max(1, count + leaves)
        if parts >= SMELL_RULES["complex_condition"]["threshold_conditions"]:
            self.smells.append(_risk("complex_condition", node.lineno, {"function_name": _enclosing_function(node), "condition_count": parts}, "Python AST identifies a compound condition; complexity alone does not prove a defect."))

    def visit_If(self, node):
        self._check_condition(node)
        self.generic_visit(node)

    def visit_While(self, node):
        self._check_condition(node)
        self.generic_visit(node)

    def visit_IfExp(self, node):
        self._check_condition(node)
        self.generic_visit(node)

    def visit_Import(self, node):
        for alias in node.names:
            name = alias.asname or alias.name.split(".")[0]
            self._imports.add(name)
            self._import_details[name] = {"module": alias.name, "line": node.lineno}
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        for alias in node.names:
            if alias.name == "*":
                continue
            name = alias.asname or alias.name
            self._imports.add(name)
            self._import_details[name] = {"module": alias.name, "line": node.lineno}
        self.generic_visit(node)

    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Load):
            self._used_names.add(node.id)
        self.generic_visit(node)

    def finish(self):
        for name in self._imports - self._used_names:
            info = self._import_details[name]
            self.smells.append(_risk("unused_import", info["line"], {"module": info["module"], "file": "<stdin>"}, "Name-use scan did not find a reference; dynamic use, re-exports, or framework conventions can make this intentional."))
        counts = Counter(line.strip() for line in self.lines if len(line.strip()) > 8 and not line.strip().startswith(("#", '"""', "'''", "import", "from", "@")))
        seen = set()
        for number, raw in enumerate(self.lines, 1):
            text = raw.strip()
            if counts[text] > 1 and text not in seen:
                seen.add(text)
                self.smells.append(_risk("duplicate_logic", number, {"count": counts[text]}, "Identical source lines repeat; repetition is a review signal, not proof of duplicated behavior."))
                if len(seen) == 3:
                    break


def detect_python_smells(source):
    tree = ast.parse(source)
    _attach_parents(tree)
    visitor = _PythonSmellVisitor(source)
    visitor.visit(tree)
    visitor.finish()
    return visitor.smells


_JS_FUNCTION = re.compile(r"(?:(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)\s*)?=>\s*\{|^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{)", re.MULTILINE)


def detect_javascript_smells(source):
    smells = []
    lines = source.splitlines()
    for match in _JS_FUNCTION.finditer(source):
        name = next((item for item in match.groups() if item), "anonymous")
        start = source.count("\n", 0, match.start()) + 1
        depth = 0
        end = start
        in_block = False
        for offset, char in enumerate(source[match.start():], start=match.start()):
            if char == "{":
                depth += 1
                in_block = True
            elif char == "}":
                depth -= 1
                if in_block and depth == 0:
                    end = source.count("\n", 0, offset) + 1
                    break
        length = end - start + 1
        if length > SMELL_RULES["long_function"]["threshold_lines"]:
            smells.append(_risk("long_function", start, {"function_name": name, "line_count": length, "responsibility_count": length // 5 + 1}, "Text-based function span exceeds the configured threshold; nested syntax may affect this estimate."))
    counts = Counter(line.strip() for line in lines if len(line.strip()) > 8 and not line.strip().startswith(("//", "/*", "*", "import", "export")))
    seen = set()
    for number, raw in enumerate(lines, 1):
        text = raw.strip()
        if counts[text] > 1 and text not in seen:
            seen.add(text)
            smells.append(_risk("duplicate_logic", number, {"count": counts[text]}, "Identical source lines repeat; this does not prove behavior is duplicated."))
            if len(seen) == 3:
                break
    for number, raw in enumerate(lines, 1):
        match = re.search(r"\b(?:if|while)\s*\((.*?)\)", raw)
        if match:
            parts = len(re.findall(r"&&|\|\|", match.group(1))) + 1
            if parts >= SMELL_RULES["complex_condition"]["threshold_conditions"]:
                smells.append(_risk("complex_condition", number, {"function_name": "<unknown>", "condition_count": parts}, "Text-based compound-condition estimate; macro/string contents can affect matching."))
    for match in re.finditer(r"\bcatch\s*\{", source):
        if re.match(r"\s*\}", source[match.end():]):
            line = source.count("\n", 0, match.start()) + 1
            smells.append(_risk("bare_except", line, {"function_name": "<unknown>"}, "A catch body appears empty; confirm the intended error-handling behavior."))
    return smells


def _walk(node):
    pending = [node]
    while pending:
        current = pending.pop()
        yield current
        pending.extend(reversed(current.children))


def _node_line(node):
    return node.start_point.row + 1


def _text(node, source_bytes):
    return source_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def detect_tree_sitter_smells(source, language):
    """Return structural possible risks and parser diagnostics for a source file."""
    from tree_sitter import Parser
    from tree_sitter_language_pack import get_language

    parser = Parser(get_language(TREE_SITTER_LANGUAGES[language]))
    source_bytes = source.encode("utf-8")
    with _PARSE_LOCK:
        tree = parser.parse(source_bytes)
    if tree is None:
        raise RuntimeError("Tree-sitter did not return a syntax tree.")
    root = tree.root_node
    diagnostics = []
    for node in _walk(root):
        if (node.is_error or node.is_missing) and len(diagnostics) < 25:
            diagnostics.append({
                "classification": "parser_diagnostic",
                "source": "tree-sitter",
                "message": "Parser found an unexpected or missing syntax node; this is not a compiler/type-check result.",
                "line": _node_line(node),
                "column": node.start_point.column + 1,
                "node": node.type,
            })

    function_types = {
        "java": {"method_declaration", "constructor_declaration"},
        "typescript": {"function_declaration", "method_definition", "arrow_function", "function_expression", "method_signature"},
        "c": {"function_definition"}, "cpp": {"function_definition"},
        "go": {"function_declaration", "method_declaration"},
        "rust": {"function_item"},
        "php": {"function_definition", "method_declaration"},
        "ruby": {"method", "singleton_method"},
        "dart": {"function_declaration", "method_declaration"},
    }[language]
    smells = []
    for node in _walk(root):
        if node.type in function_types:
            start = _node_line(node)
            end = node.end_point.row + (1 if node.end_point.column else 0)
            length = max(1, end - start + 1)
            if length > SMELL_RULES["long_function"]["threshold_lines"]:
                name_node = node.child_by_field_name("name")
                name = _text(name_node, source_bytes) if name_node else "<anonymous>"
                smells.append(_risk("long_function", start, {"function_name": name, "line_count": length, "responsibility_count": 0}, "Tree-sitter function node spans more than the configured line threshold; length alone does not prove a bug."))
        if node.type in {"if_statement", "if_expression", "while_statement", "conditional_expression"}:
            condition = (node.child_by_field_name("condition") or node.child_by_field_name("test") or node.child_by_field_name("predicate"))
            if condition is not None:
                parts = sum(1 for item in _walk(condition) if item.type in {"&&", "||", "and", "or", "AND", "OR"}) + 1
                if parts >= SMELL_RULES["complex_condition"]["threshold_conditions"]:
                    smells.append(_risk("complex_condition", _node_line(node), {"function_name": "<structural context>", "condition_count": parts}, "Tree-sitter condition node contains several boolean operators; review whether the branches obscure intent."))
    return smells, diagnostics


def analyze_source(source, language):
    """Return (possible-risk smells, parser-confirmed diagnostics)."""
    if language == "python":
        try:
            return detect_python_smells(source), []
        except SyntaxError as error:
            return [], [{"classification": "parser_diagnostic", "source": "python ast", "message": error.msg, "line": error.lineno or 1, "column": error.offset or 1, "node": "syntax error"}]
    if language == "javascript":
        return detect_javascript_smells(source), []
    if language in TREE_SITTER_LANGUAGES:
        return detect_tree_sitter_smells(source, language)
    return [], []


def detect_smells(source, language):
    """Backward-compatible smell-only entry point used by internal callers."""
    return analyze_source(source, language)[0]
