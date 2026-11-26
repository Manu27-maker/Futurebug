# FutureBug

GitHub: `Futurebug`

**See Tomorrow's Bug Report Today.**

A full-stack prototype for pre-emptive code analysis: paste a supported source
file, watch an analysis state, then review predicted bug
reports with the offending source lines highlighted and linked to tickets.

The frontend is a React SPA (Vite) with light/dark theming. The backend is a
Flask API that runs AST- and Tree-sitter-backed analysis and turns possible
maintainability risks into ticket-style reports, separately from diagnostics.

## Run it

### Windows: two double-clicks

- `setup.bat` — checks Python 3.11+ and Node, creates `backend/.venv`, installs
  `backend/requirements.txt` and the npm packages. Run once per machine.
- `run.bat` — starts the backend (port 5000) and the frontend (port 5173) in
  their own windows, waits until both answer, then opens the app in the
  browser. Close the two “FutureBug” windows to stop it.

Both ports can be overridden without editing the file:

```bat
set BACKEND_PORT=5001 && set FRONTEND_PORT=5190 && run.bat
```

`run.bat` refuses to start if the backend port is already taken, and moves the
frontend to the next free port if 5173 is busy. It also exports
`VITE_API_BASE_URL` so the frontend talks to whichever backend port was chosen.

### Frontend (React + Vite)

```bash
npm install
npm run dev
```

