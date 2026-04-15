from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.batch.scheduler import get_batch_status, run_batch_once
from app.storage.db import get_db
from app.stream.consumer import consume_from_kafka
from app.stream.log_generator import SCENARIOS
from app.stream.pipeline import (
    get_anomaly_events_since,
    generate_and_stream_logs,
    get_live_metrics,
    get_pipeline_status,
    get_recent_anomalies,
    get_recent_logs,
)

router = APIRouter()


class GenerateLogsRequest(BaseModel):
    scenario: str = Field(default="normal", description="Generation scenario")
    count: int = Field(default=100, ge=1, le=5000, description="Number of logs")

    @field_validator("scenario")
    @classmethod
    def validate_scenario(cls, value: str) -> str:
        if value not in SCENARIOS:
            allowed = ", ".join(sorted(SCENARIOS))
            raise ValueError(f"Scenario must be one of: {allowed}")
        return value


class ConsumeStreamRequest(BaseModel):
    max_messages: int = Field(default=200, ge=1, le=2000)


@router.get("/logs/scenarios")
def list_scenarios() -> dict[str, list[str]]:
    return {"scenarios": sorted(SCENARIOS)}


@router.post("/logs/generate")
def generate_logs(payload: GenerateLogsRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        return generate_and_stream_logs(db=db, scenario=payload.scenario, count=payload.count)
    except Exception as exc:  # pragma: no cover - defensive API surface
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/logs/recent")
def recent_logs(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    items = get_recent_logs(db=db, limit=limit)
    return {
        "count": len(items),
        "items": items,
    }


@router.get("/anomalies")
def anomalies(
    limit: int = Query(default=100, ge=1, le=500),
    service: str | None = Query(default=None, min_length=1, max_length=64),
    since_minutes: int | None = Query(default=None, ge=1, le=10080),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    items = get_recent_anomalies(
        db=db,
        limit=limit,
        service=service,
        since_minutes=since_minutes,
    )
    return {
        "count": len(items),
        "items": items,
    }


@router.get("/anomalies/recent")
def anomalies_recent(
    limit: int = Query(default=200, ge=1, le=500),
    last_sequence: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    stream_items = get_anomaly_events_since(last_sequence=last_sequence, limit=limit)
    next_sequence = stream_items[-1]["sequence"] if stream_items else last_sequence
    return {
        "count": len(stream_items),
        "last_sequence": next_sequence,
        "items": [item["payload"] for item in stream_items],
    }


@router.get("/stream/status")
def stream_status() -> dict[str, Any]:
    return get_pipeline_status()


@router.get("/metrics/live")
def live_metrics(
    window_size: int = Query(default=200, ge=10, le=2000),
) -> dict[str, Any]:
    return get_live_metrics(window_size=window_size)


@router.post("/stream/consume")
def consume_stream(payload: ConsumeStreamRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    return consume_from_kafka(db=db, max_messages=payload.max_messages)


@router.get("/batch/status")
def batch_status() -> dict[str, Any]:
    return get_batch_status()


@router.post("/batch/run")
def run_batch() -> dict[str, Any]:
    return run_batch_once()
