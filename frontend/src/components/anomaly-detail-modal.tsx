import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAnomalyDetail } from "@/hooks/use-anomaly-detail"

type AnomalyDetailModalProps = {
  eventId: string | null
  onClose: () => void
}

export function AnomalyDetailModal({ eventId, onClose }: AnomalyDetailModalProps) {
  const detailQuery = useAnomalyDetail(eventId, 25, Boolean(eventId))

  if (!eventId) {
    return null
  }

  const event = detailQuery.data?.event
  const context = detailQuery.data?.context ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[80vh] w-full max-w-4xl overflow-auto border border-border bg-background p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Anomaly Detail</p>
            <h3 className="text-sm font-semibold">{event?.service ?? "Loading..."}</h3>
          </div>
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        {detailQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading anomaly context...</p>
        ) : detailQuery.isError ? (
          <p className="text-xs text-red-600">Failed to load anomaly detail.</p>
        ) : event ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={event.is_anomaly ? "danger" : "outline"}>
                {event.is_anomaly ? "Anomaly" : "Normal"}
              </Badge>
              <Badge variant="outline">Score {event.anomaly_score ?? 0}</Badge>
              <Badge variant="outline">Level {event.log_level}</Badge>
            </div>
            <div className="border border-border p-2 text-xs">
              <p><strong>Event ID:</strong> {event.event_id}</p>
              <p><strong>Time:</strong> {new Date(event.timestamp).toLocaleString()}</p>
              <p><strong>Service:</strong> {event.service}</p>
              <p><strong>Status:</strong> {event.http?.status ?? "-"}</p>
              <p><strong>Source IP:</strong> {event.network?.source_ip ?? "-"}</p>
              <p><strong>Message:</strong> {event.message}</p>
              <p><strong>Rules:</strong> {(event.rule_matches ?? []).join(", ") || "none"}</p>
            </div>

            <div className="border border-border bg-background/80">
              <p className="border-b border-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Related Context ({context.length})
              </p>
              <div className="max-h-60 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted sticky top-0 text-[10px] uppercase">
                    <tr>
                      <th className="px-2 py-1.5">Time</th>
                      <th className="px-2 py-1.5">Level</th>
                      <th className="px-2 py-1.5">Status</th>
                      <th className="px-2 py-1.5">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {context.length === 0 ? (
                      <tr>
                        <td className="px-2 py-2 text-muted-foreground" colSpan={4}>
                          No context events available.
                        </td>
                      </tr>
                    ) : (
                      context.map((item) => (
                        <tr key={item.event_id} className="border-t border-border">
                          <td className="px-2 py-1.5">{new Date(item.timestamp).toLocaleTimeString()}</td>
                          <td className="px-2 py-1.5">{item.log_level}</td>
                          <td className="px-2 py-1.5">{item.http?.status ?? "-"}</td>
                          <td className="px-2 py-1.5">{item.message}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No anomaly detail found.</p>
        )}
      </div>
    </div>
  )
}
