"""
FutureBug — smell rule definitions.

Each rule describes a class of code smell the analyzer can detect, the
severity, and a human-readable scenario template used when generating bug
reports. Rules are language-agnostic where possible; language-specific
detection logic lives in smell_detector.py.
"""

SMELL_RULES = {
    "long_function": {
        "name": "Long function",
        "severity": "medium",
        "ticket_template": "Bug #{ticket_id}",
        "title_template": "{function_name} is too long ({line_count} lines)",
        "description_template": (
            "{function_name} handles {responsibility_count} responsibilities — "
            "this edge case was missed."
        ),
        "threshold_lines": 12,
    },
    "duplicate_logic": {
        "name": "Duplicate logic",
        "severity": "high",
        "ticket_template": "Bug #{ticket_id}",
        "title_template": "Duplicate validation logic causes inconsistent error messages",
        "description_template": (
            "The same validation was copy-pasted in {count} places and "
            "diverged over time."
        ),
    },
    "complex_condition": {
        "name": "Complex conditional",
        "severity": "medium",
        "ticket_template": "Bug #{ticket_id}",
        "title_template": "Overly complex conditional in {function_name}",
        "description_template": (
            "The conditional at line {line} has {condition_count} branches — "
            "consider extracting into a guard clause or helper."
        ),
        "threshold_conditions": 3,
    },
    "bare_except": {
        "name": "Bare except clause",
        "severity": "low",
        "ticket_template": "Bug #{ticket_id}",
        "title_template": "Bare except swallows errors in {function_name}",
        "description_template": (
            "A bare `except:` at line {line} catches all exceptions, hiding "
            "bugs and making debugging harder."
        ),
    },
    "unused_import": {
        "name": "Unused import",
        "severity": "low",
        "ticket_template": "Bug #{ticket_id}",
        "title_template": "Unused import '{module}' in {file}",
        "description_template": (
            "The import '{module}' is never used and should be removed."
        ),
    },
}

# Map smell type → scenario template key for the LLM/report generator.
SMELL_TO_SCENARIO = {
    "long_function": "long_function",
    "duplicate_logic": "duplicate_logic",
    "complex_condition": "complex_condition",
    "bare_except": "bare_except",
    "unused_import": "unused_import",
}
