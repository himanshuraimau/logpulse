# LogPulse Execution Plan - Single Repo Rollout

## 1. Purpose

This document translates the simplified architecture in [plan.md](plan.md) into an implementation sequence with explicit deliverables and feature tracking.

## 2. Scope Lock

Mandatory scope for v1:
- Single repository structure
- One FastAPI backend codebase for all Python operations
- One React frontend app for all dashboard features
- Feature parity with prior plan:
  - Real-time anomaly detection
  - Batch analytics and drift detection with PySpark + LSTM
  - AI RCA generation
  - Live dashboards and log search

Out of scope for v1:
- Multi-region active-active deployment
- Autonomous remediation execution
- Advanced multi-tenant RBAC beyond basic role controls

## 3. Delivery Milestones

## Milestone 1 - Monorepo Foundation

Deliverables:
- Folder baseline: backend, frontend, infra, docs
- `docker-compose.yml` with Kafka, Redis, Postgres, Elasticsearch, backend, frontend
- Shared environment config (`.env.example`)

Done criteria:
- `docker compose up -d` starts all required services
- Backend health endpoint responds
- Frontend shell loads

## Milestone 2 - Real-Time Processing

Deliverables:
- Log schema normalization and validation
- Python synthetic log generator (scenario-based) in backend
- Kafka producer flow from generated logs -> `logs.raw`
- Kafka consumer in backend stream mode
- Kafka-to-DB stream persistence path (Postgres first)
- Isolation Forest inference + rule engine
- Writes to Postgres, Redis, Elasticsearch
- WebSocket broadcasts for logs/anomalies/metrics

Done criteria:
- Synthetic logs can be generated from backend and observed in frontend
- End-to-end path is validated: generator -> Kafka -> consumer -> Postgres
- Synthetic anomaly events are detected and visible in frontend within target latency
- Stream worker stable under sustained test load

## Milestone 3 - Batch and Model Lifecycle

Deliverables:
- 15-minute PySpark batch aggregate job
- LSTM drift detection pipeline
- Daily/weekly retraining jobs
- Batch status persistence (`batch_runs`)

Done criteria:
- Batch outputs visible via `/api/v1/metrics/batch`
- Batch run statuses and failures are traceable

## Milestone 4 - AI RCA Agent

Deliverables:
- Async agent task worker
- Tool integrations:
  - log search
  - metric lookup
  - anomaly history
  - runbook context
  - topology context
- Structured RCA report persistence in `rca_reports`
- API trigger: `POST /api/v1/agent/analyze`

Done criteria:
- HIGH/CRITICAL anomalies trigger RCA workflow
- RCA report appears in UI detail view

## Milestone 5 - Full Frontend Experience

Deliverables:
- Live Log Stream page
- Anomaly Timeline page
- Metrics Dashboard page
- Batch Analytics page
- AI Agent Console page
- Filtering, drill-down, and status updates

Done criteria:
- All pages receive live or fetched data from backend
- End-to-end flows (detect -> investigate -> RCA) are usable

## Milestone 6 - Quality and Release Readiness

Deliverables:
- Unit tests (backend + frontend)
- Integration tests for data pipeline
- Load tests for API/WebSocket/stream ingest path
- Monitoring dashboards and alert thresholds

Done criteria:
- KPI checks meet baseline targets
- Critical tests pass in CI
- Release checklist approved

## 4. Feature Preservation Checklist

- [ ] Multi-source ingestion (web/app/system/security)
- [ ] Backend Python synthetic log generator with traffic scenarios
- [ ] Kafka `logs.raw` publish path from generator
- [ ] Kafka consumer persistence into Postgres stream table
- [ ] Real-time anomaly detection (Isolation Forest + rules)
- [ ] PySpark batch analytics every 15 minutes
- [ ] LSTM temporal drift detection
- [ ] RCA agent reports with evidence
- [ ] Log search endpoint and UI integration
- [ ] Live WebSocket updates for logs/anomalies/metrics
- [ ] Dashboard modules (5 pages)
- [ ] Docker local run path
- [ ] Basic production deployment manifests

## 5. Operational KPI Targets

- Stream detection latency P99: under 5 seconds
- API latency P95: under 100 ms for common queries
- WebSocket lag: under 500 ms under expected local load
- Batch schedule adherence: all 15-minute jobs complete in window
- RCA generation P95: under 45 seconds

## 6. Risks, Owners, and Early Actions

- Risk: queue lag in peak traffic
  - Owner: backend stream
  - Early action: add consumer lag monitoring and backpressure tuning

- Risk: noisy anomaly output
  - Owner: ML pipeline
  - Early action: threshold tuning with labeled validation set

- Risk: weak RCA quality
  - Owner: AI agent
  - Early action: enforce schema validation and human review workflow

- Risk: frontend rendering lag on live stream
  - Owner: frontend
  - Early action: virtualized lists and bounded in-memory buffers

## 7. Suggested Sprint Breakdown

Sprint 1:
- Milestone 1
- Milestone 2 (core path)

Sprint 2:
- Milestone 2 (hardening)
- Milestone 3

Sprint 3:
- Milestone 4
- Milestone 5 (first three pages)

Sprint 4:
- Milestone 5 (remaining pages)
- Milestone 6

## 8. Definition of Done

The single-repo migration is complete when:
- Architecture matches [plan.md](plan.md)
- All checklist items in Section 4 are complete
- Core KPIs in Section 5 are met in test environments
- CI passes and release readiness checks are signed off
