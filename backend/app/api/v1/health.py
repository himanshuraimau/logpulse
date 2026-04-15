from typing import Any

from fastapi import APIRouter

from app.core.config import settings
from app.stream.pipeline import get_pipeline_status

router = APIRouter()


@router.get("/health")
def health_check() -> dict[str, Any]:
    pipeline_status = get_pipeline_status()
    overall_status = "ok" if pipeline_status["database"]["ok"] else "degraded"

    return {
        "status": overall_status,
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "pipeline": pipeline_status,
    }
