from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "LogPulse API"
    app_version: str = "0.1.0"
    environment: str = "development"
    api_prefix: str = "/api/v1"

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    database_url: str = "sqlite:///./logpulse.db"

    enable_kafka: bool = False
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_topic_logs_raw: str = "logs.raw"
    kafka_consumer_group: str = "logpulse-stream-local"
    kafka_poll_timeout_ms: int = 1000

    log_buffer_size: int = 500

    anomaly_scoring_enabled: bool = True
    anomaly_model_warmup_events: int = 200
    anomaly_model_retrain_interval: int = 100
    anomaly_model_contamination: float = 0.08
    rule_latency_threshold_ms: float = 800.0
    rule_source_burst_window: int = 120
    rule_source_burst_threshold: int = 20

    batch_interval_seconds: int = 900
    batch_window_events: int = 1200
    batch_use_pyspark: bool = True
    batch_run_loop: bool = False

    agent_worker_enabled: bool = True
    agent_worker_poll_seconds: float = 2.0
    agent_worker_batch_size: int = 2
    agent_default_context_limit: int = 25
    agent_max_context_limit: int = 120
    agent_model_timeout_seconds: int = 45
    agent_model_retries: int = 2
    agent_temperature: float = 0.2
    agent_max_tool_calls: int = 6

    agent_primary_provider: str = "gemini"
    agent_primary_model: str = "gemini-2.0-flash"
    agent_fallback_enabled: bool = True
    agent_fallback_provider: str = "openai"
    agent_fallback_model: str = "gpt-4o-mini"

    gemini_api_key: SecretStr | None = None
    openai_api_key: SecretStr | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: list[str] | str) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("agent_primary_provider", "agent_fallback_provider", mode="before")
    @classmethod
    def normalize_provider_name(cls, value: str) -> str:
        return value.strip().lower()


settings = Settings()
