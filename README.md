# LogPulse

LogPulse is a full-stack observability sandbox with:

- FastAPI backend (Python + UV)
- React frontend (Bun + Vite + shadcn)
- Streaming pipeline (Kafka)
- Postgres persistence
- RCA agent flow (Gemini primary, OpenAI fallback)

This repo is used as a Real-Time Big Data Analytics (RTBDA) project demo.

## Project Goal (RTBDA)

LogPulse demonstrates how to ingest high-volume event streams, detect anomalies in near real time, run batch analytics for historical summaries, and surface results in a live dashboard. It models a simplified observability platform where logs are generated, enriched, persisted, analyzed, and presented with low latency.

## Architecture Summary

At a high level, LogPulse follows a Lambda-style RTBDA design:

- Speed layer: low-latency stream path for live logs, anomalies, and metrics.
- Batch layer: scheduled aggregation over recent windows for summary insights.
- Serving layer: API + WebSockets that expose data to the frontend.

See the full diagram in [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md).

## RTBDA Layers Explained

### 1) Speed Layer (Real-time stream)

Purpose: deliver fast, low-latency results from incoming data.

How it works in LogPulse:

- Synthetic log events are generated and enriched with anomaly scores.
- Events are written to Postgres and published to Kafka topic `logs.raw`.
- A Kafka consumer loop (stream worker) reads events, enriches/dedupes them, and updates live in-memory buffers.
- WebSocket endpoints (`/ws/logs`, `/ws/anomalies`, `/ws/metrics`) push live updates to the UI.

Why it matters: this path is optimized for immediacy, enabling live monitoring and rapid anomaly awareness.

### 2) Batch Layer (Historical aggregation)

Purpose: compute heavier aggregates over recent windows, trading latency for richer summaries.

How it works in LogPulse:

- A batch scheduler collects recent events and runs aggregate jobs.
- Aggregation runs via PySpark when available, with a Python fallback.
- Results are persisted to `batch_runs` in Postgres.
- The UI reads batch status and historical summaries from `/api/v1/batch/*` and `/api/v1/metrics/batch`.

Why it matters: batch jobs produce stable, reportable metrics that complement real-time signals.

### 3) Serving Layer (API + UI exposure)

Purpose: expose both real-time and batch results in a consistent, queryable way.

How it works in LogPulse:

- REST endpoints under `/api/v1` serve logs, anomalies, metrics, batch summaries, and RCA reports.
- WebSockets stream live updates with resume support.
- The React dashboard provides live logs, anomaly timeline, metrics, batch analytics, and RCA console.

Why it matters: the serving layer lets users query and visualize both speed and batch results in one place.

## How the System Works (End-to-End Flow)

1. Generate synthetic logs from the UI or API.
2. Enrich events with anomaly detection (rules + model score).
3. Persist to Postgres and publish to Kafka `logs.raw`.
4. Stream worker consumes Kafka and updates live buffers.
5. UI receives live updates over WebSockets.
6. Batch jobs aggregate recent events and persist batch summaries.
7. RCA agent can analyze an anomaly and produce a structured report.

## Key Components

- Backend API: FastAPI service providing REST + WebSocket interfaces.
- Stream pipeline: Kafka producer/consumer with enrichment and live buffers.
- Batch scheduler: aggregates over recent windows and writes summaries.
- RCA agent: asynchronous root cause analysis using LLM tools.
- Frontend: React dashboard for live and batch observability views.

## Tooling and Tech Stack

- Backend: Python 3.12, FastAPI, uv, SQLAlchemy
- Streaming: Kafka + Zookeeper
- Storage: Postgres (primary), Redis/Elasticsearch (provisioned)
- Batch analytics: PySpark preferred, Python fallback
- Frontend: Bun + Vite + React + shadcn UI
- RCA agent: Gemini primary with OpenAI fallback

## Quick Start

For full instructions, see [RUNNING.md](RUNNING.md).

Fastest way to run everything:

```bash
docker compose up --build
```

Then open:

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs
- Health endpoint: http://localhost:8000/api/v1/health

## What This Repo Includes

- [backend](backend): API, stream/batch workers, RCA agent, storage models.
- [frontend](frontend): dashboard UI for live logs, anomalies, and batch views.
- [docker-compose.yml](docker-compose.yml): one-command local stack.

## More Detailed Guides

- [PROJECT_GUIDE.md](PROJECT_GUIDE.md): annotated tour of the codebase.
- [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md): system diagrams and flows.
- [RUNNING.md](RUNNING.md): full local and Docker run instructions.
