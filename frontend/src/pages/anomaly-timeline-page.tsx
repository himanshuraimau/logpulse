import { useMemo, useState } from "react"

import type { LogEvent } from "@/api/logs"
import { useAnomalySocket } from "@/hooks/use-anomaly-socket"
import { useRecentAnomalies } from "@/hooks/use-recent-anomalies"
import { AnomalyDetailModal } from "@/components/anomaly-detail-modal"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function mergeAnomalyEvents(liveEvents: LogEvent[], persistedEvents: LogEvent[]): LogEvent[] {
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
    <section className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Anomaly Stream</CardTitle>
          <CardDescription>
            Live websocket anomalies plus API-backed history for timeline continuity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant={anomalySocket.state === "open" ? "success" : "warning"}>
              WS anomalies {anomalySocket.state}
            </Badge>
            <Badge variant={recentAnomalies.data ? "success" : "warning"}>
              API {recentAnomalies.isFetching ? "refreshing" : "ready"}
            </Badge>
            <Badge variant="outline">Live seq {anomalySocket.lastSequence}</Badge>
            <Badge variant="outline">Visible {mergedAnomalies.length}</Badge>
            {selectedEventId ? <Badge variant="warning">Selected {selectedEventId}</Badge> : null}
          </div>
          <p className="text-muted-foreground text-xs">
            Synthetic anomaly flags and stream-marked anomaly events are shown here for operator
            triage before RCA workflow execution.
          </p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Anomaly Timeline</CardTitle>
          <CardDescription>
            Reverse-chronological anomaly activity with source context and HTTP outcome.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-border bg-background/70 max-h-130 overflow-auto border">
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
                {mergedAnomalies.length === 0 ? (
                  <tr>
                    <td className="text-muted-foreground px-2 py-3" colSpan={6}>
                      No anomalies received yet.
                    </td>
                  </tr>
                ) : (
                  mergedAnomalies.map((event) => (
                    <tr
                      key={event.event_id}
                      className="border-border cursor-pointer border-t hover:bg-muted/40"
                      onClick={() => setSelectedEventId(event.event_id)}
                    >
                      <td className="px-2 py-1.5">{new Date(event.timestamp).toLocaleTimeString()}</td>
                      <td className="px-2 py-1.5">{event.service}</td>
                      <td className="px-2 py-1.5">{event.log_level}</td>
                      <td className="px-2 py-1.5">{event.http?.status ?? "-"}</td>
                      <td className="px-2 py-1.5">{event.network?.source_ip ?? "-"}</td>
                      <td className="px-2 py-1.5">{event.message}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AnomalyDetailModal eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
    </section>
  )
}
