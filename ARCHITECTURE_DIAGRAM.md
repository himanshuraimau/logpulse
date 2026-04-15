# LogPulse RTBDA Architecture Diagram

This document maps the current LogPulse implementation as a real-time big data analytics (RTBDA) system.

## 1) Overall Architecture

```mermaid
flowchart LR
    %% Clients
    U[Operator / Analyst]

    %% Frontend
    subgraph FE[Frontend - Bun + React + Vite]
        FE_PAGES[Dashboard Pages\nLive Logs\nAnomaly Timeline\nMetrics\nBatch\nAgent Console]
        FE_HOOKS[React Query + Hooks\nPolling + Mutations]
        FE_WS[WebSocket Clients\n/ws/logs\n/ws/anomalies\n/ws/metrics]
    end

    %% Backend API
    subgraph API[Backend API - FastAPI]
        API_REST[REST Routers\n/api/v1/health\n/api/v1/logs/*\n/api/v1/anomalies*\n/api/v1/metrics/*\n/api/v1/batch/*\n/api/v1/agent/*]
        API_WS[WebSocket Router\n/ws/logs\n/ws/anomalies\n/ws/metrics]
        PIPE[Stream Pipeline Service\nEvent buffers\nsearch\nrecent\nmetrics]
    end

    %% Streaming + ML
    subgraph STREAM[Streaming + Detection]
        GEN[Synthetic Log Generator\nscenario-based events]
        ENRICH[Detection Enrichment\nIsolation Forest + Rules]
        PUB[Kafka Publisher]
        CONSUMER[Kafka Consumer Worker\nmode=stream]
    end

    %% Agent
    subgraph AGENT[RCA Agent]
        QUEUE[RCA Queue\nrca_reports status=queued/running]
        WORKER[Agent Worker\nthread / mode=agent]
        ORCH[LangChain Orchestrator\nTool calls + JSON output]
        LLM[LLM Providers\nGemini primary\nOpenAI fallback]
    end

    %% Batch
    subgraph BATCH[Batch Analytics]
        SCHED[Batch Scheduler\nrun once or loop]
        JOB[Aggregate Job\nPySpark preferred\nPython fallback]
    end

    %% Data + Infra
    subgraph DATA[State and Infrastructure]
        PG[(PostgreSQL\nraw_log_events\nbatch_runs\nrca_reports)]
        KAFKA[(Kafka topic\nlogs.raw)]
        REDIS[(Redis - provisioned)]
        ES[(Elasticsearch - provisioned)]
        ZK[(Zookeeper)]
    end

    U --> FE_PAGES
    FE_PAGES --> FE_HOOKS
    FE_HOOKS --> API_REST
    FE_WS --> API_WS
    API_WS --> PIPE

    API_REST --> GEN
    GEN --> ENRICH
    ENRICH --> PG
    ENRICH --> PIPE
    ENRICH --> PUB
    PUB --> KAFKA

    CONSUMER --> KAFKA
    CONSUMER --> ENRICH
    CONSUMER --> PG
    CONSUMER --> PIPE

    API_REST --> SCHED
    SCHED --> JOB
    JOB --> PIPE
    JOB --> PG

    API_REST --> QUEUE
    QUEUE --> PG
    WORKER --> QUEUE
    WORKER --> ORCH
    ORCH --> LLM
    ORCH --> PIPE
    ORCH --> PG

    KAFKA --- ZK
    API_REST --- REDIS
    API_REST --- ES
```

## 2) Docker Compose Runtime Topology

```mermaid
flowchart TB
    subgraph HOST[Docker Compose Stack]
        FE[frontend\nBun dev server\n:5173]
        API[backend\nFastAPI\n:8000]
        STRM[backend-stream\nKafka consume loop]
        BATCH[backend-batch\nprofile=batch]

        K[(kafka\n:9092)]
        Z[(zookeeper\n:2181)]
        PG[(postgres\nhost:5434)]
        R[(redis\nhost:6380)]
        E[(elasticsearch\n:9200)]
    end

    FE -->|REST + WS| API
    API --> PG
    API --> K
    API --> R
    API --> E

    STRM --> K
    STRM --> PG

    BATCH --> PG

    K --> Z
```

## 3) Real-Time Stream Path (How Logs Flow)

