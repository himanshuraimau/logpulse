from datetime import UTC, datetime
from threading import Event, Lock, Thread
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from app.agent.orchestrator import run_rca_analysis
from app.core.config import settings
from app.storage.db import SessionLocal, init_db
from app.storage.models import RCAReport

_worker_stop = Event()
_worker_lock = Lock()
_worker_thread: Thread | None = None


def _to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(UTC).isoformat()


def serialize_report(report: RCAReport) -> dict[str, Any]:
    return {
        "report_id": report.report_id,
        "event_id": report.event_id,
        "status": report.status,
        "context_limit": report.context_limit,
        "provider": report.provider,
        "model": report.model,
        "fallback_used": bool(report.fallback_used),
        "summary": report.summary,
        "root_cause": report.root_cause,
        "impact": report.impact,
        "confidence": report.confidence,
        "recommendations": report.recommendations or [],
        "evidence": report.evidence or [],
        "timeline": report.timeline or [],
        "tool_trace": report.tool_trace or [],
        "error_message": report.error_message,
        "started_at": _to_iso(report.started_at),
        "completed_at": _to_iso(report.completed_at),
        "created_at": _to_iso(report.created_at),
    }


def create_report_request(
    db: Session,
    event_id: str,
    context_limit: int,
) -> RCAReport:
    bounded_context_limit = max(5, min(context_limit, settings.agent_max_context_limit))

    report = RCAReport(
        report_id=str(uuid4()),
        event_id=event_id,
        status="queued",
        context_limit=bounded_context_limit,
        fallback_used=False,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def get_report_by_id(db: Session, report_id: str) -> RCAReport | None:
    return db.query(RCAReport).filter(RCAReport.report_id == report_id).first()


def list_reports(
    db: Session,
    limit: int = 20,
    status: str | None = None,
    event_id: str | None = None,
) -> list[RCAReport]:
    query = db.query(RCAReport)

    if status:
        query = query.filter(RCAReport.status == status)
    if event_id:
        query = query.filter(RCAReport.event_id == event_id)

    return query.order_by(RCAReport.created_at.desc()).limit(limit).all()


def _claim_next_report_id() -> int | None:
    db = SessionLocal()
    try:
        candidate = (
            db.query(RCAReport)
            .filter(RCAReport.status == "queued")
            .order_by(RCAReport.created_at.asc())
            .first()
        )
        if candidate is None:
            return None

        now = datetime.now(UTC)
        rows_updated = (
            db.query(RCAReport)
            .filter(RCAReport.id == candidate.id, RCAReport.status == "queued")
            .update(
                {
                    RCAReport.status: "running",
                    RCAReport.started_at: now,
                    RCAReport.error_message: None,
                },
                synchronize_session=False,
            )
        )

        if rows_updated == 0:
            db.rollback()
            return None

        db.commit()
        return int(candidate.id)
    finally:
        db.close()


def _process_report(report_pk: int) -> None:
    db = SessionLocal()
    try:
        report = db.query(RCAReport).filter(RCAReport.id == report_pk).first()
        if report is None:
            return

        try:
            analysis = run_rca_analysis(
                db=db,
                event_id=report.event_id,
                context_limit=report.context_limit,
            )

            report.status = "completed"
            report.provider = str(analysis.get("provider") or "")
            report.model = str(analysis.get("model") or "")
            report.fallback_used = bool(analysis.get("fallback_used", False))
            report.summary = str(analysis.get("summary") or "")
            report.root_cause = str(analysis.get("root_cause") or "")
            report.impact = str(analysis.get("impact") or "")
            report.confidence = float(analysis.get("confidence") or 0.0)
            report.recommendations = analysis.get("recommendations") or []
            report.evidence = analysis.get("evidence") or []
            report.timeline = analysis.get("timeline") or []
            report.tool_trace = analysis.get("tool_trace") or []
            report.raw_response = analysis.get("raw_response") or {}
            report.error_message = None
            report.completed_at = datetime.now(UTC)
            db.commit()
        except Exception as exc:
            db.rollback()
            report = db.query(RCAReport).filter(RCAReport.id == report_pk).first()
            if report is None:
                return

            report.status = "failed"
            report.error_message = str(exc)
            report.completed_at = datetime.now(UTC)
            db.commit()
    finally:
        db.close()


def _process_batch_once() -> int:
    processed = 0
    for _ in range(max(1, settings.agent_worker_batch_size)):
        report_pk = _claim_next_report_id()
        if report_pk is None:
            break
        _process_report(report_pk)
        processed += 1
    return processed


def run_agent_worker_forever() -> None:
    _worker_stop.clear()
    init_db()
    print("[agent] RCA worker started")

    try:
        while not _worker_stop.is_set():
            processed = _process_batch_once()
            if processed == 0:
                _worker_stop.wait(settings.agent_worker_poll_seconds)
    except KeyboardInterrupt:
        print("[agent] RCA worker interrupted")
    finally:
        print("[agent] RCA worker stopped")


def start_agent_worker() -> bool:
    global _worker_thread

    if not settings.agent_worker_enabled:
        return False

    with _worker_lock:
        if _worker_thread is not None and _worker_thread.is_alive():
            return False

        _worker_stop.clear()
        _worker_thread = Thread(
            target=run_agent_worker_forever,
            name="logpulse-agent-worker",
            daemon=True,
        )
        _worker_thread.start()
        return True


def stop_agent_worker(timeout_seconds: float = 5.0) -> None:
    global _worker_thread

    with _worker_lock:
        if _worker_thread is None:
            return

        _worker_stop.set()
        _worker_thread.join(timeout=timeout_seconds)
        _worker_thread = None
