# LogPulse Plan - Simplified Single-Repo Architecture

## 1. Goal

Build LogPulse as one repository with:
- one FastAPI backend codebase that contains all Python operations
- one React frontend folder that contains the full dashboard

This keeps the original feature set while reducing architecture and delivery complexity.

## 2. Feature Parity (What Must Stay)

The simplified plan keeps all major features from the previous version:
- Multi-source log ingestion (web, app, system, security)
- Real-time anomaly detection using Isolation Forest + rule engine
- Batch analytics and temporal drift detection with PySpark + LSTM
- AI root cause analysis (RCA) agent with tool-based evidence gathering
- Log search and anomaly history
- Live dashboard updates via WebSockets
- React dashboard modules:
  - Live Log Stream
  - Anomaly Timeline
  - Metrics Dashboard
  - Batch Analytics
  - AI Agent Console
- Docker-first local development and Kubernetes-ready deployment
- Testing, observability, and KPI targets

## 3. Simplified Architecture

All Python code lives in one backend project and can run in multiple modes from the same codebase/image:
- api mode: FastAPI REST + WebSocket server
- stream mode: near real-time ingestion and anomaly scoring
- batch mode: scheduled aggregation, LSTM inference, retraining jobs
- agent mode: async AI RCA worker

```text
Log Sources
  -> Ingestion Adapter
  -> Kafka (logs.raw)
  -> Backend Stream Worker (feature engineering + IF + rules)
  -> PostgreSQL (anomalies) + Redis (live cache) + Elasticsearch (search)
  -> FastAPI API/WebSocket
  -> React Dashboard

High severity anomaly
  -> Agent Queue
  -> Backend Agent Worker (LLM + tools)
  -> PostgreSQL (rca_reports)
  -> WebSocket notify frontend

Scheduled every 15 min
  -> Backend Batch Worker
  -> Batch aggregates + LSTM drift detection
  -> PostgreSQL + Redis cache refresh
```

## 4. Technology Stack (Consolidated)

### Backend
- FastAPI, Pydantic, SQLAlchemy, Alembic
- Celery + Redis (async tasks)
- scikit-learn (Isolation Forest)
- PySpark (distributed batch feature engineering and aggregations)
- TensorFlow/Keras (LSTM)
- LangChain + OpenAI/Anthropic (AI RCA)

### Data and Messaging
- Kafka (high-throughput ingestion)
- PostgreSQL (anomalies, RCA, batch runs)
- Redis (live cache, pub/sub)
- Elasticsearch (log indexing and search)

### Frontend
- React + TypeScript + Vite
- Zustand (UI/global state)
- TanStack Query (data fetching/cache)
- Recharts (charts)

### Platform
- Docker Compose (local)
- Kubernetes manifests (production-ready path)
- Prometheus + Grafana (monitoring)

## 5. Backend Design (Single FastAPI Codebase)

### 5.1 Backend Modules

```text
backend/app/
  api/           # REST endpoints
  ws/            # WebSocket handlers
  ingestion/     # Log normalization, schema validation
  stream/        # Real-time feature engineering + scoring
  batch/         # Batch jobs and schedules
  ml/            # Model training/inference logic
  agent/         # RCA agent orchestration and tools
  storage/       # Postgres/Redis/Elasticsearch/Kafka clients
  core/          # Settings, logging, auth, shared utilities
```

### 5.2 Core API Endpoints

- `GET /api/v1/anomalies`
- `GET /api/v1/anomalies/{id}`
- `GET /api/v1/metrics/live`
- `GET /api/v1/metrics/batch`
- `GET /api/v1/logs/search`
- `POST /api/v1/agent/analyze`
- `GET /api/v1/health`

### 5.3 Real-Time Channels

- `WS /ws/logs`
- `WS /ws/anomalies`
- `WS /ws/metrics`

### 5.4 Processing Responsibilities

- Stream worker:
  - consumes `logs.raw`
  - validates/parses events
  - computes event/window features
  - runs Isolation Forest + rules
  - writes anomalies, updates Redis counters, indexes enriched logs
  - publishes real-time events to WebSocket broadcaster

- Batch worker:
  - runs every 15 minutes
  - computes service-level aggregates with PySpark jobs
  - runs LSTM drift detection
  - updates batch summaries and invalidates Redis batch cache
  - executes daily retraining jobs

