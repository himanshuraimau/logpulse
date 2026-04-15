from collections import deque
from dataclasses import dataclass
from typing import Any

try:
    from sklearn.ensemble import IsolationForest
except Exception as exc:  # pragma: no cover - environment dependent import
    IsolationForest = None  # type: ignore[assignment]
    _IMPORT_ERROR = str(exc)
else:
    _IMPORT_ERROR = None


_LEVEL_TO_VALUE = {
    "DEBUG": 0.2,
    "INFO": 0.4,
    "WARN": 0.7,
    "WARNING": 0.7,
    "ERROR": 1.0,
    "CRITICAL": 1.0,
}


@dataclass(frozen=True)
class ModelEvaluation:
    is_anomaly: bool
    score: float
    detail: str


class IsolationForestScorer:
    def __init__(
        self,
        warmup_events: int = 200,
        retrain_interval: int = 100,
        contamination: float = 0.08,
        enabled: bool = True,
    ) -> None:
        self.enabled = enabled
        self.warmup_events = max(50, warmup_events)
        self.retrain_interval = max(20, retrain_interval)
        self.contamination = min(max(contamination, 0.001), 0.4)
        self._feature_buffer: deque[list[float]] = deque(maxlen=max(self.warmup_events * 5, 1000))
        self._processed_events = 0
        self._fitted = False
        self._model: Any = None

    def _vectorize(self, payload: dict[str, Any]) -> list[float]:
        status_value = payload.get("http", {}).get("status")
        latency_value = payload.get("http", {}).get("response_time_ms")
        bytes_sent_value = payload.get("http", {}).get("bytes_sent")
        bytes_received_value = payload.get("http", {}).get("bytes_received")

        try:
            status_code = float(int(status_value)) if status_value is not None else 0.0
        except (TypeError, ValueError):
            status_code = 0.0

        try:
            latency_ms = float(latency_value) if latency_value is not None else 0.0
        except (TypeError, ValueError):
            latency_ms = 0.0

        try:
            bytes_sent = float(bytes_sent_value) if bytes_sent_value is not None else 0.0
        except (TypeError, ValueError):
            bytes_sent = 0.0

        try:
            bytes_received = float(bytes_received_value) if bytes_received_value is not None else 0.0
        except (TypeError, ValueError):
            bytes_received = 0.0

        level = str(payload.get("log_level", "INFO")).upper()
        level_value = _LEVEL_TO_VALUE.get(level, 0.4)

        auth_success = payload.get("auth", {}).get("success")
        auth_failure_value = 0.0 if auth_success is True else 1.0 if auth_success is False else 0.5

        message_size = float(len(str(payload.get("message", ""))))

        return [
            status_code,
            latency_ms,
            bytes_sent,
            bytes_received,
            level_value,
            auth_failure_value,
            message_size,
        ]

    def _fit(self) -> bool:
        if IsolationForest is None:
            return False

        if len(self._feature_buffer) < self.warmup_events:
            return False

        self._model = IsolationForest(
            contamination=self.contamination,
            n_estimators=120,
            random_state=42,
        )
        self._model.fit(list(self._feature_buffer))
        self._fitted = True
        return True

    @staticmethod
    def _normalize_score(raw_score: float) -> float:
        normalized = 0.5 - raw_score
        if normalized < 0.0:
            return 0.0
        if normalized > 1.0:
            return 1.0
        return normalized

    def score_event(self, payload: dict[str, Any]) -> ModelEvaluation:
        if not self.enabled:
            return ModelEvaluation(is_anomaly=False, score=0.0, detail="disabled")

        feature_vector = self._vectorize(payload)
        self._feature_buffer.append(feature_vector)
        self._processed_events += 1

        if IsolationForest is None:
            return ModelEvaluation(
                is_anomaly=False,
                score=0.0,
                detail=f"unavailable:{_IMPORT_ERROR}",
            )

        if not self._fitted:
            fitted_now = self._fit()
            if not fitted_now:
                return ModelEvaluation(
                    is_anomaly=False,
                    score=0.0,
                    detail=f"warming_up:{len(self._feature_buffer)}/{self.warmup_events}",
                )

        if self._processed_events % self.retrain_interval == 0:
            self._fit()

        prediction = int(self._model.predict([feature_vector])[0])
        raw_score = float(self._model.decision_function([feature_vector])[0])
        anomaly_score = round(self._normalize_score(raw_score), 4)
        return ModelEvaluation(
            is_anomaly=prediction == -1,
            score=anomaly_score,
            detail="scored",
        )
