import { useMemo, useState } from "react"
import { Link } from "react-router-dom"

import type { LogEvent } from "@/api/logs"
import { useBatchStatus } from "@/hooks/use-batch-status"
import { useGenerateLogs } from "@/hooks/use-generate-logs"
import { useLogSearch } from "@/hooks/use-log-search"
import { useConsumeStream } from "@/hooks/use-consume-stream"
import { useLiveLogSocket } from "@/hooks/use-live-log-socket"
import { useRecentLogs } from "@/hooks/use-recent-logs"
import { useStreamStatus } from "@/hooks/use-stream-status"
import { LogSearchForm } from "@/components/log-search-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const scenarios = [
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
    const key =
      event.event_id ||
      [event.timestamp, event.service, event.message, event.network?.source_ip].join("-")

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
  const [scenario, setScenario] = useState<(typeof scenarios)[number]>("mixed")
  const [searchedLogs, setSearchedLogs] = useState<LogEvent[] | null>(null)
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
    <section className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Traffic Generator</CardTitle>
          <CardDescription>
            Generate synthetic backend logs for Kafka and DB stream validation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {scenarios.map((value) => (
              <Button
                key={value}
                variant={scenario === value ? "default" : "outline"}
                size="sm"
                onClick={() => setScenario(value)}
              >
                {value}
              </Button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() => generateLogs.mutate({ scenario, count: 50 })}
              disabled={generateLogs.isPending}
            >
              Generate 50
            </Button>
            <Button
              variant="secondary"
              onClick={() => generateLogs.mutate({ scenario, count: 250 })}
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
          {generateLogs.data ? (
            <p className="text-muted-foreground mt-3 text-xs">
              Generated {generateLogs.data.generated}, persisted {generateLogs.data.persisted},
              Kafka published {generateLogs.data.kafka_published}.
            </p>
          ) : null}
          {consumeStream.data ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Consumed {consumeStream.data.consumed}, persisted {consumeStream.data.persisted},
              skipped {consumeStream.data.skipped}.
            </p>
          ) : null}
          <div className="mt-3">
            <LogSearchForm
              onSearch={async (params) => {
                const response = await logSearch.mutateAsync(params)
                setSearchedLogs(response.items)
              }}
              onClear={() => setSearchedLogs(null)}
              isPending={logSearch.isPending}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Pipeline Status</CardTitle>
          <CardDescription>
            Immediate visibility into DB streaming and Kafka connectivity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant={dbStatusVariant}>DB {streamStatus.data?.database.ok ? "connected" : "down"}</Badge>
            <Badge variant={kafkaStatusVariant}>
              Kafka {streamStatus.data?.kafka.enabled ? "enabled" : "disabled"}
            </Badge>
            <Badge variant={liveSocket.state === "open" ? "success" : "warning"}>
              WS logs {liveSocket.state}
            </Badge>
            <Badge variant={liveSocket.metricsState === "open" ? "success" : "warning"}>
              WS metrics {liveSocket.metricsState}
            </Badge>
            <Badge variant={batchStatus.data?.status === "ok" ? "success" : "outline"}>
              Batch {batchStatus.data?.engine ?? "idle"}
            </Badge>
            <Badge variant="outline">
              Buffer {streamStatus.data?.recent_buffer_size ?? 0}
            </Badge>
            <Badge variant="outline">
              Event stream {streamStatus.data?.event_stream_size ?? 0}
            </Badge>
            <Badge variant="outline">Live events {liveSocket.events.length}</Badge>
          </div>
          {liveSocket.metrics ? (
            <p className="text-muted-foreground mb-3 text-xs">
              Live window {liveSocket.metrics.window_size}: {liveSocket.metrics.total_events} events, {" "}
              {liveSocket.metrics.anomalies} anomalies, {liveSocket.metrics.errors} server errors.
            </p>
          ) : null}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/anomalies">Review anomalies</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/batch">Open batch analytics</Link>
            </Button>
            <span className="text-muted-foreground text-xs">
              Current anomaly count: {liveSocket.metrics?.anomalies ?? 0}
            </span>
            {searchedLogs ? (
              <Badge variant="warning">Search results {displayedLogs.length}</Badge>
            ) : null}
          </div>
          <div className="border-border bg-background/70 max-h-110 overflow-auto border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted sticky top-0 text-[10px] uppercase">
                <tr>
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Service</th>
                  <th className="px-2 py-2">Level</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Source IP</th>
                  <th className="px-2 py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {displayedLogs.map((event) => (
                  <tr key={event.event_id} className="border-border border-t">
                    <td className="px-2 py-1.5">{new Date(event.timestamp).toLocaleTimeString()}</td>
                    <td className="px-2 py-1.5">{event.service}</td>
                    <td className="px-2 py-1.5">{event.log_level}</td>
                    <td className="px-2 py-1.5">{event.http?.status ?? "-"}</td>
                    <td className="px-2 py-1.5">{event.network?.source_ip ?? "-"}</td>
                    <td className="px-2 py-1.5">{event.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
