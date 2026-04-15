from dataclasses import dataclass
from typing import Any

from app.core.config import settings


@dataclass(frozen=True)
class RuleEvaluation:
    is_anomaly: bool
    score: float
    matches: list[str]


def _http_5xx_rule(payload: dict[str, Any]) -> tuple[bool, float, str | None]:
    status_value = payload.get("http", {}).get("status")
    try:
        status_code = int(status_value) if status_value is not None else 0
    except (TypeError, ValueError):
        status_code = 0

    if status_code >= 500:
        return True, 0.95, "http_5xx"

    return False, 0.0, None


def _auth_failure_rule(payload: dict[str, Any]) -> tuple[bool, float, str | None]:
    auth_payload = payload.get("auth", {})
    action = str(auth_payload.get("action", "")).lower()
    auth_success = auth_payload.get("success")

    status_value = payload.get("http", {}).get("status")
    try:
        status_code = int(status_value) if status_value is not None else 0
    except (TypeError, ValueError):
        status_code = 0

    if action == "failed_login" or auth_success is False or status_code in {401, 403}:
        return True, 0.82, "auth_failure"

    return False, 0.0, None


def _latency_rule(payload: dict[str, Any]) -> tuple[bool, float, str | None]:
    latency_value = payload.get("http", {}).get("response_time_ms")
    try:
        latency_ms = float(latency_value) if latency_value is not None else 0.0
    except (TypeError, ValueError):
        latency_ms = 0.0

    if latency_ms < settings.rule_latency_threshold_ms:
        return False, 0.0, None

    overtime = latency_ms - settings.rule_latency_threshold_ms
    score = 0.65 + min(overtime / 500.0, 0.25)
    return True, min(score, 0.9), "latency_spike"


def _source_burst_rule(
    payload: dict[str, Any],
    recent_events: list[dict[str, Any]],
) -> tuple[bool, float, str | None]:
    source_ip = payload.get("network", {}).get("source_ip")
    if not source_ip:
        return False, 0.0, None

    relevant_window = recent_events[: settings.rule_source_burst_window]
    source_count = sum(
        1
        for event in relevant_window
        if event.get("network", {}).get("source_ip") == source_ip
    )

    if source_count < settings.rule_source_burst_threshold:
        return False, 0.0, None

    overtime = source_count - settings.rule_source_burst_threshold
    score = 0.6 + min(overtime / 40.0, 0.25)
    return True, min(score, 0.88), "source_burst"


def evaluate_rules(
    payload: dict[str, Any],
    recent_events: list[dict[str, Any]] | None = None,
) -> RuleEvaluation:
    matches: list[str] = []
    max_score = 0.0

    checks = [
        _http_5xx_rule(payload),
        _auth_failure_rule(payload),
        _latency_rule(payload),
        _source_burst_rule(payload, recent_events or []),
    ]

    for matched, score, match_name in checks:
        if not matched:
            continue
        if match_name:
            matches.append(match_name)
        if score > max_score:
            max_score = score

    return RuleEvaluation(
        is_anomaly=len(matches) > 0,
        score=round(max_score, 4),
        matches=matches,
    )