- Agent worker:
  - triggers on HIGH/CRITICAL anomalies
  - uses tools: log search, metrics lookup, anomaly history, runbook retrieval, topology context
  - stores structured RCA report and notifies frontend

## 6. Frontend Design (Single React Folder)

```text
frontend/src/
  pages/
    LiveLogs/
    AnomalyTimeline/
    Metrics/
    BatchAnalytics/
    AgentConsole/
  components/
  hooks/
  store/
  api/
```

UI requirements:
- Near real-time live stream rendering
- Drill-down from anomaly list to anomaly detail and RCA
- Time-range filtering and service-level filtering
- Batch trend visualizations and job status
- Agent console for manual RCA trigger and chat-style queries

## 7. Data Model (Essential Tables)

### PostgreSQL
- `anomalies`
- `rca_reports`
- `batch_runs`
- `services`

### Elasticsearch index
- `logs_enriched` with fields for timestamp, service, level, message, network, http, anomaly metadata

### Redis keys
- recent anomalies buffer
- live metric counters
- batch summary cache

## 8. Single-Repo Directory Structure

```text
logpulse/
  README.md
  plan.md
  plan-execution.md
  .env.example
  docker-compose.yml

  backend/
    app/
      main.py
      api/
      ws/
      ingestion/
      stream/
      batch/
      ml/
      agent/
      storage/
      core/
    tests/
    migrations/
    requirements.txt
    Dockerfile

  frontend/
    package.json
    vite.config.ts
    src/
      pages/
      components/
      hooks/
      store/
      api/

  infra/
    k8s/
    monitoring/

  docs/
    api.md
    runbook.md
    adr.md
```

## 9. Delivery Phases (High-Level)

### Phase 1 - Foundation
- Create monorepo baseline with backend + frontend + infra folders
- Add local Docker Compose for Kafka, Redis, Postgres, Elasticsearch, backend, frontend
- Set up backend project skeleton and frontend shell

### Phase 2 - Real-Time Pipeline
- Implement normalized log schema and ingestion adapters
- Implement stream worker with feature engineering
- Integrate Isolation Forest inference + rule checks
- Publish anomalies to DB + WebSocket

### Phase 3 - Batch Analytics and ML
- Implement 15-minute PySpark batch aggregation
- Implement LSTM drift detection path
- Add retraining workflow and model versioning

### Phase 4 - AI RCA Agent
- Implement agent worker and tool interfaces
- Add RCA report schema and persistence
- Add API and UI flow for RCA view and manual trigger

### Phase 5 - Dashboard Completion
- Build all five dashboard modules
- Add filtering, drill-down, and timeline interactions
- Tune WebSocket handling and UI state

### Phase 6 - Hardening
- Add unit/integration/load tests
- Add monitoring dashboards and alerts
- Validate KPI targets and release checklist

## 10. Success Criteria

Functional:
- All original capabilities are available in the single-repo architecture
- API, stream, batch, and AI flows run from one backend codebase
- Frontend modules are available from one React app

Performance:
- Stream anomaly detection P99 under 5 seconds
- API latency P95 under 100 ms for common dashboard queries
- WebSocket update lag under 500 ms in local performance tests
- Batch windows complete within schedule

Quality:
- Detection F1 targets remain aligned with previous plan expectations
- RCA reports are actionable and stored with traceability
- Core end-to-end flows pass automated tests

## 11. Risks and Mitigations

- Risk: single repo becomes hard to navigate
  - Mitigation: strict module boundaries under backend/app and frontend/src

- Risk: mixed workloads in backend runtime
  - Mitigation: separate process modes and autoscaling per mode

- Risk: model drift and stale thresholds
  - Mitigation: scheduled retraining, threshold review, and offline evaluation set

- Risk: LLM output quality variance
  - Mitigation: tool-grounded prompts, schema validation, and human approval for remediation

## 12. Final Direction

LogPulse will move from a distributed multi-folder architecture plan to a clean single-repo design:
- one backend folder for all Python responsibilities
- one frontend folder for all React UI responsibilities
- feature parity preserved across real-time analytics, batch intelligence, and AI-assisted RCA
