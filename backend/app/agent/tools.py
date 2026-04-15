import json
from typing import Any

from langchain.tools import tool
from sqlalchemy.orm import Session

from app.stream.pipeline import (
    get_anomaly_detail,
    get_live_metrics,
    get_recent_anomalies,
    search_logs,
)


def _compact_event(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "event_id": event.get("event_id"),
        "timestamp": event.get("timestamp"),
        "service": event.get("service"),
        "log_level": event.get("log_level"),
        "message": event.get("message"),
        "is_anomaly": bool(event.get("is_anomaly", False)),
        "anomaly_score": event.get("anomaly_score"),
        "rule_matches": event.get("rule_matches") or [],
        "http_status": event.get("http", {}).get("status"),
        "response_time_ms": event.get("http", {}).get("response_time_ms"),
        "source_ip": event.get("network", {}).get("source_ip"),
    }


def _safe_json(payload: Any) -> str:
    return json.dumps(payload, default=str)


def build_agent_tools(
    db: Session,
    event_id: str,
    service_hint: str | None,
) -> list[Any]:
    @tool
    def get_target_anomaly(context_limit: int = 25) -> str:
        """Fetch the selected anomaly event and nearby same-service context logs."""
        bounded_context_limit = max(5, min(context_limit, 120))
        detail = get_anomaly_detail(db=db, event_id=event_id, context_limit=bounded_context_limit)
        if detail is None:
            return _safe_json({"error": "anomaly_not_found", "event_id": event_id})

        context_items = [_compact_event(item) for item in detail.get("context", [])[: bounded_context_limit]]
        return _safe_json(
            {
                "event": _compact_event(detail["event"]),
                "context": context_items,
                "context_count": len(context_items),
            }
        )

    @tool
    def search_service_logs_tool(
        query: str = "",
        level: str = "",
        since_minutes: int = 240,
        limit: int = 40,
    ) -> str:
        """Search logs for the target service to gather evidence around probable causes."""
        bounded_limit = max(5, min(limit, 80))
        bounded_since = max(5, min(since_minutes, 1440))

        items = search_logs(
            db=db,
            limit=bounded_limit,
            query=query.strip() or None,
            service=service_hint,
            level=level.strip() or None,
            since_minutes=bounded_since,
        )
        compact_items = [_compact_event(item) for item in items[:bounded_limit]]
        return _safe_json(
            {
                "service": service_hint,
                "count": len(compact_items),
                "items": compact_items,
            }
        )

    @tool
    def get_recent_anomaly_patterns(
        since_minutes: int = 360,
        limit: int = 30,
    ) -> str:
        """Fetch recent anomalies for the same service to identify recurring patterns."""
        bounded_limit = max(5, min(limit, 80))
        bounded_since = max(5, min(since_minutes, 1440))

        items = get_recent_anomalies(
            db=db,
            limit=bounded_limit,
            service=service_hint,
            since_minutes=bounded_since,
        )
        compact_items = [_compact_event(item) for item in items[:bounded_limit]]
        return _safe_json(
            {
                "service": service_hint,
                "count": len(compact_items),
                "items": compact_items,
            }
        )

    @tool
    def get_live_metrics_snapshot(window_size: int = 300) -> str:
        """Get current service-level anomaly and error metrics for operational impact analysis."""
        bounded_window = max(50, min(window_size, 1000))
        metrics = get_live_metrics(window_size=bounded_window)
        return _safe_json(metrics)

    return [
        get_target_anomaly,
        search_service_logs_tool,
        get_recent_anomaly_patterns,
        get_live_metrics_snapshot,
    ]
