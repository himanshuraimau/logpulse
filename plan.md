# LogPulse — Real-Time Log Analytics & Anomaly Detection Platform

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Component Design](#5-component-design)
   - 5.1 [Log Ingestion Layer — Apache Kafka](#51-log-ingestion-layer--apache-kafka)
   - 5.2 [Stream Processing Layer — Speed Layer](#52-stream-processing-layer--speed-layer)
   - 5.3 [Batch Processing Layer — Batch Layer](#53-batch-processing-layer--batch-layer)
   - 5.4 [Serving Layer](#54-serving-layer)
   - 5.5 [AI Agent — LLM-Powered Root Cause Analysis](#55-ai-agent--llm-powered-root-cause-analysis)
   - 5.6 [React Dashboard — Frontend](#56-react-dashboard--frontend)
6. [Data Flow & Pipeline](#6-data-flow--pipeline)
7. [Anomaly Detection Models](#7-anomaly-detection-models)
8. [AI Agent Design](#8-ai-agent-design)
9. [Database Schema](#9-database-schema)
10. [API Reference](#10-api-reference)
11. [Log Format Specification](#11-log-format-specification)
12. [Deployment Architecture](#12-deployment-architecture)
13. [Project Directory Structure](#13-project-directory-structure)
14. [Setup & Installation](#14-setup--installation)
15. [Evaluation & Testing Strategy](#15-evaluation--testing-strategy)
16. [Expected Outcomes & KPIs](#16-expected-outcomes--kpis)
17. [Limitations & Future Scope](#17-limitations--future-scope)
18. [References](#18-references)

---

## 1. Project Overview

**LogPulse** is a production-grade, real-time log analytics and anomaly detection platform built on **Lambda Architecture**. It ingests high-velocity, multi-source log streams from modern distributed systems — web servers, microservices, system infrastructure, and security events — and applies a dual-layer machine learning pipeline to detect anomalies at both stream speed and batch depth.

When a threat is confirmed, an **LLM-powered AI agent** automatically performs root cause analysis and generates human-readable remediation playbooks. A **React live dashboard** gives operations teams full situational awareness — real-time metrics, anomaly timelines, batch analytics, and AI-generated insights — in a single pane of glass.

### Why LogPulse?

Modern infrastructure generates **terabytes of log data per day**. At this scale:

- Manual log review is operationally impossible
- Traditional threshold-based alerts generate excessive noise
- Slowly evolving threats (memory leaks, credential stuffing) evade real-time rules
- Engineers spend hours manually diagnosing alerts instead of fixing problems

LogPulse solves each of these pain points with a composable, scalable, and explainable architecture grounded in industry best practices.

---

## 2. Problem Statement

### 2.1 The Scale Problem

Modern distributed systems — cloud microservices, containerized workloads, CDN edge nodes — each emit thousands of log lines per second. A mid-sized production cluster can generate **500 GB to 2 TB of raw log data per day**. The Volume, Velocity, and Variety (the 3Vs of Big Data) of this data make it impossible to store, query, or analyze with conventional tools.

### 2.2 The Detection Gap

Rule-based monitoring (static thresholds, regex patterns) catches only well-understood attack signatures. Advanced threats are adaptive:

| Threat Type | Why Rules Fail |
|---|---|
| **DDoS Attacks** | Distributed across thousands of IPs; no single source triggers threshold |
| **Brute-Force Logins** | Slow-rate attacks spread over hours evade per-minute rate limits |
| **Memory Leaks** | Gradual drift invisible in short time windows |
| **Credential Stuffing** | Low request rates with rotating user-agents |
| **Service Cascades** | Multi-hop failures don't map to any single rule |

### 2.3 The Diagnosis Gap

Even when an alert fires, the engineer still needs to:
1. Correlate the alert with logs across multiple services
2. Identify the root cause (not just the symptom)
3. Determine the blast radius
4. Decide on and execute a remediation action

This typically takes **30–90 minutes per incident**. For a P1 outage, that is unacceptable.

### 2.4 Solution Positioning

LogPulse closes both gaps:
- **Detection Gap** → Dual-layer ML (Isolation Forest + LSTM) catches both known and novel anomalies
- **Diagnosis Gap** → LLM AI agent generates root cause hypotheses and remediation steps within seconds

---

## 3. System Architecture

LogPulse is built on the **Lambda Architecture** pattern, which provides both low-latency real-time processing and high-accuracy batch processing over the same data stream.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          LOG SOURCES (Producers)                         │
│   Web Servers (Nginx/Apache)  │  App Microservices  │  System (syslog)  │
│                               │  Security (auth.log) │  Custom Apps      │
└───────────────────────┬───────────────────────────────────────────────────┘
                        │  Raw Log Events (JSON)
                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     INGESTION LAYER — Apache Kafka                       │
│                                                                          │
│  Topic: logs.web   │  Topic: logs.app   │  Topic: logs.system           │
│  Topic: logs.security           │  Topic: logs.raw (unified)            │
│                                                                          │
│  Kafka Connect (File / Fluentd / Logstash Source Connectors)             │
│  Zookeeper / KRaft for cluster coordination                              │
└────────────┬──────────────────────────────────┬───────────────────────────┘
             │                                  │
    ┌────────▼────────┐                ┌────────▼────────┐
    │  SPEED LAYER    │                │  BATCH LAYER    │
    │  (Stream Proc.) │                │  (Batch Proc.)  │
    │                 │                │                 │
    │  Apache Flink   │                │  Apache Spark   │
    │  or Spark       │                │  (PySpark)      │
    │  Streaming      │                │                 │
    │                 │                │  HDFS / S3      │
    │  Isolation      │                │  Data Lake      │
    │  Forest Model   │                │                 │
    │  + Rule Engine  │                │  LSTM Model     │
    │                 │                │  Batch Jobs     │
    └────────┬────────┘                └────────┬────────┘
             │                                  │
             │  Anomaly Events                  │  Batch Summaries
             └───────────────┬──────────────────┘
                             ▼
              ┌──────────────────────────┐
              │      SERVING LAYER       │
              │                          │
              │  Redis (real-time cache) │
              │  PostgreSQL (anomaly DB) │
              │  Elasticsearch (log idx) │
              │                          │
              │  FastAPI Backend         │
              │  WebSocket Server        │
              └──────────┬───────────────┘
                         │
             ┌───────────▼──────────────┐
             │       AI AGENT           │
             │                          │
             │  LLM (Claude / GPT-4o)   │
             │  LangChain Agent         │
             │  Tool: Log Search        │
             │  Tool: Metric Lookup     │
             │  Tool: RCA Generator     │
             │  Tool: Remediation KB    │
             └───────────┬──────────────┘
                         │
             ┌───────────▼──────────────┐
             │    REACT DASHBOARD       │
             │                          │
             │  Live Log Stream         │
             │  Anomaly Timeline        │
             │  Batch Analytics         │
             │  AI Agent Chat           │
             │  Metric Heatmaps         │
             └──────────────────────────┘
```

### 3.1 Lambda Architecture Layers

| Layer | Purpose | Latency | Tool |
|---|---|---|---|
| **Speed Layer** | Real-time stream processing, immediate anomaly detection | < 2 seconds | Spark Streaming / Flink |
| **Batch Layer** | Reprocesses historical data, trains models, computes accurate aggregates | Minutes–Hours | Apache Spark + HDFS |
| **Serving Layer** | Merges speed and batch views, serves queries from dashboard | < 100ms | Redis + PostgreSQL + FastAPI |

---

## 4. Technology Stack

### 4.1 Core Infrastructure

| Component | Technology | Version | Purpose |
|---|---|---|---|
| **Message Broker** | Apache Kafka | 3.7.x | High-throughput log ingestion |
| **Stream Processing** | Apache Spark Structured Streaming | 3.5.x | Real-time anomaly detection pipeline |
| **Batch Processing** | Apache Spark (PySpark) | 3.5.x | Historical reprocessing, model training |
| **Distributed Storage** | Apache HDFS / AWS S3 | — | Raw log data lake |
| **Cluster Manager** | Apache YARN / Kubernetes | — | Resource management |

### 4.2 Machine Learning & AI

| Component | Technology | Purpose |
|---|---|---|
| **Stream Anomaly Detection** | Scikit-learn — Isolation Forest | Unsupervised, real-time outlier detection |
| **Batch Temporal Modeling** | TensorFlow / Keras — LSTM | Time-series baseline & drift detection |
| **Model Serving** | MLflow + FastAPI | Model registry, versioning, serving |
| **AI Agent Framework** | LangChain | Orchestration of LLM tools |
| **LLM** | Anthropic Claude 3.5 / OpenAI GPT-4o | Root cause analysis & remediation |
| **Vector Store** | ChromaDB / FAISS | Embedding storage for log RAG context |
| **Embeddings** | sentence-transformers | Log event semantic embedding |

### 4.3 Data Storage

| Store | Technology | Purpose |
|---|---|---|
| **Time-Series Metrics** | InfluxDB / TimescaleDB | System metrics, throughput telemetry |
| **Anomaly Records** | PostgreSQL | Structured anomaly event persistence |
| **Real-Time Cache** | Redis | Live dashboard state, recent anomaly buffer |
| **Log Index & Search** | Elasticsearch 8.x | Full-text log search, aggregations |
| **Log Visualization** | Kibana | Elasticsearch companion dashboard |

### 4.4 Backend & API

| Component | Technology | Purpose |
|---|---|---|
| **REST API** | FastAPI (Python) | Serving dashboard data, AI agent API |
| **WebSocket Server** | FastAPI WebSockets | Real-time log streaming to dashboard |
| **Task Queue** | Celery + Redis | Async AI agent invocation |
| **Log Shipper** | Fluentd / Logstash | Log collection from sources → Kafka |

### 4.5 Frontend

| Component | Technology | Purpose |
|---|---|---|
| **UI Framework** | React 18 + TypeScript | Live dashboard SPA |
| **State Management** | Zustand | Lightweight global state |
| **Data Fetching** | React Query (TanStack) | Server state, polling, caching |
| **Charting** | Recharts + D3.js | Metric graphs, anomaly timelines |
| **UI Components** | shadcn/ui + Tailwind CSS | Design system |
| **Real-Time Updates** | native WebSocket API | Live log stream feed |
| **Build Tool** | Vite | Fast bundling |

### 4.6 DevOps & Observability

| Component | Technology | Purpose |
|---|---|---|
| **Containerization** | Docker + Docker Compose | Local development environment |
| **Orchestration** | Kubernetes (K8s) | Production deployment |
| **CI/CD** | GitHub Actions | Automated testing, Docker builds |
| **Monitoring** | Prometheus + Grafana | Platform self-monitoring |
| **Logging (Meta)** | ELK Stack | Logs of the logging platform |
| **Secrets** | HashiCorp Vault / K8s Secrets | API keys, DB credentials |

---

## 5. Component Design

### 5.1 Log Ingestion Layer — Apache Kafka

#### Kafka Topic Design

```
logs.web.nginx          ← Nginx access & error logs
logs.web.apache         ← Apache HTTPD logs
logs.app.{service}      ← Per-microservice application logs
logs.system.syslog      ← Linux syslog, kernel events
logs.security.auth      ← /var/log/auth.log, SSH events
logs.raw                ← Unified raw stream (all sources merged)
anomalies.stream        ← Anomaly events from Speed Layer
anomalies.batch         ← Anomaly summaries from Batch Layer
ai.rca                  ← AI agent root cause reports
```

#### Kafka Configuration

```properties
# Broker settings for high throughput
num.partitions=12
replication.factor=3
log.retention.hours=168        # 7 days raw log retention
log.segment.bytes=1073741824   # 1 GB segments
compression.type=lz4           # LZ4 compression for speed
```

#### Kafka Producer (Log Generator / Shipper)

Each log source runs a **Kafka Producer** that:
1. Serializes log lines into a standardized **JSON envelope** (see Section 11)
2. Applies **LZ4 compression** before sending
3. Uses **keyed partitioning** by `source_host` for ordered processing per host
4. Batches messages for throughput (linger.ms=5, batch.size=64KB)

#### Kafka Connect Integration

For production sources, **Kafka Connect** pulls logs without custom code:

```yaml
# Fluentd → Kafka connector config example
connector.class: io.confluent.connect.kafka.KafkaSourceConnector
tasks.max: 4
file.path: /var/log/nginx/access.log
kafka.topic: logs.web.nginx
```

---

### 5.2 Stream Processing Layer — Speed Layer

**Technology:** Apache Spark Structured Streaming

The Speed Layer subscribes to `logs.raw`, processes each micro-batch (every 1–2 seconds), and applies the anomaly detection pipeline in real time.

#### Stream Processing Pipeline

```
Kafka Consumer
    │
    ▼
Schema Validation & Parsing
    │  - Deserialize JSON envelope
    │  - Validate required fields
    │  - Parse timestamp, extract IP, method, status, etc.
    ▼
Feature Engineering (per log event)
    │  - Request rate per IP (sliding window, 60s)
    │  - Error rate per service (rolling 5-min)
    │  - Bytes transferred anomaly score
    │  - Login failure rate per user
    │  - Time-of-day feature (hour, day_of_week)
    ▼
Isolation Forest Inference
    │  - Load pre-trained model from MLflow registry
    │  - Score each event: anomaly_score ∈ [-1, +1]
    │  - Flag events where score < threshold (-0.15)
    ▼
Rule Engine (Secondary Filter)
    │  - DDoS rule: > 500 req/s from single IP
    │  - Brute-force rule: > 10 failed logins / user / min
    │  - 5xx spike: > 30% error rate in 30s window
    │  - Port scan: > 20 distinct ports in 10s
    ▼
Anomaly Event Publisher
    │  - Write confirmed anomalies → anomalies.stream Kafka topic
    │  - Write enriched events → Elasticsearch (logs.enriched index)
    │  - Update Redis counters & recent anomaly buffer
    ▼
WebSocket Broadcast → React Dashboard
```

#### Spark Streaming Micro-Batch Config

```python
spark = SparkSession.builder \
    .appName("LogPulse-SpeedLayer") \
    .config("spark.streaming.kafka.maxRatePerPartition", "10000") \
    .config("spark.sql.streaming.checkpointLocation", "/tmp/checkpoints") \
    .getOrCreate()

df = spark.readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", KAFKA_BROKERS) \
    .option("subscribe", "logs.raw") \
    .option("startingOffsets", "latest") \
    .option("maxOffsetsPerTrigger", 100000) \
    .load()

query = enriched_df.writeStream \
    .trigger(processingTime="2 seconds") \
    .outputMode("append") \
    .foreachBatch(process_batch) \
    .start()
```

---

### 5.3 Batch Processing Layer — Batch Layer

**Technology:** Apache Spark (PySpark) scheduled on YARN / Kubernetes

The Batch Layer runs on a **15-minute schedule** (configurable). It reprocesses the last N hours of raw logs from HDFS, computes accurate aggregate metrics, retrains the LSTM model, and writes results to the serving layer.

#### Batch Jobs

| Job | Schedule | Description |
|---|---|---|
| `batch_aggregate` | Every 15 min | Compute per-service error rates, throughput, latency P99 |
| `lstm_inference` | Every 15 min | Run LSTM on 24-hour sliding window for drift detection |
| `model_retrain` | Daily 02:00 UTC | Retrain Isolation Forest and LSTM on fresh labeled data |
| `report_generator` | Hourly | Generate anomaly summary reports → PostgreSQL |
| `data_compaction` | Daily | Compact HDFS Parquet files, apply retention policies |

#### LSTM Batch Inference Pipeline

```
HDFS Raw Logs (last 24h)
    │
    ▼
PySpark Batch Read (Parquet)
    │
    ▼
Time-Series Feature Aggregation
    │  - Aggregate to 1-minute buckets per service
    │  - Features: req_count, error_count, avg_latency,
    │    unique_ips, bytes_in, bytes_out, cpu_pct, mem_pct
    ▼
LSTM Sliding Window (60-step lookback → 1-step forecast)
    │  - Load model from MLflow registry
    │  - Compute reconstruction error per time step
    │  - Flag steps where error > μ + 3σ (dynamic threshold)
    ▼
Anomaly Batch Records → PostgreSQL
    │
    ▼
Batch View Update → Serving Layer (Redis cache invalidation)
```

---

### 5.4 Serving Layer

The Serving Layer merges real-time (Speed) views and batch views into a unified query interface consumed by the dashboard.

#### Redis Cache Schema

```
# Real-time anomaly ring buffer (last 100 anomalies)
KEY: logpulse:anomalies:recent   TYPE: List (JSON)   TTL: 1h

# Per-service metric counters (updated every 2s by speed layer)
KEY: logpulse:metrics:{service}:req_rate   TYPE: String (float)
KEY: logpulse:metrics:{service}:error_rate TYPE: String (float)

# Dashboard live feed (recent 500 log events)
KEY: logpulse:logs:live            TYPE: List (JSON)    TTL: 5min

# Batch summary cache (invalidated every 15min)
KEY: logpulse:batch:summary:{ts}   TYPE: Hash           TTL: 20min
```

#### FastAPI Backend

The backend exposes REST endpoints and WebSocket connections consumed by the React dashboard and the AI agent.

```
GET  /api/v1/anomalies          ← Paginated anomaly history (PostgreSQL)
GET  /api/v1/anomalies/{id}     ← Single anomaly detail with AI report
GET  /api/v1/metrics/live       ← Current system metrics (Redis)
GET  /api/v1/metrics/batch      ← Batch analytics summary
GET  /api/v1/logs/search        ← Full-text log search (Elasticsearch)
POST /api/v1/agent/analyze      ← Trigger AI agent for anomaly {id}
GET  /api/v1/health             ← Platform health check

WS   /ws/logs                   ← Real-time log stream (WebSocket)
WS   /ws/anomalies              ← Real-time anomaly event stream
WS   /ws/metrics                ← Real-time metric updates (2s interval)
```

---

### 5.5 AI Agent — LLM-Powered Root Cause Analysis

#### Agent Architecture

The AI Agent is a **LangChain ReAct Agent** backed by an LLM (Claude 3.5 Sonnet / GPT-4o). It is triggered automatically when the stream processing layer confirms an anomaly with severity `HIGH` or `CRITICAL`.

```
Anomaly Event (from anomalies.stream)
    │
    ▼
Agent Orchestrator (LangChain ReAct)
    │
    ├── Tool: search_logs(query, time_range, service)
    │       └── Queries Elasticsearch for relevant log context
    │
    ├── Tool: get_metrics(service, metric, time_range)
    │       └── Fetches metric time-series from InfluxDB
    │
    ├── Tool: get_anomaly_history(service, days=7)
    │       └── Retrieves past anomalies for this service
    │
    ├── Tool: search_remediation_kb(anomaly_type)
    │       └── RAG search over internal runbooks (ChromaDB)
    │
    └── Tool: get_service_topology()
            └── Returns service dependency graph (for cascade analysis)
    │
    ▼
LLM Synthesis
    │  - Reasoning over tool outputs
    │  - Hypothesize root cause (chain of thought)
    │  - Assess blast radius & affected services
    │  - Generate step-by-step remediation playbook
    ▼
RCA Report (Structured JSON + Markdown)
    │
    ▼
anomalies.rca Kafka topic → PostgreSQL → Dashboard
```

#### RCA Report Schema

```json
{
  "anomaly_id": "uuid",
  "generated_at": "ISO8601",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "anomaly_type": "DDoS | BruteForce | MemoryLeak | ServiceFailure | ...",
  "summary": "One-sentence summary of the incident",
  "root_cause": {
    "hypothesis": "Most likely cause narrative",
    "confidence": 0.87,
    "supporting_evidence": ["log snippet 1", "metric trend 2"]
  },
  "blast_radius": {
    "affected_services": ["api-gateway", "auth-service"],
    "estimated_users_impacted": 12400,
    "data_at_risk": false
  },
  "remediation_steps": [
    {
      "step": 1,
      "action": "Block IP range 192.168.x.x/24 at load balancer",
      "command": "kubectl exec -it ingress-nginx -- nginx -s reload",
      "priority": "IMMEDIATE"
    }
  ],
  "prevention_recommendations": ["Enable rate limiting at API gateway layer"],
  "agent_reasoning_trace": "Full ReAct chain for auditing"
}
```

---

### 5.6 React Dashboard — Frontend

#### Dashboard Views

**1. Live Log Stream**
- Virtualized scrolling log table (100K+ rows rendered efficiently via `react-virtual`)
- Color-coded by severity (DEBUG / INFO / WARN / ERROR / CRITICAL)
- Inline anomaly badges on flagged log lines
- Real-time filter by service, log level, IP, time range

**2. Anomaly Timeline**
- Recharts `ComposedChart` — log throughput bars + anomaly spike markers
- Click anomaly marker → slide-over panel with AI RCA report
- Severity heatmap calendar (GitHub contribution-style)

**3. Metrics Dashboard**
- Per-service cards: request rate, error rate, P99 latency, active connections
- 6-hour sparklines per metric (updates every 2s via WebSocket)
- System resources: CPU, memory, disk I/O across all hosts

**4. Batch Analytics**
- Last 7-day anomaly trend per service
- Top anomalous IP addresses
- LSTM model drift indicators
- Batch job status tracker

**5. AI Agent Console**
- Chat interface for querying the AI agent ad-hoc
- Structured RCA report renderer
- Remediation checklist with completion tracking
- Agent reasoning trace expandable accordion

---

## 6. Data Flow & Pipeline

### 6.1 End-to-End Event Lifecycle

```
T+0ms    → Log event generated by source application
T+50ms   → Fluentd/Logstash ships to Kafka producer
T+100ms  → Event lands in logs.raw Kafka topic
T+2000ms → Spark Streaming micro-batch picks up event
T+2100ms → Feature engineering & Isolation Forest scoring
T+2200ms → Anomaly confirmed → published to anomalies.stream
T+2300ms → Redis cache updated, WebSocket broadcast fired
T+2350ms → React Dashboard receives anomaly event
T+3000ms → AI Agent triggered (async via Celery)
T+8000ms → LLM completes RCA report
T+8100ms → RCA stored in PostgreSQL, broadcast to dashboard

Batch (every 15 min):
T+0min   → Spark batch job reads HDFS parquet (last 24h)
T+3min   → LSTM inference completes on time-series features
T+4min   → Batch anomaly records written to PostgreSQL
T+4min   → Redis batch view cache invalidated & refreshed
```

### 6.2 Log Volume Estimates

| Source | Events/sec (normal) | Events/sec (spike) | Daily Volume |
|---|---|---|---|
| Nginx web logs | 5,000 | 50,000 | ~50 GB |
| App microservices (×10) | 2,000 | 20,000 | ~20 GB |
| System syslog | 500 | 2,000 | ~5 GB |
| Security / auth | 200 | 5,000 | ~2 GB |
| **Total** | **~8,000** | **~80,000** | **~77 GB** |

Kafka's theoretical throughput ceiling per partition at 3-broker cluster: **~100 MB/s**. At 12 partitions, total ingest capacity exceeds **1.2 GB/s** — well above projected peak.

---

## 7. Anomaly Detection Models

### 7.1 Isolation Forest (Stream Layer)

**Algorithm:** Isolation Forest (Liu et al., 2008) — ensemble of random isolation trees.

**Why Isolation Forest for streaming?**
- O(n log n) training, O(log n) inference — fast enough for per-event scoring
- Naturally handles high-dimensional feature spaces without normalization assumptions
- No labeled training data required (fully unsupervised)
- Robust to feature scaling variance in heterogeneous log sources

**Feature Vector (per log event):**

```python
features = {
    "request_rate_60s":      float,   # Requests/sec from source IP in last 60s
    "error_rate_5m":         float,   # Error % for source service in last 5min
    "bytes_transferred":     float,   # Request/response body size
    "login_failures_1m":     int,     # Failed auth attempts per user/min
    "unique_endpoints_10s":  int,     # Distinct URLs from IP in 10s
    "status_code_class":     int,     # 2xx=0, 3xx=1, 4xx=2, 5xx=3
    "hour_of_day":           int,     # 0-23
    "day_of_week":           int,     # 0-6
    "payload_entropy":       float,   # Shannon entropy of request body
    "response_time_ms":      float,   # Endpoint response latency
}
```

**Model Hyperparameters:**

```python
IsolationForest(
    n_estimators=200,        # Number of trees
    max_samples=512,         # Subsampling per tree
    contamination=0.02,      # Expected 2% anomaly rate
    max_features=1.0,        # Use all features
    random_state=42,
    n_jobs=-1
)
```

**Training:** Initial training on 2 weeks of historical logs. Retrained weekly via the `model_retrain` batch job. Model artifacts stored in **MLflow Model Registry** with staged promotion (Staging → Production).

**Threshold Tuning:** The decision threshold is tuned on a labeled holdout set using F1-score optimization. Default: `anomaly_score < -0.15`.

---

### 7.2 LSTM Time-Series Model (Batch Layer)

**Architecture:** Sequence-to-Sequence LSTM autoencoder for temporal anomaly detection via **reconstruction error**.

**Why LSTM for batch?**
- Captures long-range temporal dependencies (memory leaks evolve over hours)
- Autoencoder approach allows unsupervised training — no labeled anomalies needed
- Reconstruction error provides a continuous anomaly severity score
- Well-suited for multivariate time-series (multiple metrics per service)

**Model Architecture:**

```
Input: (batch_size, 60, n_features)   ← 60-minute lookback window
    │
    ├── LSTM Encoder
    │     LSTM(128, return_sequences=True)
    │     Dropout(0.2)
    │     LSTM(64, return_sequences=False)
    │
    ├── Latent Representation: Dense(32)
    │
    ├── LSTM Decoder
    │     RepeatVector(60)
    │     LSTM(64, return_sequences=True)
    │     Dropout(0.2)
    │     LSTM(128, return_sequences=True)
    │
    └── TimeDistributed(Dense(n_features))
Output: (batch_size, 60, n_features)  ← Reconstructed sequence

Loss: Mean Squared Error (MSE)
Anomaly Score: MAE(input_sequence, reconstructed_sequence) per timestep
Anomaly Threshold: μ + 3σ (computed on validation set reconstruction errors)
```

**Input Features (1-minute buckets per service):**

```python
time_series_features = [
    "req_count",          # Total requests in minute
    "error_count",        # 4xx + 5xx count
    "avg_latency_ms",     # Mean response time
    "p99_latency_ms",     # 99th percentile latency
    "unique_ips",         # Distinct client IPs
    "bytes_in",           # Inbound bytes
    "bytes_out",          # Outbound bytes
    "cpu_pct",            # CPU utilization %
    "mem_pct",            # Memory utilization %
    "active_connections", # Concurrent connections
]
```

---

### 7.3 Rule-Based Engine

Complementary to ML models — fast, interpretable rules for high-confidence known signatures:

```python
rules = [
    # DDoS Detection
    Rule(
        name="DDoS_IP_Burst",
        condition=lambda w: w.req_per_sec_from_ip > 500,
        severity="CRITICAL",
        message="DDoS burst: {ip} at {rate} req/s"
    ),
    # Brute Force
    Rule(
        name="BruteForce_Login",
        condition=lambda w: w.failed_logins_per_user_per_min > 10,
        severity="HIGH",
        message="Brute force: {user} — {count} failures in 1 min"
    ),
    # Error Spike
    Rule(
        name="5xx_Spike",
        condition=lambda w: w.error_rate_30s > 0.30,
        severity="HIGH",
        message="Error spike: {service} at {rate:.0%} 5xx in 30s"
    ),
    # Port Scan
    Rule(
        name="Port_Scan",
        condition=lambda w: w.distinct_ports_10s > 20,
        severity="MEDIUM",
        message="Port scan: {ip} probed {count} ports in 10s"
    ),
]
```

---

## 8. AI Agent Design

### 8.1 Agent Prompt Engineering

**System Prompt:**

```
You are LogPulse AI, an expert site reliability engineer and security analyst.
You specialize in diagnosing anomalies in distributed system logs.

When given an anomaly event, you must:
1. Use your available tools to gather supporting evidence
2. Reason step-by-step about the root cause
3. Assess the severity and blast radius
4. Provide a prioritized, actionable remediation plan
5. Recommend preventive measures

Always cite specific log evidence from your tool calls.
Format your final report as structured JSON per the RCA schema.
Be concise but thorough. Avoid speculation without evidence.
```

### 8.2 Agent Tool Definitions

```python
tools = [
    Tool(
        name="search_logs",
        description="Search raw logs in Elasticsearch. Use for finding log patterns, error messages, or specific events around the anomaly time.",
        func=elasticsearch_search
    ),
    Tool(
        name="get_metrics",
        description="Retrieve metric time-series (CPU, memory, latency, error rate) for a service over a time range.",
        func=influxdb_metric_query
    ),
    Tool(
        name="get_anomaly_history",
        description="Look up previous anomalies for a service to detect recurrence patterns.",
        func=postgres_anomaly_history
    ),
    Tool(
        name="search_runbooks",
        description="Search the internal remediation knowledge base for procedures matching this anomaly type.",
        func=chromadb_rag_search
    ),
    Tool(
        name="get_service_topology",
        description="Get the service dependency graph to identify upstream/downstream impact.",
        func=topology_service_lookup
    ),
]
```

### 8.3 Async Agent Invocation

```python
# Celery task — runs asynchronously, won't block stream processing
@celery_app.task(bind=True, max_retries=3, soft_time_limit=60)
def run_rca_agent(self, anomaly_id: str):
    anomaly = postgres.get_anomaly(anomaly_id)
    agent = create_react_agent(llm=claude_client, tools=tools)
    result = agent.invoke({"input": build_agent_prompt(anomaly)})
    rca_report = parse_rca_output(result["output"])
    postgres.save_rca_report(anomaly_id, rca_report)
    redis.publish("rca_ready", anomaly_id)
```

---

## 9. Database Schema

### 9.1 PostgreSQL — Core Schema

```sql
-- Anomaly events
CREATE TABLE anomalies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detected_at     TIMESTAMPTZ NOT NULL,
    source          VARCHAR(50) NOT NULL,       -- 'stream' | 'batch'
    service         VARCHAR(100) NOT NULL,
    anomaly_type    VARCHAR(50) NOT NULL,
    severity        VARCHAR(20) NOT NULL,       -- CRITICAL|HIGH|MEDIUM|LOW
    anomaly_score   FLOAT NOT NULL,
    feature_vector  JSONB,
    raw_log_sample  JSONB,
    status          VARCHAR(20) DEFAULT 'OPEN', -- OPEN|INVESTIGATING|RESOLVED
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- AI RCA reports
CREATE TABLE rca_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anomaly_id      UUID REFERENCES anomalies(id),
    generated_at    TIMESTAMPTZ NOT NULL,
    summary         TEXT,
    root_cause      JSONB,
    blast_radius    JSONB,
    remediation     JSONB,
    prevention      JSONB,
    agent_trace     TEXT,
    llm_model       VARCHAR(50),
    tokens_used     INT
);

-- Batch job run history
CREATE TABLE batch_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name        VARCHAR(100),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    status          VARCHAR(20),     -- SUCCESS|FAILED|RUNNING
    records_processed BIGINT,
    anomalies_found  INT,
    error_message   TEXT
);

-- Service registry
CREATE TABLE services (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name    VARCHAR(100) UNIQUE NOT NULL,
    team_owner      VARCHAR(100),
    pagerduty_key   VARCHAR(100),
    kafka_topics    TEXT[],
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_anomalies_detected_at ON anomalies(detected_at DESC);
CREATE INDEX idx_anomalies_service ON anomalies(service);
CREATE INDEX idx_anomalies_severity ON anomalies(severity);
```

### 9.2 Elasticsearch Index Mapping

```json
{
  "mappings": {
    "properties": {
      "timestamp":       { "type": "date" },
      "host":            { "type": "keyword" },
      "service":         { "type": "keyword" },
      "level":           { "type": "keyword" },
      "message":         { "type": "text", "analyzer": "standard" },
      "source_ip":       { "type": "ip" },
      "http_method":     { "type": "keyword" },
      "http_path":       { "type": "keyword" },
      "http_status":     { "type": "integer" },
      "response_time_ms":{ "type": "float" },
      "bytes":           { "type": "long" },
      "anomaly_score":   { "type": "float" },
      "is_anomaly":      { "type": "boolean" },
      "anomaly_id":      { "type": "keyword" }
    }
  }
}
```

---

## 10. API Reference

### 10.1 Anomaly Endpoints

**`GET /api/v1/anomalies`**

Query Parameters:
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Pagination page |
| `limit` | int | 50 | Results per page |
| `severity` | string | — | Filter: CRITICAL, HIGH, MEDIUM, LOW |
| `service` | string | — | Filter by service name |
| `source` | string | — | Filter: stream, batch |
| `from` | ISO8601 | -24h | Start time |
| `to` | ISO8601 | now | End time |
| `status` | string | — | OPEN, INVESTIGATING, RESOLVED |

Response `200 OK`:
```json
{
  "total": 1423,
  "page": 1,
  "limit": 50,
  "data": [
    {
      "id": "550e8400-...",
      "detected_at": "2025-03-07T14:23:11Z",
      "service": "api-gateway",
      "anomaly_type": "DDoS",
      "severity": "CRITICAL",
      "anomaly_score": -0.82,
      "status": "INVESTIGATING",
      "has_rca": true
    }
  ]
}
```

**`GET /api/v1/anomalies/{id}`**

Returns full anomaly detail including raw log sample, feature vector, and RCA report if available.

**`POST /api/v1/agent/analyze`**

Manually trigger AI agent for a given anomaly ID.

Request body:
```json
{ "anomaly_id": "550e8400-..." }
```

Response `202 Accepted`:
```json
{ "task_id": "celery-task-uuid", "status": "queued" }
```

### 10.2 WebSocket Protocol

**`WS /ws/logs`**

Server sends newline-delimited JSON messages. Client sends filter config:

```json
// Client → Server: Set filter
{ "type": "filter", "services": ["api-gateway"], "min_level": "WARN" }

// Server → Client: Log event
{
  "type": "log",
  "data": {
    "timestamp": "2025-03-07T14:23:11.342Z",
    "service": "api-gateway",
    "level": "ERROR",
    "message": "Connection refused to auth-service:8080",
    "source_ip": "10.0.1.5",
    "is_anomaly": false
  }
}

// Server → Client: Anomaly alert
{
  "type": "anomaly",
  "data": {
    "anomaly_id": "550e8400-...",
    "severity": "CRITICAL",
    "anomaly_type": "DDoS",
    "service": "api-gateway",
    "message": "DDoS burst detected: 182.23.44.12 at 8,432 req/s"
  }
}
```

---

## 11. Log Format Specification

All log sources are normalized to a **standard JSON envelope** by the Fluentd/Logstash shipper before entering Kafka:

```json
{
  "schema_version": "1.0",
  "event_id": "uuid-v4",
  "timestamp": "2025-03-07T14:23:11.342Z",
  "received_at": "2025-03-07T14:23:11.389Z",
  "host": "prod-api-gw-01",
  "source": "web | app | system | security",
  "service": "api-gateway",
  "log_level": "DEBUG | INFO | WARN | ERROR | CRITICAL",
  "message": "Raw log message string",

  "http": {
    "method": "GET | POST | PUT | DELETE | ...",
    "path": "/api/v1/users",
    "status": 200,
    "response_time_ms": 45.2,
    "bytes_sent": 1024,
    "bytes_received": 512,
    "user_agent": "Mozilla/5.0 ...",
    "referrer": "https://..."
  },

  "network": {
    "source_ip": "203.0.113.42",
    "source_port": 54321,
    "destination_ip": "10.0.1.5",
    "destination_port": 443
  },

  "auth": {
    "user": "john.doe@example.com",
    "action": "login | logout | failed_login",
    "success": true
  },

  "process": {
    "pid": 12345,
    "name": "gunicorn",
    "thread": "worker-3"
  },

  "tags": ["production", "us-east-1"],

  "_kafka": {
    "topic": "logs.web.nginx",
    "partition": 4,
    "offset": 8823442
  }
}
```

---

## 12. Deployment Architecture

### 12.1 Local Development (Docker Compose)

```yaml
# docker-compose.yml (abbreviated)
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.6.0
  kafka:
    image: confluentinc/cp-kafka:7.6.0
    ports: ["9092:9092"]
  spark-master:
    image: bitnami/spark:3.5
  spark-worker:
    image: bitnami/spark:3.5
  elasticsearch:
    image: elasticsearch:8.13.0
    ports: ["9200:9200"]
  redis:
    image: redis:7.2-alpine
  postgres:
    image: postgres:16-alpine
  mlflow:
    image: ghcr.io/mlflow/mlflow:v2.12.2
  backend:
    build: ./backend
    ports: ["8000:8000"]
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
  log-generator:
    build: ./tools/log-generator
```

Start everything:
```bash
docker compose up -d
```

### 12.2 Production — Kubernetes

```
Namespace: logpulse-prod
│
├── StatefulSet: kafka (3 replicas, PVC: 500Gi each)
├── StatefulSet: elasticsearch (3 replicas, PVC: 1Ti each)
├── StatefulSet: postgres (1 primary + 1 replica, PVC: 200Gi)
├── StatefulSet: redis (1 primary + 2 replicas)
│
├── Deployment: spark-master (1 replica)
├── Deployment: spark-worker (3 replicas, auto-scaled)
├── Deployment: backend-api (3 replicas, HPA: CPU 70%)
├── Deployment: celery-worker (2 replicas)
│
├── CronJob: batch-aggregate (every 15min)
├── CronJob: batch-lstm (every 15min)
├── CronJob: model-retrain (daily)
│
├── ConfigMap: logpulse-config
├── Secret: logpulse-secrets (API keys, DB creds via Vault)
│
└── Ingress: logpulse-ingress (nginx-ingress)
    ├── /api/* → backend-api:8000
    └── /*    → frontend:3000
```

---

## 13. Project Directory Structure

```
logpulse/
│
├── README.md
├── docker-compose.yml
├── .env.example
├── .github/
│   └── workflows/
│       ├── ci.yml                   # Test, lint, build on PR
│       └── deploy.yml               # Deploy to K8s on main merge
│
├── ingestion/
│   ├── kafka/
│   │   └── topics_setup.sh          # Create Kafka topics
│   ├── fluentd/
│   │   └── fluent.conf              # Fluentd config for log shipping
│   └── log-generator/              # Synthetic log generator for testing
│       ├── Dockerfile
│       ├── generator.py
│       └── scenarios/
│           ├── ddos.py
│           ├── brute_force.py
│           ├── memory_leak.py
│           └── normal_traffic.py
│
├── processing/
│   ├── speed_layer/
│   │   ├── spark_streaming_job.py   # Main Spark Streaming job
│   │   ├── feature_engineering.py
│   │   └── rule_engine.py
│   └── batch_layer/
│       ├── batch_aggregate_job.py
│       ├── lstm_inference_job.py
│       └── model_retrain_job.py
│
├── models/
│   ├── isolation_forest/
│   │   ├── train.py
│   │   ├── inference.py
│   │   └── evaluate.py
│   └── lstm/
│       ├── model.py                 # Keras LSTM architecture
│       ├── train.py
│       ├── inference.py
│       └── evaluate.py
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                      # FastAPI app entrypoint
│   ├── api/
│   │   ├── anomalies.py
│   │   ├── metrics.py
│   │   ├── logs.py
│   │   └── agent.py
│   ├── websocket/
│   │   └── handlers.py
│   ├── agent/
│   │   ├── agent.py                 # LangChain ReAct agent
│   │   ├── tools.py                 # Agent tools
│   │   ├── prompts.py
│   │   └── tasks.py                 # Celery tasks
│   ├── db/
│   │   ├── postgres.py
│   │   ├── redis_client.py
│   │   └── elasticsearch_client.py
│   └── schemas/
│       ├── anomaly.py
│       └── rca_report.py
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── LogStream/
│   │   │   ├── AnomalyTimeline/
│   │   │   ├── MetricsDashboard/
│   │   │   ├── BatchAnalytics/
│   │   │   └── AgentConsole/
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   └── useAnomalies.ts
│   │   ├── store/
│   │   │   └── dashboardStore.ts    # Zustand store
│   │   └── api/
│   │       └── client.ts            # React Query + axios
│   └── public/
│
├── k8s/
│   ├── namespace.yaml
│   ├── kafka/
│   ├── spark/
│   ├── elasticsearch/
│   ├── postgres/
│   ├── redis/
│   ├── backend/
│   └── frontend/
│
├── monitoring/
│   ├── prometheus/
│   │   └── prometheus.yml
│   └── grafana/
│       └── dashboards/
│           └── logpulse-platform.json
│
└── docs/
    ├── LOGPULSE_DOCS.md            ← You are here
    ├── API.md
    ├── ARCHITECTURE_DECISIONS.md   # ADR log
    └── RUNBOOK.md
```

---

## 14. Setup & Installation

### 14.1 Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Docker | ≥ 24.x | With Docker Compose v2 |
| Python | ≥ 3.11 | For local model development |
| Node.js | ≥ 20.x LTS | For frontend development |
| Java | ≥ 11 | Required by Spark/Kafka locally |
| kubectl | ≥ 1.29 | For K8s deployment |
| Helm | ≥ 3.14 | Kubernetes package manager |

### 14.2 Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/<org>/logpulse.git
cd logpulse

# 2. Copy environment config
cp .env.example .env
# Edit .env: set LLM API key, DB passwords, etc.

# 3. Start all infrastructure services
docker compose up -d

# Wait for Kafka, Elasticsearch, and Postgres to be healthy
docker compose ps

# 4. Initialize Kafka topics
bash ingestion/kafka/topics_setup.sh

# 5. Initialize PostgreSQL schema
docker compose exec postgres psql -U logpulse -d logpulse \
  -f /docker-entrypoint-initdb.d/schema.sql

# 6. Create Elasticsearch index
curl -X PUT http://localhost:9200/logs-enriched \
  -H "Content-Type: application/json" \
  -d @backend/db/es_mappings.json

# 7. Train initial ML models
cd models/isolation_forest && python train.py
cd ../lstm && python train.py

# 8. Start backend API
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 9. Start frontend dev server
cd frontend
npm install
npm run dev
# → Dashboard at http://localhost:3000

# 10. Start synthetic log generator (for testing)
cd ingestion/log-generator
python generator.py --scenario mixed --rate 5000

# 11. Optionally inject anomaly scenarios
python generator.py --scenario ddos --duration 60
```

### 14.3 Key Environment Variables

```bash
# Kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# Databases
POSTGRES_URL=postgresql://logpulse:password@localhost:5432/logpulse
REDIS_URL=redis://localhost:6379/0
ELASTICSEARCH_URL=http://localhost:9200

# ML
MLFLOW_TRACKING_URI=http://localhost:5000

# AI Agent
ANTHROPIC_API_KEY=sk-ant-...       # Claude API key
OPENAI_API_KEY=sk-...               # Alternative LLM

# Spark
SPARK_MASTER_URL=spark://localhost:7077
HDFS_NAMENODE=hdfs://localhost:9000
```

---

## 15. Evaluation & Testing Strategy

### 15.1 Anomaly Detection Performance

**Test Dataset:** Inject labeled anomalies into a held-out log stream and measure detection accuracy.

| Anomaly Type | Injection Method | Target Precision | Target Recall |
|---|---|---|---|
| DDoS Burst | Rate spike: 500+ req/s single IP | > 0.95 | > 0.90 |
| Brute-Force Login | > 10 failed logins/user/min | > 0.90 | > 0.85 |
| Memory Leak | Gradually increasing `mem_pct` over 2h | > 0.85 | > 0.80 |
| Service Failure | Sudden 5xx spike (> 30% error rate) | > 0.95 | > 0.92 |
| Port Scan | > 20 distinct ports in 10s from one IP | > 0.88 | > 0.82 |

**Evaluation Metrics:**
- Precision, Recall, F1-Score (per anomaly type)
- False Positive Rate (operational noise budget)
- Mean Time To Detection (MTTD): target < 5 seconds (stream), < 10 minutes (batch)

### 15.2 System Performance Testing

| Metric | Target | Test Tool |
|---|---|---|
| Kafka ingest throughput | 100,000 events/sec | kafka-producer-perf-test |
| Stream processing latency | < 2 seconds P99 | Custom timing instrumentation |
| API response time | < 100ms P95 | Locust / k6 |
| Dashboard WebSocket lag | < 500ms | Browser Performance API |
| Batch job completion (15min window) | < 8 minutes | Spark UI metrics |

### 15.3 AI Agent Quality Evaluation

- **RCA Accuracy:** Human expert review of 100 RCA reports against known ground-truth incidents. Target: > 80% agreement on root cause hypothesis.
- **Remediation Validity:** Subject matter expert review of generated remediation steps. Target: > 90% actionable and correct steps.
- **Latency:** AI agent must return RCA report within 60 seconds. Target P95 < 45 seconds.

### 15.4 Testing Pyramid

```
Unit Tests (pytest)
├── Feature engineering functions
├── Rule engine conditions
├── Schema validation
├── API endpoints (FastAPI TestClient)
└── Agent tool mock tests

Integration Tests
├── Kafka producer → consumer round-trip
├── Spark job on sample data
├── Isolation Forest training & inference pipeline
├── LSTM training & batch inference pipeline
└── End-to-end anomaly → RCA flow (with mocked LLM)

Load / Stress Tests (Locust)
├── API under 1000 concurrent users
├── WebSocket with 200 concurrent subscribers
└── Kafka ingest at 100K events/sec sustained 10 min
```

---

## 16. Expected Outcomes & KPIs

### 16.1 Platform Capabilities

| KPI | Specification |
|---|---|
| Log Ingest Rate (peak) | ≥ 100,000 events/second |
| Log Sources Supported | ≥ 4 (web, app, system, security) |
| Stream Detection Latency (P99) | < 5 seconds |
| Batch Processing Window | ≤ 15 minutes for 24h of data |
| Dashboard Refresh Rate | Real-time (WebSocket push) |
| System Uptime | ≥ 99.5% (3 nines) |

### 16.2 Detection Quality

| KPI | Target |
|---|---|
| Anomaly Detection F1 (Isolation Forest) | ≥ 0.88 across all anomaly types |
| Anomaly Detection F1 (LSTM, batch) | ≥ 0.85 for temporal drift anomalies |
| False Positive Rate | ≤ 3% of flagged events |
| Mean Time to Detection (stream) | ≤ 5 seconds |
| Mean Time to Detection (batch drift) | ≤ 15 minutes |

### 16.3 AI Agent Quality

| KPI | Target |
|---|---|
| RCA Report Generation Time (P95) | ≤ 45 seconds |
| Root Cause Accuracy (expert review) | ≥ 80% |
| Remediation Step Validity | ≥ 90% actionable & correct |
| LLM Cost per RCA | ≤ $0.05 per report |

---

## 17. Limitations & Future Scope

### 17.1 Current Limitations

- **Model Concept Drift:** Isolation Forest and LSTM models are retrained daily/weekly. Novel attack patterns emerging between training cycles may evade detection until retrain.
- **LLM Hallucination:** AI agent outputs are probabilistic. Remediation steps must be validated by a human operator before execution in production.
- **Cold Start:** The LSTM model requires 7+ days of historical data to establish a meaningful behavioral baseline.
- **Single-Region:** Current Kubernetes deployment is single-region. Multi-region failover is not yet implemented.
- **Log Schema Rigidity:** Sources with highly non-standard log formats require custom Fluentd parsers.

### 17.2 Future Roadmap

| Feature | Priority | Effort |
|---|---|---|
| **Online Learning** — River / Vowpal Wabbit for continuous model adaptation | High | Large |
| **PagerDuty / OpsGenie Integration** — Auto-escalate CRITICAL anomalies | High | Medium |
| **Multi-Region Active-Active** — Kafka MirrorMaker 2 cross-region replication | Medium | Large |
| **RBAC & Multi-Tenancy** — Per-team dashboard isolation | Medium | Medium |
| **Auto-Remediation** — AI agent executes approved runbooks autonomously | Low | Large |
| **Natural Language Log Query** — "Show me all 500 errors from auth-service yesterday" | Medium | Medium |
| **Graph Neural Networks** — Model service call graphs for cascade failure detection | Low | Large |
| **eBPF Integration** — Kernel-level observability without agent instrumentation | Low | Large |

---

## 18. References

1. Marz, N., & Warren, J. (2015). *Big Data: Principles and best practices of scalable realtime data systems.* Manning Publications.
2. Liu, F. T., Ting, K. M., & Zhou, Z. H. (2008). Isolation Forest. *Proceedings of the 2008 Eighth IEEE International Conference on Data Mining.* IEEE.
3. Hochreiter, S., & Schmidhuber, J. (1997). Long Short-Term Memory. *Neural Computation, 9*(8), 1735–1780.
4. Apache Kafka Documentation. https://kafka.apache.org/documentation/
5. Apache Spark Structured Streaming Guide. https://spark.apache.org/docs/latest/structured-streaming-programming-guide.html
6. LangChain Documentation — Agents & Tools. https://docs.langchain.com/docs/components/agents/
7. MLflow Model Registry Documentation. https://mlflow.org/docs/latest/model-registry.html
8. Anthropic Claude API Reference. https://docs.anthropic.com/
9. Elasticsearch Reference 8.x. https://www.elastic.co/guide/en/elasticsearch/reference/current/
10. Scikit-learn — IsolationForest. https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html
11. Peng, Z., et al. (2019). *Outage Prediction and Diagnosis for Cloud Service Systems.* WWW 2019.
12. He, S., et al. (2016). An Evaluation Study on Log Parsing and Its Use in Log Mining. *DSN 2016.*

---

*LogPulse — Intelligent Infrastructure Observability*
*Siddaganga Institute of Technology · Real-Time Big Data Analytics · 2025*