import os
from typing import Any

from langchain_core.runnables import Runnable
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from app.core.config import settings


def _set_env_secret(name: str, value: str | None) -> None:
    if value:
        os.environ[name] = value


def _gemini_key() -> str:
    if settings.gemini_api_key is None:
        return ""
    return settings.gemini_api_key.get_secret_value().strip()


def _openai_key() -> str:
    if settings.openai_api_key is None:
        return ""
    return settings.openai_api_key.get_secret_value().strip()


def build_primary_model() -> ChatGoogleGenerativeAI:
    api_key = _gemini_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required for RCA analysis.")

    _set_env_secret("GOOGLE_API_KEY", api_key)
    return ChatGoogleGenerativeAI(
        model=settings.agent_primary_model,
        temperature=settings.agent_temperature,
        timeout=settings.agent_model_timeout_seconds,
        max_retries=settings.agent_model_retries,
    )


def build_fallback_model() -> ChatOpenAI:
    api_key = _openai_key()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required when fallback is enabled.")

    return ChatOpenAI(
        model=settings.agent_fallback_model,
        api_key=api_key,
        temperature=settings.agent_temperature,
        timeout=settings.agent_model_timeout_seconds,
        max_retries=settings.agent_model_retries,
    )


def infer_provider_from_model_name(model_name: str | None) -> str | None:
    if not model_name:
        return None

    lowered = model_name.lower()
    if "gemini" in lowered:
        return "gemini"
    if "gpt" in lowered or "o1" in lowered or "o3" in lowered or "o4" in lowered:
        return "openai"
    return None


def build_model_with_fallback() -> tuple[Runnable[Any, Any], dict[str, Any]]:
    primary_model = build_primary_model()
    metadata: dict[str, Any] = {
        "primary_provider": settings.agent_primary_provider,
        "primary_model": settings.agent_primary_model,
        "fallback_configured": False,
        "fallback_provider": None,
        "fallback_model": None,
    }

    if not settings.agent_fallback_enabled:
        return primary_model, metadata

    try:
        fallback_model = build_fallback_model()
    except RuntimeError:
        return primary_model, metadata

    metadata["fallback_configured"] = True
    metadata["fallback_provider"] = settings.agent_fallback_provider
    metadata["fallback_model"] = settings.agent_fallback_model

    return primary_model.with_fallbacks([fallback_model]), metadata
