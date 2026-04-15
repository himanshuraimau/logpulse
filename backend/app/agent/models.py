import json
import re
from typing import Any

from pydantic import BaseModel, Field


class RCAAnalysisResult(BaseModel):
    summary: str = "No summary provided."
    root_cause: str = "Unable to determine root cause from available evidence."
    impact: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    recommendations: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    timeline: list[str] = Field(default_factory=list)


def _coerce_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return []
        return [cleaned]
    return [str(value)]


def _coerce_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.0

    if confidence < 0.0:
        return 0.0
    if confidence > 1.0:
        return 1.0
    return round(confidence, 4)


def _extract_json_object(text: str) -> dict[str, Any] | None:
    stripped = text.strip()
    if not stripped:
        return None

    try:
        candidate = json.loads(stripped)
    except json.JSONDecodeError:
        candidate = None

    if isinstance(candidate, dict):
        return candidate

    match = re.search(r"\{[\s\S]*\}", stripped)
    if not match:
        return None

    try:
        candidate = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None

    if isinstance(candidate, dict):
        return candidate
    return None


def parse_agent_output(content: str) -> RCAAnalysisResult:
    json_payload = _extract_json_object(content)

    if json_payload is None:
        summary = content.strip() or "Agent returned an empty response."
        return RCAAnalysisResult(summary=summary)

    summary = str(
        json_payload.get("summary")
        or json_payload.get("finding")
        or json_payload.get("analysis")
        or "No summary provided."
    )
    root_cause = str(
        json_payload.get("root_cause")
        or json_payload.get("probable_root_cause")
        or json_payload.get("cause")
        or "Unable to determine root cause from available evidence."
    )

    return RCAAnalysisResult(
        summary=summary,
        root_cause=root_cause,
        impact=str(json_payload.get("impact") or ""),
        confidence=_coerce_confidence(json_payload.get("confidence", 0.0)),
        recommendations=_coerce_string_list(json_payload.get("recommendations")),
        evidence=_coerce_string_list(json_payload.get("evidence")),
        timeline=_coerce_string_list(json_payload.get("timeline")),
    )
