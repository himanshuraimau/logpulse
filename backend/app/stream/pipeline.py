from collections import deque
from datetime import UTC, datetime, timedelta
from threading import Lock
from typing import Any
from uuid import uuid4

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.ml.detection import IsolationForestScorer
from app.ml.rules import evaluate_rules
from app.storage.db import check_db_connection
from app.storage.models import RawLogEvent
from app.stream.kafka_producer import KafkaPublisher
from app.stream.log_generator import generate_batch

_recent_events: deque[dict[str, Any]] = deque(maxlen=settings.log_buffer_size)
_recent_lock = Lock()
_event_stream: deque[dict[str, Any]] = deque(maxlen=max(settings.log_buffer_size * 8, 1000))
_event_lock = Lock()
_event_sequence = 0
_kafka_publisher = KafkaPublisher()
_anomaly_scorer = IsolationForestScorer(
    warmup_events=settings.anomaly_model_warmup_events,
    retrain_interval=settings.anomaly_model_retrain_interval,
    contamination=settings.anomaly_model_contamination,
    enabled=settings.anomaly_scoring_enabled,
)


def _parse_timestamp(timestamp_value: str) -> datetime:
    return datetime.fromisoformat(timestamp_value.replace("Z", "+00:00"))


def enrich_event_with_detection(payload: dict[str, Any]) -> dict[str, Any]:
    recent_events = get_recent_events_snapshot(limit=settings.rule_source_burst_window)
    model_evaluation = _anomaly_scorer.score_event(payload)
    rule_evaluation = evaluate_rules(payload=payload, recent_events=recent_events)

    combined_score = max(model_evaluation.score, rule_evaluation.score)
    is_anomaly = bool(model_evaluation.is_anomaly or rule_evaluation.is_anomaly)

    enriched_payload = dict(payload)
    enriched_payload["is_anomaly"] = is_anomaly
    enriched_payload["anomaly_score"] = round(combined_score, 4)
    enriched_payload["rule_matches"] = rule_evaluation.matches
    enriched_payload["detection"] = {
        "model_anomaly": model_evaluation.is_anomaly,
        "model_score": model_evaluation.score,
        "model_detail": model_evaluation.detail,
        "rule_score": rule_evaluation.score,
    }
    return enriched_payload


def payload_to_raw_log_event(payload: dict[str, Any]) -> RawLogEvent:
    event_id = payload.get("event_id", str(uuid4()))
    timestamp = payload.get("timestamp", datetime.now(UTC).isoformat())

    return RawLogEvent(
        event_id=event_id,
        timestamp=_parse_timestamp(timestamp),
        source=payload.get("source", "unknown"),
        service=payload.get("service", "unknown-service"),
        level=payload.get("log_level", "INFO"),
        message=payload.get("message", "no message"),
        source_ip=payload.get("network", {}).get("source_ip"),
        http_status=payload.get("http", {}).get("status"),
        is_anomaly=bool(payload.get("is_anomaly", False)),
        payload=payload,
    )


def register_event(payload: dict[str, Any]) -> int:
    global _event_sequence

    with _recent_lock:
        _recent_events.appendleft(payload)

    with _event_lock:
        _event_sequence += 1
        sequence = _event_sequence
        _event_stream.append({"sequence": sequence, "payload": payload})

    return sequence


def get_events_since(last_sequence: int = 0, limit: int = 200) -> list[dict[str, Any]]:
    if limit < 1:
        return []

    with _event_lock:
        events = [item for item in _event_stream if item["sequence"] > last_sequence]

    if len(events) > limit:
        return events[-limit:]

    return events


def generate_and_stream_logs(db: Session, scenario: str, count: int) -> dict[str, Any]:
    events = generate_batch(count=count, scenario=scenario)

    persisted = 0
    kafka_published = 0
    kafka_failed = 0
    errors: list[str] = []

    try:
        for event in events:
            enriched_event = enrich_event_with_detection(event)

            db.add(payload_to_raw_log_event(enriched_event))
            persisted += 1

            published, error = _kafka_publisher.publish(enriched_event)
            if published:
                kafka_published += 1
            else:
                kafka_failed += 1
                if error and error not in errors:
                    errors.append(error)

            register_event(enriched_event)

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "scenario": scenario,
        "generated": len(events),
        "persisted": persisted,
        "kafka_enabled": settings.enable_kafka,
        "kafka_topic": settings.kafka_topic_logs_raw,
        "kafka_published": kafka_published,
        "kafka_failed": kafka_failed,
        "errors": errors[:5],
    }


def get_recent_logs(db: Session, limit: int = 100) -> list[dict[str, Any]]:
    records = (
        db.query(RawLogEvent)
        .order_by(RawLogEvent.timestamp.desc())
        .limit(limit)
        .all()
    )

    if records:
        return [record.payload for record in records]

    with _recent_lock:
        return list(_recent_events)[:limit]


def get_recent_events_snapshot(limit: int = 500) -> list[dict[str, Any]]:
    with _recent_lock:
        return list(_recent_events)[:limit]


def _within_time_window(payload: dict[str, Any], since_minutes: int) -> bool:
    timestamp_value = payload.get("timestamp")
    if not isinstance(timestamp_value, str):
        return False

    try:
        event_timestamp = _parse_timestamp(timestamp_value)
    except ValueError:
        return False

    threshold = datetime.now(UTC) - timedelta(minutes=since_minutes)
    return event_timestamp >= threshold


