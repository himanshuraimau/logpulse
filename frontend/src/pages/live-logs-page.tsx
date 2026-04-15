import { useMemo, useState } from "react"
import { Link } from "react-router-dom"

import type { LogEvent } from "@/api/logs"
import { useBatchStatus } from "@/hooks/use-batch-status"
import { useGenerateLogs } from "@/hooks/use-generate-logs"
import { useLogSearch } from "@/hooks/use-log-search"
import { useConsumeStream } from "@/hooks/use-consume-stream"
import { useLiveLogSocket } from "@/hooks/use-live-log-socket"
import { useLogScenarios } from "@/hooks/use-log-scenarios"
import { useRecentLogs } from "@/hooks/use-recent-logs"
import { useStreamStatus } from "@/hooks/use-stream-status"
import { LogSearchForm } from "@/components/log-search-form"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getErrorMessage } from "@/lib/errors"
import { formatEventTime, getLogEventKey } from "@/lib/log-event"

const fallbackScenarios = [
  "normal",
  "error_spike",
  "auth_failures",
  "request_burst",
  "mixed",
] as const

function mergeLogEvents(liveEvents: LogEvent[], persistedEvents: LogEvent[]): LogEvent[] {
  const dedupedEvents: LogEvent[] = []
  const seenKeys = new Set<string>()

  for (const event of [...liveEvents, ...persistedEvents]) {
    const key = getLogEventKey(event)

    if (seenKeys.has(key)) {
      continue
    }

    seenKeys.add(key)
    dedupedEvents.push(event)

    if (dedupedEvents.length >= 120) {
      break
    }
  }

  return dedupedEvents
}