```mermaid
sequenceDiagram
    participant User as Operator (Live Logs page)
    participant UI as React Frontend
    participant API as FastAPI /logs/generate
    participant Gen as Log Generator
    participant Detect as Detection Enrichment
    participant DB as PostgreSQL raw_log_events
    participant KP as Kafka Publisher
    participant K as Kafka logs.raw
    participant SW as Stream Worker (mode=stream)
    participant WSS as WebSocket /ws/logs + /ws/anomalies + /ws/metrics

    User->>UI: Trigger scenario generation
    UI->>API: POST /api/v1/logs/generate
    API->>Gen: generate_batch(count, scenario)
    Gen-->>API: Synthetic events

    loop for each event
        API->>Detect: enrich_event_with_detection
        Detect->>DB: Insert event payload
        Detect->>KP: publish(event)
        KP->>K: Produce to logs.raw
        API->>WSS: register_event in in-memory stream
    end

    par Background stream mode
        SW->>K: Poll consumer group
        SW->>Detect: Enrich + dedupe by event_id
        SW->>DB: Persist consumed events
        SW->>WSS: register_event for live stream
    and UI subscriptions
        UI->>WSS: Connect /ws/logs and /ws/metrics
        WSS-->>UI: Streaming logs + metrics snapshots
        UI->>WSS: Connect /ws/anomalies
        WSS-->>UI: Anomaly-only stream
    end
```

## 4) RCA Agent Workflow

```mermaid
sequenceDiagram
    participant User as Operator (Agent Console)
    participant UI as React Frontend
    participant API as FastAPI /agent/analyze
    participant DB as PostgreSQL rca_reports
    participant Worker as Agent Worker Thread
    participant Orch as RCA Orchestrator
    participant Tools as Agent Tools (logs/anomalies/metrics)
    participant LLM as Gemini with OpenAI fallback

    User->>UI: Select anomaly and queue RCA
    UI->>API: POST /api/v1/agent/analyze {event_id, context_limit}
    API->>DB: Insert report status=queued
    API-->>UI: queued + report_id

    loop worker poll interval
        Worker->>DB: Claim oldest queued -> running
        Worker->>Orch: run_rca_analysis(event_id)
        Orch->>Tools: get_target_anomaly + search logs + metrics + patterns
        Tools->>DB: Query anomaly and service context
        Orch->>LLM: Structured RCA prompt + tool outputs
        LLM-->>Orch: JSON RCA response
        Orch->>DB: Update report status=completed/failed
    end

    UI->>API: GET /api/v1/agent/reports + /agent/reports/{id} (poll)
    API-->>UI: RCA status and report payload
```

## 5) Batch Analytics Workflow

```mermaid
sequenceDiagram
    participant User as Operator (Batch page)
    participant API as FastAPI /batch/run
    participant S as Batch Scheduler
    participant J as Aggregate Job
    participant Pipe as In-memory Event Snapshot
    participant Spark as PySpark Engine
    participant Py as Python Aggregator
    participant DB as PostgreSQL batch_runs

    User->>API: POST /api/v1/batch/run
    API->>S: run_batch_once()
    S->>J: run_service_aggregate_job(window_events)
    J->>Pipe: get_recent_events_snapshot

    alt BATCH_USE_PYSPARK=true and Spark available
        J->>Spark: groupBy(service), count/anomalies/errors
        Spark-->>J: Aggregated services
    else Spark unavailable or disabled
        J->>Py: aggregate in Python
        Py-->>J: Aggregated services
    end

    J-->>S: Batch summary
    S->>DB: Persist batch_runs row
    S-->>API: Return latest summary
```

## 6) Backend Process Modes

```mermaid
flowchart LR
    ENTRY[uv run python -m app.runner] --> MODE{--mode}

    MODE -->|api| API[uvicorn app.main:app]
    MODE -->|stream| STREAM[Kafka consume loop\nconsume_from_kafka]
    MODE -->|batch| BATCH[run_batch_once or batch loop]
    MODE -->|agent| AGENT[run_agent_worker_forever]

    API --> AUTO[App lifespan initializes DB\nand starts agent worker thread]
```

## 7) API and WebSocket Surface

```mermaid
flowchart TB
    subgraph REST[/api/v1]
        H[/health]
        LOGS[/logs/scenarios\n/logs/generate\n/logs/recent\n/logs/search]
        ANOM[/anomalies\n/anomalies/recent\n/anomalies/{event_id}]
        MET[/metrics/live\n/metrics/batch]
        STREAM[/stream/status\n/stream/consume]
        BATCH[/batch/status\n/batch/run]
        AG[/agent/config\n/agent/analyze\n/agent/reports\n/agent/reports/{report_id}]
    end

    subgraph WS[WebSockets]
        WSL[/ws/logs]
        WSA[/ws/anomalies]
        WSM[/ws/metrics]
    end
```

## 8) Key Notes for RTBDA Behavior

- Real-time path is hybrid:
  - Direct generation path writes to DB and in-memory stream immediately.
  - Kafka path enables decoupled stream consumption in `backend-stream` mode.
- Frontend uses both WebSocket streaming and periodic REST polling for resilience.
- Anomaly scoring combines model score (Isolation Forest) and deterministic rules.
- RCA is asynchronous with queue semantics (`queued -> running -> completed/failed`).
- Batch analytics currently aggregates service metrics from recent in-memory events and persists run summaries.
