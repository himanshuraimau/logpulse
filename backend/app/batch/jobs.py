from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.stream.pipeline import get_recent_events_snapshot


def _event_to_row(event: dict[str, Any]) -> dict[str, int | str]:
    status_value = event.get("http", {}).get("status")
    try:
        status_code = int(status_value) if status_value is not None else 0
    except (TypeError, ValueError):
        status_code = 0

    return {
        "service": str(event.get("service", "unknown-service")),
        "is_anomaly": int(bool(event.get("is_anomaly", False))),
        "is_error": int(status_code >= 500),
    }


def _aggregate_with_python(rows: list[dict[str, int | str]]) -> list[dict[str, int | str]]:
    stats: dict[str, dict[str, int]] = {}

    for row in rows:
        service = str(row["service"])
        service_stats = stats.setdefault(
            service,
            {
                "total": 0,
                "anomalies": 0,
                "errors": 0,
            },
        )
        service_stats["total"] += 1
        service_stats["anomalies"] += int(row["is_anomaly"])
        service_stats["errors"] += int(row["is_error"])

    return [
        {
            "service": service,
            "total": values["total"],
            "anomalies": values["anomalies"],
            "errors": values["errors"],
        }
        for service, values in sorted(
            stats.items(),
            key=lambda item: item[1]["total"],
            reverse=True,
        )
    ]


def _aggregate_with_pyspark(
    rows: list[dict[str, int | str]],
) -> tuple[list[dict[str, int | str]] | None, str | None]:
    try:
        from pyspark.sql import SparkSession
        from pyspark.sql import functions as spark_functions
    except Exception as exc:  # pragma: no cover - environment specific
        return None, f"pyspark-unavailable: {exc}"

    if not rows:
        return [], None

    spark = None
    try:
        spark = (
            SparkSession.builder
            .master("local[*]")
            .appName("logpulse-batch-scaffold")
            .getOrCreate()
        )
        spark.sparkContext.setLogLevel("ERROR")

        dataframe = spark.createDataFrame(rows)
        aggregated = (
            dataframe.groupBy("service")
            .agg(
                spark_functions.count(spark_functions.lit(1)).alias("total"),
                spark_functions.sum(spark_functions.col("is_anomaly")).alias("anomalies"),
                spark_functions.sum(spark_functions.col("is_error")).alias("errors"),
            )
            .orderBy(spark_functions.col("total").desc())
        )
        records = [
            {
                "service": str(row["service"]),
                "total": int(row["total"]),
                "anomalies": int(row["anomalies"]),
                "errors": int(row["errors"]),
            }
            for row in aggregated.collect()
        ]
        return records, None
    except Exception as exc:  # pragma: no cover - runtime environment specific
        return None, f"pyspark-runtime-failed: {exc}"
    finally:
        if spark is not None:
            spark.stop()


def run_service_aggregate_job(
    window_events: int = 1200,
    use_pyspark: bool = True,
) -> dict[str, Any]:
    started_at = datetime.now(UTC)
    events = get_recent_events_snapshot(limit=window_events)
    rows = [_event_to_row(event) for event in events]

    warning: str | None = None
    engine = "python"

    if use_pyspark:
        spark_result, warning = _aggregate_with_pyspark(rows)
        if spark_result is not None:
            services = spark_result
            engine = "pyspark"
        else:
            services = _aggregate_with_python(rows)
    else:
        services = _aggregate_with_python(rows)

    completed_at = datetime.now(UTC)
    total_events = sum(int(item["total"]) for item in services)

    summary = {
        "run_id": str(uuid4()),
        "status": "ok",
        "engine": engine,
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat(),
        "duration_ms": int((completed_at - started_at).total_seconds() * 1000),
        "window_events_requested": window_events,
        "total_events": total_events,
        "service_count": len(services),
        "services": services,
    }

    if warning:
        summary["warning"] = warning

    return summary
