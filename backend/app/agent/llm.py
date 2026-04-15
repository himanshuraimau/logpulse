import os
from pathlib import Path
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


def _read_env_file_value(env_path: Path, key: str) -> str | None:
    if not env_path.exists():
        return None

    try:
        content = env_path.read_text(encoding="utf-8")
    except OSError:
        return None

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        current_key, raw_value = line.split("=", 1)
        if current_key.strip() != key:
            continue

        value = raw_value.strip().strip('"').strip("'")
        return value

    return None


def get_agent_env_diagnostics() -> dict[str, Any]:
    env_path = Path(".env")

    gemini_setting = _gemini_key()
    openai_setting = _openai_key()
    gemini_from_env_file = _read_env_file_value(env_path, "GEMINI_API_KEY")
    openai_from_env_file = _read_env_file_value(env_path, "OPENAI_API_KEY")

    gemini_setting_loaded = bool(gemini_setting)
    openai_setting_loaded = bool(openai_setting)
    gemini_env_file_has_value = bool(gemini_from_env_file)
    openai_env_file_has_value = bool(openai_from_env_file)

    diagnostics: dict[str, Any] = {
        "agent": {
            "primary_provider": settings.agent_primary_provider,
            "primary_model": settings.agent_primary_model,
            "fallback_enabled": settings.agent_fallback_enabled,
            "fallback_provider": settings.agent_fallback_provider,
            "fallback_model": settings.agent_fallback_model,
        },
        "env": {
            "cwd": str(Path.cwd()),
            "expected_env_file": str(env_path.resolve()),
            "env_file_exists": env_path.exists(),
            "gemini_key_present_in_env_file": gemini_env_file_has_value,
            "openai_key_present_in_env_file": openai_env_file_has_value,
            "gemini_key_loaded_in_settings": gemini_setting_loaded,
            "openai_key_loaded_in_settings": openai_setting_loaded,
            "gemini_key_length": len(gemini_setting),
            "openai_key_length": len(openai_setting),
        },
        "ready": {
            "primary_model_ready": gemini_setting_loaded,
            "fallback_model_ready": (not settings.agent_fallback_enabled) or openai_setting_loaded,
        },
    }

    issues: list[str] = []
    if not env_path.exists():
        issues.append("Missing .env file in backend runtime directory.")
    if not gemini_setting_loaded:
        issues.append("GEMINI_API_KEY is not loaded in settings.")
    if settings.agent_fallback_enabled and not openai_setting_loaded:
        issues.append("OPENAI_API_KEY is not loaded while fallback is enabled.")
    if gemini_env_file_has_value and not gemini_setting_loaded:
        issues.append("GEMINI_API_KEY is present in .env but not loaded into settings.")
    if settings.agent_fallback_enabled and openai_env_file_has_value and not openai_setting_loaded:
        issues.append("OPENAI_API_KEY is present in .env but not loaded into settings.")

    diagnostics["issues"] = issues
    return diagnostics


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