export function LiveLogsPage() {
  const [scenario, setScenario] = useState("mixed")
  const [searchedLogs, setSearchedLogs] = useState<LogEvent[] | null>(null)
  const scenariosQuery = useLogScenarios()
  const streamStatus = useStreamStatus()
  const recentLogs = useRecentLogs(40)
  const batchStatus = useBatchStatus()
  const generateLogs = useGenerateLogs()
  const logSearch = useLogSearch()
  const consumeStream = useConsumeStream()
  const liveSocket = useLiveLogSocket()
  const mergedLogs = useMemo(
    () => mergeLogEvents(liveSocket.events, recentLogs.data?.items ?? []),
    [liveSocket.events, recentLogs.data?.items]
  )
  const displayedLogs = searchedLogs ?? mergedLogs
  const scenarios = useMemo(() => {
    const values = scenariosQuery.data?.scenarios ?? []
    if (values.length > 0) {
      return values
    }
    return [...fallbackScenarios]
  }, [scenariosQuery.data?.scenarios])
  const activeScenario = scenarios.includes(scenario) ? scenario : (scenarios[0] ?? "mixed")

  const dbStatusVariant = useMemo(() => {
    if (!streamStatus.data?.database.ok) {
      return "danger"
    }
    return "success"
  }, [streamStatus.data?.database.ok])

  const kafkaStatusVariant = useMemo(() => {
    if (!streamStatus.data?.kafka.enabled) {
      return "outline"
    }
    return streamStatus.data?.kafka.connected ? "success" : "warning"
  }, [streamStatus.data?.kafka.connected, streamStatus.data?.kafka.enabled])

  return (
    <section className="space-y-4">
      <PageHeader
        title="Live Logs"
        description="Generate synthetic traffic, check stream health, and inspect the most recent events in one place."
        actions={
          <>
            <Badge variant={dbStatusVariant}>DB {streamStatus.data?.database.ok ? "Connected" : "Down"}</Badge>
            <Badge variant={kafkaStatusVariant}>
              Kafka {streamStatus.data?.kafka.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <Badge variant={liveSocket.state === "open" ? "success" : "warning"}>
              Stream {liveSocket.state}
            </Badge>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>Traffic Controls</CardTitle>
            <CardDescription>
              Select a traffic profile and push events through the stream pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Scenario</p>
              <div className="flex flex-wrap gap-2">
                {scenarios.map((value) => (
                  <Button
                    key={value}
                    variant={activeScenario === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScenario(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                onClick={() => generateLogs.mutate({ scenario: activeScenario, count: 50 })}
                disabled={generateLogs.isPending}
              >
                Generate 50
              </Button>
              <Button
                variant="secondary"
                onClick={() => generateLogs.mutate({ scenario: activeScenario, count: 250 })}
                disabled={generateLogs.isPending}
              >
                Generate 250
              </Button>
              <Button
                variant="outline"
                onClick={() => consumeStream.mutate(300)}
                disabled={consumeStream.isPending}
              >
                Consume Kafka
              </Button>
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              {generateLogs.data ? (
                <p>
                  Generated {generateLogs.data.generated}, persisted {generateLogs.data.persisted}, published {generateLogs.data.kafka_published} to Kafka.
                </p>
              ) : null}
              {consumeStream.data ? (
                <p>
                  Consumed {consumeStream.data.consumed}, persisted {consumeStream.data.persisted}, skipped {consumeStream.data.skipped}.
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              {scenariosQuery.isError ? (
                <p className="text-sm text-red-700 dark:text-red-300">
                  Failed to load scenarios: {getErrorMessage(scenariosQuery.error)}
                </p>
              ) : null}
              {generateLogs.isError ? (
                <p className="text-sm text-red-700 dark:text-red-300">
                  Generation failed: {getErrorMessage(generateLogs.error)}
                </p>
              ) : null}
              {consumeStream.isError ? (
                <p className="text-sm text-red-700 dark:text-red-300">
                  Stream consume failed: {getErrorMessage(consumeStream.error)}
                </p>
              ) : null}
            </div>

            <LogSearchForm
              onSearch={async (params) => {
                try {
                  const response = await logSearch.mutateAsync(params)
                  setSearchedLogs(response.items)
                } catch {
                  setSearchedLogs([])
                }
              }}
              onClear={() => setSearchedLogs(null)}
              isPending={logSearch.isPending}
            />

            {logSearch.isError ? (
              <p className="text-sm text-red-700 dark:text-red-300">
                Search failed: {getErrorMessage(logSearch.error)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="xl:col-span-8">
          <CardHeader>
            <CardTitle>Stream Activity</CardTitle>
            <CardDescription>
              Live event timeline from websocket plus persisted API data for continuity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant={liveSocket.metricsState === "open" ? "success" : "warning"}>
                Metrics {liveSocket.metricsState}
              </Badge>
              <Badge variant={batchStatus.data?.status === "ok" ? "success" : "outline"}>
                Batch {batchStatus.data?.engine ?? "idle"}
              </Badge>
              <Badge variant="outline">Buffer {streamStatus.data?.recent_buffer_size ?? 0}</Badge>
              <Badge variant="outline">Event stream {streamStatus.data?.event_stream_size ?? 0}</Badge>
              <Badge variant="outline">Visible logs {displayedLogs.length}</Badge>
              {liveSocket.reconnectAttempts > 0 ? (
                <Badge variant="warning">WS retries {liveSocket.reconnectAttempts}</Badge>
              ) : null}
              {liveSocket.metricsReconnectAttempts > 0 ? (
                <Badge variant="warning">Metrics retries {liveSocket.metricsReconnectAttempts}</Badge>
              ) : null}
            </div>

            {liveSocket.metrics ? (
              <p className="text-sm text-muted-foreground">
                Window {liveSocket.metrics.window_size}: {liveSocket.metrics.total_events} events, {liveSocket.metrics.anomalies} anomalies, {liveSocket.metrics.errors} server errors.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/anomalies">Open anomalies</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/batch">Open batch analytics</Link>
              </Button>
              <span className="text-sm text-muted-foreground">
                Current anomaly count: {liveSocket.metrics?.anomalies ?? 0}
              </span>
              {searchedLogs ? <Badge variant="warning">Search results {displayedLogs.length}</Badge> : null}
            </div>

            {streamStatus.isError ? (
              <p className="text-sm text-red-700 dark:text-red-300">
                Stream status failed: {getErrorMessage(streamStatus.error)}
              </p>
            ) : null}
            {recentLogs.isError ? (
              <p className="text-sm text-red-700 dark:text-red-300">
                Recent logs failed: {getErrorMessage(recentLogs.error)}
              </p>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-border/70 bg-background/70">
              <div className="max-h-110 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-[11px] font-medium text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Service</th>
                      <th className="px-3 py-2">Level</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Source IP</th>
                      <th className="px-3 py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedLogs.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={6}>
                          {logSearch.isPending ? "Searching logs..." : "No logs available for current filters."}
                        </td>
                      </tr>
                    ) : (
                      displayedLogs.map((event, index) => (
                        <tr key={`${getLogEventKey(event)}-${index}`} className="border-t border-border/60 hover:bg-muted/30">
                          <td className="px-3 py-2">{formatEventTime(event.timestamp)}</td>
                          <td className="px-3 py-2">{event.service || "-"}</td>
                          <td className="px-3 py-2">{event.log_level || "-"}</td>
                          <td className="px-3 py-2">{event.http?.status ?? "-"}</td>
                          <td className="px-3 py-2">{event.network?.source_ip ?? "-"}</td>
                          <td className="px-3 py-2">{event.message || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
