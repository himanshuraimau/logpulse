# Running LogPulse

This guide covers how to run the whole app end to end.

## 1) Prerequisites

- Docker + Docker Compose
- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- [Bun](https://bun.sh/)

## 2) Option A: Run Everything With Docker Compose

From repo root:

```bash
docker compose up --build
```

Services started by default:

- `zookeeper`
- `kafka`
- `postgres`
- `redis`
- `elasticsearch`
- `backend` (API)
- `backend-stream` (Kafka consumer loop)
- `frontend`

Host port mappings used by this compose setup:

- Backend API: `8000`
- Frontend: `5173`
- Kafka: `9092`
- Elasticsearch: `9200`
- Postgres: `5434` (container `5432`)
- Redis: `6380` (container `6379`)

Open:

- Frontend: http://localhost:5173
- Backend docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/v1/health

Stop:

```bash
docker compose down
```

Stop and remove volumes:

```bash
docker compose down -v
```

## 3) Option B: Run Locally (Separate Terminals)

### 3.1 Start Infra Containers Only

From repo root:

```bash
docker compose up -d zookeeper kafka postgres redis elasticsearch
```

### 3.2 Backend Setup

From repo root:

```bash
cp .env.example backend/.env
```

Important:

- The backend expects its runtime `.env` at `backend/.env` (not repo root).
- In Docker Compose, backend runtime path is `/app`, so this maps to `backend/.env` on host.
- `CORS_ORIGINS` supports both comma-separated and JSON array formats.

Then:

```bash
cd backend
uv sync
```

If you run infra via Docker Compose, set this in `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://logpulse:logpulse@localhost:5434/logpulse
```

### 3.3 Start Backend API (Terminal 1)

```bash
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Note: `app.main` starts the RCA worker automatically when `AGENT_WORKER_ENABLED=true`.

### 3.4 Start Stream Consumer (Terminal 2)

```bash
cd backend
uv run python -m app.runner --mode stream
```

### 3.5 Start Frontend (Terminal 3)

```bash
cd frontend
bun install
bun run dev --host 0.0.0.0 --port 5173
```

Open UI:

- http://localhost:5173

## 4) Optional: Batch Worker Loop

Run in a separate terminal:

```bash
cd backend
uv run python -m app.runner --mode batch --batch-loop
```

Notes:

- Batch aggregation tries PySpark when `BATCH_USE_PYSPARK=true`.
- If Java is not available in the runtime, the job now falls back to the Python aggregator and returns a warning field in the response.
- To avoid PySpark startup overhead locally, you can set `BATCH_USE_PYSPARK=false` in your environment.

## 5) RCA Agent Credentials

Set keys in `backend/.env` for live RCA model execution:

```env
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
```

Without keys, requests can still be queued, but live LLM analysis cannot complete.

Validate agent env loading at runtime:

```bash
curl "http://localhost:8000/api/v1/agent/config"
```

This endpoint safely reports whether `GEMINI_API_KEY` and `OPENAI_API_KEY` are detected in `.env` and loaded into settings (without returning secret values).

## 6) Basic Smoke Flow

1. Open frontend at http://localhost:5173
2. Generate synthetic logs from the live logs page.
3. Confirm backend health at `/api/v1/health`.
4. Confirm anomaly events appear.
5. Trigger RCA via API (example below) and poll report status.

Queue RCA:

```bash
curl -X POST "http://localhost:8000/api/v1/agent/analyze" \
  -H "Content-Type: application/json" \
  -d '{"event_id":"<ANOMALY_EVENT_ID>","context_limit":25}'
```

List reports:

```bash
curl "http://localhost:8000/api/v1/agent/reports?limit=20"
```

## 7) Troubleshooting

- Kafka errors:
  - Ensure `kafka` and `zookeeper` are running.
  - For local mode, `KAFKA_BOOTSTRAP_SERVERS` should be `localhost:9092`.
- Database errors:
  - Ensure Postgres is up and matches `DATABASE_URL`.
- RCA stuck in `queued`:
  - Ensure API process is running.
  - Ensure `AGENT_WORKER_ENABLED=true` in `backend/.env`.
  - Ensure model keys are configured for live completion.
- Batch run returns `500` or appears as CORS failure in browser:
  - Check backend logs for Java/PySpark startup errors.
  - Set `BATCH_USE_PYSPARK=false` for local runtime if Java is unavailable.
