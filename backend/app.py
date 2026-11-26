
"""
FutureBug — Flask backend.

Endpoints:
  GET    /health
  POST   /analyze
  GET    /history
  GET    /history/<id>
  DELETE /history/<id>
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request
from flask_cors import CORS
from sqlalchemy import inspect, text

from analyzer.smell_detector import analyze_source, validate_javascript_syntax
from analyzer.smell_rules import SMELL_RULES
from generator.bug_report_generator import generate_reports
from models import db, Analysis, BugReport


# ----------------------------------
# Flask application configuration
# ----------------------------------

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 300 * 1024

app.config["SQLALCHEMY_DATABASE_URI"] = (
    "sqlite:///" + os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "futurebug.db"
    )
)

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)


def ensure_schema_up_to_date():
    """Add columns that were introduced after a database was created."""

    inspector = inspect(db.engine)

    if "bug_reports" not in inspector.get_table_names():
        return

    columns = {
        column["name"]
        for column in inspector.get_columns("bug_reports")
    }

    if "suggested_fix" not in columns:
        with db.engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE bug_reports "
                    "ADD COLUMN suggested_fix TEXT"
                )
            )

    if "classification" not in columns:
        with db.engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE bug_reports ADD COLUMN classification "
                "VARCHAR(32) NOT NULL DEFAULT 'possible_risk'"
            ))

    if "evidence" not in columns:
        with db.engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE bug_reports ADD COLUMN evidence TEXT NOT NULL DEFAULT ''"
            ))


with app.app_context():
    db.create_all()
    ensure_schema_up_to_date()


# ----------------------------------
# Helper: Serialize bug report
# ----------------------------------

def serialize_bug_report(report):
    return {
        "ticket": report.ticket,
        "title": report.title,
        "description": report.description,
        "severity": report.severity,
        "lines": report.lines,
        "classification": report.classification,
        "evidence": report.evidence,
        "future_scenario": report.future_scenario,
        "impact": report.impact,
        "recommendation": report.recommendation,
        "suggested_fix": report.suggested_fix
    }


# ----------------------------------
# JavaScript syntax validator
# ----------------------------------

def validate_javascript(code):
    try:
        valid, message = validate_javascript_syntax(code)
        return {
            "valid": valid,
            "message": message
        }
    except Exception:
        app.logger.exception("JavaScript validation failed")
        return {
            "valid": False,
            "unavailable": True,
            "message": "JavaScript parser is unavailable or failed to parse this file."
        }


# ----------------------------------
# Health check API
# ----------------------------------

@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "futurebug"
    })


# ----------------------------------
# Get all analysis history
# ----------------------------------

@app.get("/history")
def get_history():
    analyses = Analysis.query.order_by(
        Analysis.created_at.desc()
    ).all()

    history = []

    for analysis in analyses:
        history.append({
            "id": analysis.id,
            "language": analysis.language,
            "smells_detected": analysis.smells_detected,
            "created_at": (
                analysis.created_at.isoformat()
                if analysis.created_at else None
            ),
            "bug_reports": [
                serialize_bug_report(report)
                for report in analysis.bug_reports
            ]
        })

    return jsonify({"history": history})


# ----------------------------------
# Get individual analysis
# ----------------------------------

@app.get("/history/<int:analysis_id>")
def get_analysis(analysis_id):
    analysis = db.session.get(Analysis, analysis_id)

    if analysis is None:
        return jsonify({
            "error": "Analysis not found."
        }), 404

    return jsonify({
        "id": analysis.id,
        "code": analysis.code,
        "language": analysis.language,
        "smells_detected": analysis.smells_detected,
        "created_at": (
            analysis.created_at.isoformat()
            if analysis.created_at else None
        ),
        "bug_reports": [
            serialize_bug_report(report)
            for report in analysis.bug_reports
        ]
    })


# ----------------------------------
# Delete analysis and bug reports
# ----------------------------------

@app.delete("/history/<int:analysis_id>")
def delete_analysis(analysis_id):
    analysis = db.session.get(Analysis, analysis_id)

    if analysis is None:
        return jsonify({
            "error": "Analysis not found."
        }), 404

    try:
        db.session.delete(analysis)
        db.session.commit()

        return jsonify({
            "message": "Analysis and associated bug reports deleted successfully.",
            "deleted_id": analysis_id
        })

    except Exception:
        db.session.rollback()
        app.logger.exception("Failed to delete analysis")

        return jsonify({
            "error": "Failed to delete analysis."
        }), 500


# ----------------------------------
# Main code analysis API
# ----------------------------------

@app.post("/analyze")
def analyze():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Request body must be valid JSON."
        }), 400

    code = data.get("code", "")
    language = data.get("language", "python")
    filename = data.get("filename", "")

    if not isinstance(code, str):
        return jsonify({
            "error": "Code must be a string."
        }), 400

    if not isinstance(language, str):
        return jsonify({
            "error": "Language must be a string."
        }), 400

    if not isinstance(filename, str):
        return jsonify({
            "error": "Filename must be a string."
        }), 400

    supported_languages = {
        "python", "javascript", "java", "typescript", "c", "cpp",
        "go", "rust", "php", "ruby", "dart",
    }
    if language not in supported_languages:
        return jsonify({
            "error": "Unsupported language. Choose a supported language."
        }), 400

    if not code.strip():
        return jsonify({
            "error": "code is required"
        }), 400

    if len(code.encode("utf-8")) > 200 * 1024:
        return jsonify({
            "error": "Source file exceeds the 200 KB analysis limit."
        }), 413

    # JavaScript syntax validation
    if language == "javascript":
        validation = validate_javascript(code)

        if validation.get("unavailable"):
            return jsonify({
                "error": "JavaScript parser is unavailable.",
                "message": validation.get("message", "Check the backend parser dependencies and network access for first-time grammar setup.")
            }), 503

        if not validation.get("valid"):
            return jsonify({
                "error": "Invalid JavaScript syntax.",
                "message": validation.get(
                    "message",
                    "Syntax error"
                )
            }), 400

    # Static analysis
    try:
        smells, diagnostics = analyze_source(code, language)
    except Exception:
        app.logger.exception("Static analysis failed for %s", language)
        return jsonify({
            "error": "Static analysis could not complete.",
            "message": "Check the backend dependencies and, on first use of this language, the internet connection needed to download its parser grammar."
        }), 503

    # Generate bug reports
    generated = generate_reports(
        smells,
        code,
        language,
        filename=filename or None,
        include_improvement=True
    )
    results = generated["reports"]

    # Store analysis and reports in SQLite
    try:
        analysis = Analysis(
            code=code,
            language=language,
            smells_detected=len(smells)
        )

        db.session.add(analysis)
        db.session.flush()

        for index, report in enumerate(results):

            smell = smells[index] if index < len(smells) else {}
            smell_type = smell.get("type")

            severity = (
                report.get("severity")
                or SMELL_RULES.get(
                    smell_type, {}
                ).get("severity", "medium")
            )

            bug_report = BugReport(
                analysis_id=analysis.id,
                ticket="",
                title=report.get("title", ""),
                description=report.get("description", ""),
                severity=severity,
                lines=report.get("lines", []),

                future_scenario=report.get("future_scenario"),
                impact=report.get("impact"),
                recommendation=report.get("recommendation"),
                suggested_fix=report.get("suggested_fix"),
                classification=report.get("classification", "possible_risk"),
                evidence=report.get("evidence", "")
            )

            db.session.add(bug_report)
            db.session.flush()

            # Generate a unique ticket using the database ID
            bug_report.ticket = f"Bug #{bug_report.id}"

        db.session.commit()

    except Exception:
        db.session.rollback()

        app.logger.exception(
            "Failed to save analysis to database"
        )

        return jsonify({
            "error": "Analysis completed, but saving to the database failed."
        }), 500

    # Return reports with database-generated ticket numbers
    results = [
        serialize_bug_report(report)
        for report in analysis.bug_reports
    ]

    return jsonify({
        "results": results,
        "smells_detected": len(smells),
        "diagnostics": diagnostics,
        "improved_code": generated["improved_code"],
        "improvement_summary": generated["improvement_summary"],
        "improvement_message": generated["improvement_message"]
    })


# ----------------------------------
# Run Flask server
# ----------------------------------

if __name__ == "__main__":

    import argparse

    parser = argparse.ArgumentParser(
        description="FutureBug Flask backend"
    )

    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PORT", 5000)),
        help="Port to listen on (default: PORT env or 5000)"
    )

    args = parser.parse_args()

    debug = os.environ.get("FLASK_DEBUG", "1") == "1"

    app.run(
        host="127.0.0.1",
        port=args.port,
        debug=debug
    )
