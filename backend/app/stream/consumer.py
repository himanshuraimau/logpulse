import json
from typing import Any

from kafka import KafkaConsumer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.storage.models import RawLogEvent
from app.stream.pipeline import enrich_event_with_detection, payload_to_raw_log_event, register_event


def consume_from_kafka(db: Session, max_messages: int = 200) -> dict[str, Any]:
    if not settings.enable_kafka:
        return {
            "kafka_enabled": False,
            "consumed": 0,
            "persisted": 0,
            "skipped": 0,
            "errors": ["Kafka is disabled by configuration"],
        }

    errors: list[str] = []
    consumed = 0
    persisted = 0
    skipped = 0

    try:
        consumer = KafkaConsumer(
            settings.kafka_topic_logs_raw,
            bootstrap_servers=[s.strip() for s in settings.kafka_bootstrap_servers.split(",") if s.strip()],
            group_id=settings.kafka_consumer_group,
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            consumer_timeout_ms=settings.kafka_poll_timeout_ms,
            value_deserializer=lambda value: json.loads(value.decode("utf-8")),
        )
    except Exception as exc:  # pragma: no cover - requires Kafka runtime
        return {
            "kafka_enabled": settings.enable_kafka,
            "consumed": 0,
            "persisted": 0,
            "skipped": 0,
            "errors": [str(exc)],
        }

    try:
        idle_cycles = 0
        while consumed < max_messages and idle_cycles < 4:
            max_records = min(100, max_messages - consumed)
            batches = consumer.poll(
                timeout_ms=settings.kafka_poll_timeout_ms,
                max_records=max_records,
            )

            if not batches:
                idle_cycles += 1
                continue

            idle_cycles = 0

            for messages in batches.values():
                for message in messages:
                    consumed += 1
                    payload = message.value
                    event_id = payload.get("event_id")

                    if event_id:
                        exists = (
                            db.query(RawLogEvent.id)
                            .filter(RawLogEvent.event_id == event_id)
                            .first()
                        )
                        if exists:
                            skipped += 1
                            continue

                    enriched_payload = enrich_event_with_detection(payload)

                    db.add(payload_to_raw_log_event(enriched_payload))
                    persisted += 1
                    register_event(enriched_payload)

        db.commit()
    except Exception as exc:  # pragma: no cover - defensive API surface
        db.rollback()
        errors.append(str(exc))
    finally:
        consumer.close()

    return {
        "kafka_enabled": settings.enable_kafka,
        "topic": settings.kafka_topic_logs_raw,
        "consumer_group": settings.kafka_consumer_group,
        "consumed": consumed,
        "persisted": persisted,
        "skipped": skipped,
        "errors": errors,
    }