def get_recent_anomalies(
    db: Session,
    limit: int = 100,
    service: str | None = None,
    since_minutes: int | None = None,
) -> list[dict[str, Any]]:
    query = db.query(RawLogEvent).filter(RawLogEvent.is_anomaly.is_(True))

    if service:
        query = query.filter(RawLogEvent.service == service)

    if since_minutes is not None:
        threshold = datetime.now(UTC) - timedelta(minutes=since_minutes)
        query = query.filter(RawLogEvent.timestamp >= threshold)

    records = query.order_by(RawLogEvent.timestamp.desc()).limit(limit).all()
    if records:
        return [record.payload for record in records]

    with _recent_lock:
        fallback_events = [event for event in _recent_events if bool(event.get("is_anomaly", False))]

    if service:
        fallback_events = [
            event
            for event in fallback_events
            if str(event.get("service", "")).strip() == service
        ]

    if since_minutes is not None:
        fallback_events = [
            event for event in fallback_events if _within_time_window(event, since_minutes)
        ]

    return fallback_events[:limit]


def search_logs(
    db: Session,
    limit: int = 100,
    query: str | None = None,
    service: str | None = None,
    level: str | None = None,
    since_minutes: int | None = None,
) -> list[dict[str, Any]]:
    db_query = db.query(RawLogEvent)

    if service:
        db_query = db_query.filter(RawLogEvent.service == service)

    if level:
        db_query = db_query.filter(RawLogEvent.level == level.upper())

    if since_minutes is not None:
        threshold = datetime.now(UTC) - timedelta(minutes=since_minutes)
        db_query = db_query.filter(RawLogEvent.timestamp >= threshold)

    normalized_query = query.strip() if query else ""
    if normalized_query:
        pattern = f"%{normalized_query}%"
        db_query = db_query.filter(
            or_(
                RawLogEvent.message.ilike(pattern),
                RawLogEvent.service.ilike(pattern),
                RawLogEvent.source_ip.ilike(pattern),
            )
        )

    records = db_query.order_by(RawLogEvent.timestamp.desc()).limit(limit).all()
    if records:
        return [record.payload for record in records]

    with _recent_lock:
        fallback_records = list(_recent_events)

    if service:
        fallback_records = [item for item in fallback_records if item.get("service") == service]

    if level:
        level_upper = level.upper()
        fallback_records = [
            item for item in fallback_records if str(item.get("log_level", "")).upper() == level_upper
        ]

    if since_minutes is not None:
        fallback_records = [
            item for item in fallback_records if _within_time_window(item, since_minutes)
        ]

    if normalized_query:
        lowered_query = normalized_query.lower()
        fallback_records = [
            item
            for item in fallback_records
            if lowered_query in str(item.get("message", "")).lower()
            or lowered_query in str(item.get("service", "")).lower()
            or lowered_query in str(item.get("network", {}).get("source_ip", "")).lower()
        ]

    return fallback_records[:limit]


def get_anomaly_detail(
    db: Session,
    event_id: str,
    context_limit: int = 20,
) -> dict[str, Any] | None:
    record = (
        db.query(RawLogEvent)
        .filter(
            RawLogEvent.event_id == event_id,
            RawLogEvent.is_anomaly.is_(True),
        )
        .first()
    )
    if not record:
        return None

    context_records = (
        db.query(RawLogEvent)
        .filter(RawLogEvent.service == record.service)
        .order_by(RawLogEvent.timestamp.desc())
        .limit(context_limit + 1)
        .all()
    )
    context_items = [
        item.payload
        for item in context_records
        if item.event_id != record.event_id
    ][:context_limit]

    return {
        "event": record.payload,
        "context": context_items,
        "context_count": len(context_items),
    }


def get_anomaly_events_since(last_sequence: int = 0, limit: int = 200) -> list[dict[str, Any]]:
    stream_items = get_events_since(last_sequence=last_sequence, limit=max(limit * 3, limit))
    anomalies = [
        item for item in stream_items if bool(item.get("payload", {}).get("is_anomaly", False))
    ]

    if len(anomalies) > limit:
        return anomalies[-limit:]

    return anomalies


def get_live_metrics(window_size: int = 200) -> dict[str, Any]:
    with _recent_lock:
        window = list(_recent_events)[:window_size]

    service_stats: dict[str, dict[str, int]] = {}
    anomalies = 0
    errors = 0

    for event in window:
        service = str(event.get("service", "unknown-service"))
        service_summary = service_stats.setdefault(
            service,
            {
                "total": 0,
                "anomalies": 0,
                "errors": 0,
            },
        )
        service_summary["total"] += 1

        if bool(event.get("is_anomaly", False)):
            anomalies += 1
            service_summary["anomalies"] += 1

        status_value = event.get("http", {}).get("status")
        try:
            status_code = int(status_value) if status_value is not None else 0
        except (TypeError, ValueError):
            status_code = 0

        if status_code >= 500:
            errors += 1
            service_summary["errors"] += 1

    with _event_lock:
        event_sequence = _event_sequence

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "window_size": len(window),
        "total_events": len(window),
        "anomalies": anomalies,
        "errors": errors,
        "last_sequence": event_sequence,
        "services": service_stats,
    }


def get_pipeline_status() -> dict[str, Any]:
    db_ok, db_detail = check_db_connection()

    with _event_lock:
        event_stream_size = len(_event_stream)
        event_sequence = _event_sequence

    return {
        "database": {
            "ok": db_ok,
            "detail": db_detail,
        },
        "kafka": _kafka_publisher.status(),
        "recent_buffer_size": len(_recent_events),
        "event_stream_size": event_stream_size,
        "event_sequence": event_sequence,
    }