Open the URL Vite prints (defaults to http://localhost:5173).

```bash
npm run build     # production build
npm run preview   # serve the production build
npm run lint      # oxlint
```

### Backend (Flask)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py --port 5000      # --port or the PORT env var; default 5000
```

### Optional Groq report generation

Static analysis always runs locally first. When `GROQ_API_KEY` is set, the
backend sends the submitted source and detected findings to Groq to generate
the explanatory report text. If the key is unset or the provider request fails,
the existing local templates are used instead. Keep the key out of source
control; `.env` files are ignored by Git. Set the variable in the environment
before starting `run.bat` or the backend:

```powershell
$env:GROQ_API_KEY = 'your-groq-api-key'
./run.bat
```

The default model is `llama-3.3-70b-versatile`; set `GROQ_MODEL` to override it.
Analysis requests may include proprietary code, so enable Groq only for code
you are permitted to send to that external provider.

The backend listens on http://127.0.0.1:5000, stores each analysis in
`backend/futurebug.db` (SQLite, created on first start) and exposes:

- `GET /health` — health check
- `POST /analyze` — body: `{ "code": "...", "language": "python" | "javascript" | "java" | "typescript" | "c" | "cpp" | "go" | "rust" | "php" | "ruby" | "dart", "filename": "optional source filename" }`
  (`filename` only labels the reports)
  returns `{ "results": [ { ticket, title, description, severity, lines, classification, evidence, future_scenario, impact, recommendation, suggested_fix } ], "diagnostics": [...], "smells_detected": N }`;
  ticket numbers are assigned from the database row
- `GET /history` — stored analyses, newest first
- `GET /history/<id>` — one analysis with its code and bug reports
- `DELETE /history/<id>` — delete an analysis and its bug reports

Python submissions are parsed with Python's built-in `ast` module. JavaScript
and JSX syntax are checked with Tree-sitter's JavaScript grammar, so React
elements such as `<App />` are accepted without treating the file as plain
ECMAScript. JavaScript smell checks remain conservative text-based signals.

JavaScript, Java, TypeScript, C, C++, Go, Rust, PHP, Ruby, and Dart use
Tree-sitter grammar parsers for syntax validation and/or structural
function/condition analysis. The package downloads each
grammar on first use and caches it; initial use of a language needs internet
access, while later parsing uses the local cache. Source code is parsed locally
and is not sent to Tree-sitter. A parser diagnostic means the grammar reported
an unexpected/missing syntax node; it is not a compiler, type-checker, or proof
that a program fails at runtime. Structural/style findings are labelled
**Possible risk** because maintainability patterns do not prove a bug. Python
uses `ast`; JavaScript keeps its conservative text-based smell checks.
Groq may enrich narrative text but cannot change classification or evidence.
When findings exist and `GROQ_API_KEY` is configured, the same optional Groq
request can propose a complete improved file for sources up to 16 KB. The
proposal is syntax-checked, shown beside the original with a change summary,
and is never applied automatically. **Use in preview only** changes only the
results preview. **Replace current source** returns to the input screen and
updates the selected pasted snippet or queued-file copy held in FutureBug,
ready for another analysis; it never overwrites the original file on disk. Use
**Export improved code** to download a separate `.improved` copy. Larger files,
missing credentials, rejected syntax, or provider errors leave the source
untouched and show the reason no full-file proposal is available.

Parser references: [Tree-sitter language pack](https://github.com/xberg-io/tree-sitter-language-pack),
[Python package API](https://docs.tree-sitter-language-pack.xberg.io/reference/api-python/),
[PyPI release/runtime requirements](https://pypi.org/project/tree-sitter-language-pack/).

The frontend points at `http://127.0.0.1:5000` by default
(`VITE_API_BASE_URL` overrides it). If the backend is unreachable, each file
shows a clear connection error rather than fabricated analysis results.

## Screens

1. **Input** — drop or select multiple source files or a folder, view/remove the queue, or
   paste a snippet. File types are identified by extension; pasted code gets a
   best-effort syntax-based language guess, with the picker as a fallback.
   Files are analyzed separately, with per-file errors. Batches are capped at
   20 files and 2 MB total (200 KB per file).
2. **Loading** — live progress (e.g. “Analyzing 3 of 8”) and a cancel control.
   Cancellation stops the active request and all subsequent requests; partial
   results identify the interrupted and unstarted files.
3. **Results** — syntax-highlighted source with line numbers, red/amber line
   highlighting tied to possible-risk tickets, parser diagnostics separately
   identified, bug report cards with evidence and
   a suggested replacement snippet, plus a full-file improvement proposal
   with a summary, original/proposed code preview, explicit use-or-keep choice,
   and separate code export when available; per-file result tabs, actionable errors,
   and actions to copy or export the complete Markdown report.

`Add files` accepts `.py`, `.pyw`, `.js`, `.mjs`, `.cjs`, `.jsx`, `.java`,
`.ts`, `.tsx`, `.c`, `.h`, `.cc`, `.cpp`, `.cxx`, `.hpp`, `.hxx`, `.go`, `.rs`,
`.php`, `.rb`, and `.dart`, up to 200 KB per file; a batch may contain at most
20 supported source files and 2 MB total. Folder uploads filter to these
extensions and preserve relative paths. Files are read locally and leave the
browser only when you start analysis.

## Themes

A sun/moon switch in the header flips the entire interface between the dark
developer-tool palette and a light counterpart. The choice is stored in
`localStorage` under `futurebug-theme`, applied before first paint by a small
inline script in `index.html` (so there is no flash of the wrong theme), and
also drives which syntax-highlighter theme is used (`vsc-dark-plus` or
`one-light`). Both themes share one green accent and the same red/amber
semantics.

## Backend smell detection

The analyzer detects:

- **Long function** — functions over a line threshold (Python AST, Tree-sitter structure, or conservative JS checks)
- **Duplicate logic** — repeated non-trivial lines (Python/JavaScript only)
- **Bare except / empty catch** — error handlers that swallow everything
- **Unused import** — imports never referenced in the file (Python AST)
- **Complex conditional** — conditionals with many branches

Maintainability/style signals are **possible risks**, not confirmed bugs.
Parser syntax observations appear separately as **parser diagnostics** and are
not compiler/type-check/runtime guarantees. Each risk becomes a report with a
ticket number, evidence, related lines, and a suggested snippet where available
(templates live in `backend/prompts/smell_to_scenario.json`).

## Files

### Frontend

| File                              | Purpose                                                    |
| --------------------------------- | ---------------------------------------------------------- |
| `src/App.jsx`                     | Screen state, theme, API call, header/footer               |
| `src/components/InputScreen.jsx`  | Language picker, editor, validation, sample loader         |
| `src/components/LoadingScreen.jsx`| Spinner, per-file progress, cancellation                    |
| `src/components/ResultsScreen.jsx`| Syntax-highlighted code, line highlighting, stats, copy    |
| `src/components/BugReportCard.jsx`| Reusable ticket card (ticket, title, description, lines)   |
| `src/components/icons.jsx`        | Inline SVG icons                                           |
| `src/mockData.js`                 | Mock results, languages, samples, theme helpers            |
| `src/App.css`                     | Component and layout styles                                |
| `src/index.css`                   | Design tokens, font setup, light/dark theme variables      |
| `index.html`                      | Fonts, metadata, theme pre-apply script                    |
| `vite.config.js`                  | Vite config, dependency pre-bundling                       |

### Backend

| File                                 | Purpose                                        |
| ------------------------------------ | ---------------------------------------------- |
| `backend/app.py`                     | Flask server, `/health`, `/analyze`, `/history` |
| `backend/models.py`                  | SQLAlchemy `Analysis` / `BugReport` models      |
| `backend/js_validator.cjs`           | Node ES-module syntax check for JavaScript      |
| `backend/analyzer/smell_rules.py`    | Smell rule definitions and thresholds          |
| `backend/analyzer/smell_detector.py` | AST + heuristic smell detection                |
| `backend/generator/bug_report_generator.py` | Converts smells into bug-report dicts    |
| `backend/prompts/smell_to_scenario.json` | Smell → scenario templates              |
| `backend/requirements.txt`           | Flask, flask-cors, flask-sqlalchemy            |

## Accessibility notes

- Every control has a visible label; the editor is a real `<label>`-bound textarea.
- The loading state uses `role="status"` + `aria-live="polite"` and `aria-busy`.
- Focus moves to the results heading on transition and the editor on reset.
- `prefers-reduced-motion` disables the spinner, progress fill and screen fade.
- Red/amber are never the only signal: each highlighted line is described by a
  ticket card and the code legend.
