from fastapi import APIRouter

from app.api.v1.agent import router as agent_router
from app.api.v1.health import router as health_router
from app.api.v1.logs import router as logs_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(logs_router, tags=["logs"])
api_router.include_router(agent_router, tags=["agent"])
