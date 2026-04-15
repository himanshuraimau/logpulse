import { useMemo, useState } from "react"

import type { LogEvent } from "@/api/logs"
import { useAnomalySocket } from "@/hooks/use-anomaly-socket"
import { useRecentAnomalies } from "@/hooks/use-recent-anomalies"
import { AnomalyDetailModal } from "@/components/anomaly-detail-modal"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getErrorMessage } from "@/lib/errors"
import { formatEventTime, getLogEventKey } from "@/lib/log-event"

function mergeAnomalyEvents(liveEvents: LogEvent[], persistedEvents: LogEvent[]): LogEvent[] {
  const dedupedEvents: LogEvent[] = []
  const seenKeys = new Set<string>()

  for (const event of [...liveEvents, ...persistedEvents]) {
    const key = getLogEventKey(event)

    if (seenKeys.has(key)) {
      continue
    }

    seenKeys.add(key)
    dedupedEvents.push(event)
    if (dedupedEvents.length >= 180) {
      break
    }
  }

  return dedupedEvents
}

export function AnomalyTimelinePage() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const anomalySocket = useAnomalySocket(180)
  const recentAnomalies = useRecentAnomalies(120, 240)

  const mergedAnomalies = useMemo(
    () => mergeAnomalyEvents(anomalySocket.events, recentAnomalies.data?.items ?? []),
    [anomalySocket.events, recentAnomalies.data?.items]
  )

  return (
    <section className="space-y-4">
      <PageHeader
        title="Anomaly Timeline"
        description="Track anomalies from websocket and API snapshots with one continuous timeline for triage."
        actions={
          <>
            <Badge variant={anomalySocket.state === "open" ? "success" : "warning"}>
              Stream {anomalySocket.state}
            </Badge>
            <Badge variant={recentAnomalies.data ? "success" : "warning"}>
              API {recentAnomalies.isFetching ? "Refreshing" : "Ready"}
            </Badge>
            <Badge variant="outline">Visible {mergedAnomalies.length}</Badge>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>Stream Context</CardTitle>
            <CardDescription>
              Monitor sequence progression and websocket reliability while triaging incidents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {anomalySocket.reconnectAttempts > 0 ? (
                <Badge variant="warning">WS retries {anomalySocket.reconnectAttempts}</Badge>
              ) : null}
              <Badge variant="outline">Live seq {anomalySocket.lastSequence}</Badge>
              {selectedEventId ? <Badge variant="warning">Selected {selectedEventId}</Badge> : null}
            </div>

            <p className="text-sm text-muted-foreground">
              Synthetic anomaly flags and stream-marked anomaly events are shown here for operator
              triage before RCA execution.
            </p>

            {recentAnomalies.isError ? (
              <p className="text-sm text-red-700 dark:text-red-300">
                Failed to load anomalies: {getErrorMessage(recentAnomalies.error)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="xl:col-span-8">
          <CardHeader>
            <CardTitle>Recent Anomalies</CardTitle>
            <CardDescription>
              Reverse-chronological anomaly activity with source context and HTTP outcomes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-border/70 bg-background/70">
              <div className="max-h-130 overflow-auto">
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
                    {mergedAnomalies.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={6}>
                          No anomalies received yet.
                        </td>
                      </tr>
                    ) : (
                      mergedAnomalies.map((event, index) => (
                        <tr
                          key={`${getLogEventKey(event)}-${index}`}
                          className="border-t border-border/60 hover:bg-muted/30"
                          onClick={() => {
                            if (event.event_id) {
                              setSelectedEventId(event.event_id)
                            }
                          }}
                        >
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

      <AnomalyDetailModal eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
    </section>
  )
}
