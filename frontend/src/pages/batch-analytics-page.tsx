import { useMemo } from "react"

import { useBatchStatus } from "@/hooks/use-batch-status"
import { useRunBatch } from "@/hooks/use-run-batch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function BatchAnalyticsPage() {
  const batchStatus = useBatchStatus()
  const runBatch = useRunBatch()
  const serviceRows = useMemo(
    () => batchStatus.data?.services ?? [],
    [batchStatus.data?.services]
  )

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Batch Status</CardTitle>
          <CardDescription>
            Batch scaffold health and latest aggregation run summary.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant={batchStatus.data?.status === "ok" ? "success" : "outline"}>
              Status {batchStatus.data?.status ?? "idle"}
            </Badge>
            <Badge variant={batchStatus.data?.engine === "pyspark" ? "success" : "warning"}>
              Engine {batchStatus.data?.engine ?? "none"}
            </Badge>
            <Badge variant="outline">
              Interval {batchStatus.data?.configured_interval_seconds ?? 0}s
            </Badge>
            <Badge variant="outline">
              Window {batchStatus.data?.configured_window_events ?? 0}
            </Badge>
          </div>

          <div className="mb-3 space-y-1.5 text-xs">
            <p>
              Total events: <strong>{batchStatus.data?.total_events ?? 0}</strong>
            </p>
            <p>
              Services: <strong>{batchStatus.data?.service_count ?? 0}</strong>
            </p>
            <p>
              Duration: <strong>{batchStatus.data?.duration_ms ?? 0} ms</strong>
            </p>
          </div>

          {batchStatus.data?.warning ? (
            <p className="text-muted-foreground mb-3 text-xs">Warning: {batchStatus.data.warning}</p>
          ) : null}

          <Button onClick={() => runBatch.mutate()} disabled={runBatch.isPending}>
            {runBatch.isPending ? "Running..." : "Run Batch Once"}
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Service Aggregates</CardTitle>
          <CardDescription>
            Current batch summary by service, anomalies, and server errors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-border bg-background/70 max-h-[460px] overflow-auto border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted sticky top-0 text-[10px] uppercase">
                <tr>
                  <th className="px-2 py-2">Service</th>
                  <th className="px-2 py-2">Total</th>
                  <th className="px-2 py-2">Anomalies</th>
                  <th className="px-2 py-2">5xx errors</th>
                </tr>
              </thead>
              <tbody>
                {serviceRows.length === 0 ? (
                  <tr>
                    <td className="text-muted-foreground px-2 py-3" colSpan={4}>
                      Run the batch scaffold to generate service aggregates.
                    </td>
                  </tr>
                ) : (
                  serviceRows.map((item) => (
                    <tr key={item.service} className="border-border border-t">
                      <td className="px-2 py-1.5">{item.service}</td>
                      <td className="px-2 py-1.5">{item.total}</td>
                      <td className="px-2 py-1.5">{item.anomalies}</td>
                      <td className="px-2 py-1.5">{item.errors}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
