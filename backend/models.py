
from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Analysis(db.Model):
    __tablename__ = "analyses"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.Text, nullable=False)
    language = db.Column(db.String(20), nullable=False)
    smells_detected = db.Column(db.Integer, default=0)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    bug_reports = db.relationship(
        "BugReport",
        backref="analysis",
        cascade="all, delete-orphan"
    )


class BugReport(db.Model):
    __tablename__ = "bug_reports"

    id = db.Column(db.Integer, primary_key=True)
    analysis_id = db.Column(
        db.Integer,
        db.ForeignKey("analyses.id"),
        nullable=False
    )

    ticket = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), default="medium")
    lines = db.Column(db.JSON, nullable=False, default=list)
    classification = db.Column(db.String(32), nullable=False, default="possible_risk")
    evidence = db.Column(db.Text, nullable=False, default="")

    # FutureBug prediction fields
    future_scenario = db.Column(db.Text, nullable=True)
    impact = db.Column(db.Text, nullable=True)
    recommendation = db.Column(db.Text, nullable=True)
    suggested_fix = db.Column(db.Text, nullable=True)
