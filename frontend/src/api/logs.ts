import { apiRequest } from "@/api/client"

export type PipelineStatus = {
  database: {
    ok: boolean
    detail: string
  }
  kafka: {
    enabled: boolean
    connected: boolean
    bootstrap_servers: string
    topic: string
    last_error: string | null
  }
  recent_buffer_size: number
  event_stream_size?: number
  event_sequence?: number
}

export type LiveMetrics = {
  generated_at: string
  window_size: number
  total_events: number
  anomalies: number
  errors: number
  last_sequence: number
  services: Record<
    string,
    {
      total: number
      anomalies: number
      errors: number
    }
  >
}

export type HealthResponse = {
  status: "ok" | "degraded"
  service: string
  version: string
  environment: string
  pipeline: PipelineStatus
}

export type LogEvent = {
  event_id: string
  timestamp: string
  service: string
  log_level: string
  message: string
  network?: {
    source_ip?: string
  }
  http?: {
    status?: number
  }
  tags?: string[]
  is_anomaly?: boolean
  anomaly_score?: number
  rule_matches?: string[]
  detection?: {
    model_anomaly?: boolean
    model_score?: number
    model_detail?: string
    rule_score?: number
  }
}

export type RecentLogsResponse = {
  count: number
  items: LogEvent[]
}

export type AnomaliesResponse = {
  count: number
  items: LogEvent[]
}

export type RecentAnomaliesResponse = {
  count: number
  last_sequence: number
  items: LogEvent[]
}

export type SearchLogsParams = {
  q?: string
  service?: string
  level?: string
  sinceMinutes?: number
  limit?: number
}

export type SearchLogsResponse = {
  count: number
  items: LogEvent[]
}

export type AnomalyDetailResponse = {
  event: LogEvent
  context: LogEvent[]
  context_count: number
}

export type GenerateLogsPayload = {
  scenario: "normal" | "error_spike" | "auth_failures" | "request_burst" | "mixed"
  count: number
}

export type GenerateLogsResponse = {
  scenario: string
  generated: number
  persisted: number
  kafka_enabled: boolean
  kafka_topic: string
  kafka_published: number
  kafka_failed: number
  errors: string[]
}

export type ConsumeStreamResponse = {
  kafka_enabled: boolean
  topic?: string
  consumer_group?: string
  consumed: number
  persisted: number
  skipped: number
  errors: string[]
}

export type BatchServiceAggregate = {
  service: string
  total: number
  anomalies: number
  errors: number
}

export type BatchStatusResponse = {
  status: string
  engine: string
  message?: string
  run_id?: string
  started_at?: string
  completed_at?: string
  duration_ms?: number
  window_events_requested?: number
  total_events?: number
  service_count?: number
  services?: BatchServiceAggregate[]
  warning?: string
  configured_interval_seconds?: number
  configured_window_events?: number
  configured_use_pyspark?: boolean
}

export type BatchMetricsResponse = {
  count: number
  latest: BatchStatusResponse | null
  items: BatchStatusResponse[]
}

export function getHealth() {
  return apiRequest<HealthResponse>("/health")
}

export function getStreamStatus() {
  return apiRequest<PipelineStatus>("/stream/status")
}

export function getRecentLogs(limit: number) {
  return apiRequest<RecentLogsResponse>(`/logs/recent?limit=${limit}`)
}

export function getAnomalies(limit: number, sinceMinutes?: number) {
  const searchParams = new URLSearchParams({ limit: String(limit) })
  if (sinceMinutes !== undefined) {
    searchParams.set("since_minutes", String(sinceMinutes))
  }

  return apiRequest<AnomaliesResponse>(`/anomalies?${searchParams.toString()}`)
}

export function getRecentAnomalies(limit: number, lastSequence: number) {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    last_sequence: String(lastSequence),
  })
  return apiRequest<RecentAnomaliesResponse>(`/anomalies/recent?${searchParams.toString()}`)
}

export function searchLogs(params: SearchLogsParams) {
  const searchParams = new URLSearchParams()
  if (params.q) {
    searchParams.set("q", params.q)
  }
  if (params.service) {
    searchParams.set("service", params.service)
  }
  if (params.level) {
    searchParams.set("level", params.level)
  }
  if (params.sinceMinutes !== undefined) {
    searchParams.set("since_minutes", String(params.sinceMinutes))
  }
  searchParams.set("limit", String(params.limit ?? 120))

  return apiRequest<SearchLogsResponse>(`/logs/search?${searchParams.toString()}`)
}

export function getAnomalyDetail(eventId: string, contextLimit = 20) {
  return apiRequest<AnomalyDetailResponse>(
    `/anomalies/${encodeURIComponent(eventId)}?context_limit=${contextLimit}`
  )
}

export function getLiveMetrics(windowSize = 200) {
  return apiRequest<LiveMetrics>(`/metrics/live?window_size=${windowSize}`)
}

export function generateLogs(payload: GenerateLogsPayload) {
  return apiRequest<GenerateLogsResponse>("/logs/generate", {
    method: "POST",
    body: payload,
  })
}

export function consumeStream(maxMessages: number) {
  return apiRequest<ConsumeStreamResponse>("/stream/consume", {
    method: "POST",
    body: { max_messages: maxMessages },
  })
}

export function getBatchStatus() {
  return apiRequest<BatchStatusResponse>("/batch/status")
}

export function getBatchMetrics(limit = 20) {
  return apiRequest<BatchMetricsResponse>(`/metrics/batch?limit=${limit}`)
}

export function runBatchJob() {
  return apiRequest<BatchStatusResponse>("/batch/run", {
    method: "POST",
  })
}
