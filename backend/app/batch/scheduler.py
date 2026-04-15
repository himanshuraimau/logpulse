import time
from threading import Lock
from typing import Any

from app.batch.jobs import run_service_aggregate_job
from app.core.config import settings

_state_lock = Lock()
_last_batch_summary: dict[str, Any] = {
    "status": "idle",
    "engine": "none",
    "message": "Batch worker has not executed yet.",
}


def run_batch_once(
    window_events: int | None = None,
    use_pyspark: bool | None = None,
) -> dict[str, Any]:
    summary = run_service_aggregate_job(
        window_events=window_events or settings.batch_window_events,
        use_pyspark=settings.batch_use_pyspark if use_pyspark is None else use_pyspark,
    )

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
