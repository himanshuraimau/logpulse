import time
from datetime import datetime
from threading import Lock
from typing import Any

from app.batch.jobs import run_service_aggregate_job
from app.core.config import settings
from app.storage.db import SessionLocal
from app.storage.models import BatchRun

_state_lock = Lock()
_last_batch_summary: dict[str, Any] = {
    "status": "idle",
    "engine": "none",
    "message": "Batch worker has not executed yet.",
}


def _parse_iso_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def run_batch_once(
    window_events: int | None = None,
    use_pyspark: bool | None = None,
) -> dict[str, Any]:
    summary = run_service_aggregate_job(
        window_events=window_events or settings.batch_window_events,
        use_pyspark=settings.batch_use_pyspark if use_pyspark is None else use_pyspark,
    )

    db = SessionLocal()
    try:
        batch_run = BatchRun(
            run_id=str(summary.get("run_id", "")),
            status=str(summary.get("status", "unknown")),
            engine=str(summary.get("engine", "unknown")),
            started_at=_parse_iso_datetime(summary.get("started_at")),
            completed_at=_parse_iso_datetime(summary.get("completed_at")),
            summary=summary,
        )
        db.add(batch_run)
        db.commit()
    except Exception as exc:  # pragma: no cover - defensive runtime path
        db.rollback()
        summary["persistence_error"] = str(exc)
    finally:
        db.close()

    with _state_lock:
        _last_batch_summary.clear()
        _last_batch_summary.update(summary)

    return summary


def get_batch_status() -> dict[str, Any]:
    with _state_lock:
        snapshot = dict(_last_batch_summary)

    snapshot["configured_interval_seconds"] = settings.batch_interval_seconds
    snapshot["configured_window_events"] = settings.batch_window_events
    snapshot["configured_use_pyspark"] = settings.batch_use_pyspark
    return snapshot


def get_batch_history(limit: int = 20) -> list[dict[str, Any]]:
    db = SessionLocal()
    try:
        records = (
            db.query(BatchRun)
            .order_by(BatchRun.created_at.desc())
            .limit(limit)
            .all()
        )
        return [record.summary for record in records]
    finally:
        db.close()


def run_batch_loop(interval_seconds: int | None = None) -> None:
    interval = interval_seconds or settings.batch_interval_seconds
    print(f"[batch] Starting batch loop interval={interval}s")

    try:
        while True:
            summary = run_batch_once()
            print(f"[batch] {summary}")
            time.sleep(interval)
    except KeyboardInterrupt:
        print("[batch] Stopped.")
