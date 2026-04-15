from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.agent.llm import get_agent_env_diagnostics
from app.agent.worker import (
    create_report_request,
    get_report_by_id,
    list_reports,
    serialize_report,
)
from app.core.config import settings
from app.storage.db import get_db
from app.stream.pipeline import get_anomaly_detail

router = APIRouter()


class AnalyzeRequest(BaseModel):
    event_id: str = Field(min_length=1, max_length=128)
    context_limit: int = Field(default=settings.agent_default_context_limit, ge=5, le=200)


@router.get("/agent/config")
def get_agent_config() -> dict[str, Any]:
    return get_agent_env_diagnostics()


@router.post("/agent/analyze")
def analyze_anomaly(payload: AnalyzeRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    exists = get_anomaly_detail(db=db, event_id=payload.event_id, context_limit=1)
    if exists is None:
        raise HTTPException(status_code=404, detail="Anomaly event not found")

    report = create_report_request(
        db=db,
        event_id=payload.event_id,
        context_limit=payload.context_limit,
    )

    return {
        "status": "queued",
        "report": serialize_report(report),
    }


@router.get("/agent/reports/{report_id}")
def get_report(report_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    report = get_report_by_id(db=db, report_id=report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="RCA report not found")

    return serialize_report(report)


@router.get("/agent/reports")
def get_reports(
    limit: int = Query(default=20, ge=1, le=200),
    status: str | None = Query(default=None, min_length=1, max_length=32),
    event_id: str | None = Query(default=None, min_length=1, max_length=128),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    reports = list_reports(
        db=db,
        limit=limit,
        status=status,
        event_id=event_id,
    )

    items = [serialize_report(report) for report in reports]
    return {
        "count": len(items),
        "items": items,
    }
