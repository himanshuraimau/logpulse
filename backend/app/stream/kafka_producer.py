import json
from threading import Lock
from typing import Any

from kafka import KafkaProducer

from app.core.config import settings


class KafkaPublisher:
    def __init__(self) -> None:
        self._producer: KafkaProducer | None = None
        self._connected = False
        self._last_error: str | None = None
        self._lock = Lock()

    def _ensure_producer(self) -> None:
        if not settings.enable_kafka:
            self._connected = False
            self._last_error = "Kafka is disabled by configuration"
            return

        if self._producer is not None:
            return

        with self._lock:
            if self._producer is not None:
                return

            try:
                self._producer = KafkaProducer(
                    bootstrap_servers=[s.strip() for s in settings.kafka_bootstrap_servers.split(",") if s.strip()],
                    value_serializer=lambda payload: json.dumps(payload).encode("utf-8"),
                    linger_ms=5,
                    retries=2,
                )
                self._connected = True
                self._last_error = None
            except Exception as exc:  # pragma: no cover - depends on external service
                self._producer = None
                self._connected = False
                self._last_error = str(exc)

    def publish(self, event: dict[str, Any]) -> tuple[bool, str | None]:
        self._ensure_producer()

        if self._producer is None:
            return False, self._last_error

        try:
            self._producer.send(settings.kafka_topic_logs_raw, event)
            return True, None
        except Exception as exc:  # pragma: no cover - depends on external service
            self._connected = False
            self._last_error = str(exc)
            return False, self._last_error

    def status(self) -> dict[str, Any]:
        return {
            "enabled": settings.enable_kafka,
            "connected": self._connected,
            "bootstrap_servers": settings.kafka_bootstrap_servers,
            "topic": settings.kafka_topic_logs_raw,
            "last_error": self._last_error,
        }
