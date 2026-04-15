# LogPulse

LogPulse is a full-stack observability sandbox with:

- FastAPI backend (Python + UV)
- React frontend (Bun + Vite + shadcn)
- Streaming pipeline (Kafka)
- Postgres persistence
- RCA agent flow (Gemini primary, OpenAI fallback)

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
