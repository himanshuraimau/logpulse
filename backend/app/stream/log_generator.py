from datetime import UTC, datetime
import random
import uuid

SCENARIOS = {"normal", "error_spike", "auth_failures", "request_burst", "mixed"}

SERVICES = [
    "api-gateway",
    "auth-service",
    "billing-service",
    "orders-service",
]

HTTP_PATHS = [
    "/api/v1/auth/login",
    "/api/v1/orders",
    "/api/v1/billing/payments",
    "/api/v1/health",
]

USER_AGENTS = [
    "Mozilla/5.0",
    "curl/8.8.0",
    "k6/0.52",
    "PostmanRuntime/7.42.0",
]


def _random_ip() -> str:
    return ".".join(str(random.randint(1, 254)) for _ in range(4))


def _build_message(scenario: str, status: int, latency_ms: float) -> str:
    if scenario == "error_spike":
        return f"Upstream dependency timeout, status={status}, latency_ms={latency_ms:.1f}"
    if scenario == "auth_failures":
        return "Authentication failed for credential validation"
    if scenario == "request_burst":
        return "Request surge detected from single source"
    return f"Request completed with status={status} in {latency_ms:.1f}ms"


def _pick_scenario(scenario: str) -> str:
    if scenario == "mixed":
        return random.choice(["normal", "error_spike", "auth_failures", "request_burst"])
    return scenario


def build_log_event(scenario: str = "normal", source_ip: str | None = None) -> dict:
    selected_scenario = _pick_scenario(scenario)
    service = random.choice(SERVICES)
    path = random.choice(HTTP_PATHS)

    if selected_scenario == "error_spike":
        status = random.choice([500, 502, 503, 504])
        level = "ERROR"
    elif selected_scenario == "auth_failures":
        status = random.choice([401, 403])
        level = "WARN"
    else:
        status = 200 if selected_scenario == "normal" else random.choice([200, 201, 202])
        level = "INFO"

    latency_ms = random.uniform(30.0, 950.0)
    event_time = datetime.now(UTC)
    event_id = str(uuid.uuid4())
    picked_source_ip = source_ip if source_ip else _random_ip()

    return {
        "schema_version": "1.0",
        "event_id": event_id,
        "timestamp": event_time.isoformat(),
        "received_at": datetime.now(UTC).isoformat(),
        "source": "app",
        "service": service,
        "log_level": level,
        "message": _build_message(selected_scenario, status, latency_ms),
        "http": {
            "method": random.choice(["GET", "POST", "PUT", "DELETE"]),
            "path": path,
            "status": status,
            "response_time_ms": latency_ms,
            "bytes_sent": random.randint(150, 30000),
            "bytes_received": random.randint(80, 12000),
            "user_agent": random.choice(USER_AGENTS),
        },
        "network": {
            "source_ip": picked_source_ip,
            "source_port": random.randint(1025, 65535),
            "destination_ip": "10.0.1.10",
            "destination_port": 443,
        },
        "auth": {
            "user": random.choice(["ops@example.com", "api-client", "service-account"]),
            "action": "failed_login" if selected_scenario == "auth_failures" else "request",
            "success": selected_scenario != "auth_failures",
        },
        "tags": ["phase-1", selected_scenario],
    }


def generate_batch(count: int, scenario: str = "normal") -> list[dict]:
    selected_scenario = scenario if scenario in SCENARIOS else "normal"

    if selected_scenario == "request_burst":
        burst_source_ip = _random_ip()
        return [build_log_event(selected_scenario, source_ip=burst_source_ip) for _ in range(count)]

    return [build_log_event(selected_scenario) for _ in range(count)]
