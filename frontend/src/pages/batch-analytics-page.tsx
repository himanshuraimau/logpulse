import { useMemo } from "react"

import { useBatchHistory } from "@/hooks/use-batch-history"
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
import { getErrorMessage } from "@/lib/errors"

export function BatchAnalyticsPage() {
  const batchStatus = useBatchStatus()
  const batchHistory = useBatchHistory(12)
  const runBatch = useRunBatch()
  const latestRun = batchHistory.data?.latest ?? batchStatus.data
  const serviceRows = useMemo(
    () => latestRun?.services ?? [],
    [latestRun?.services]
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
              Status {latestRun?.status ?? "idle"}
            </Badge>
            <Badge variant={latestRun?.engine === "pyspark" ? "success" : "warning"}>
              Engine {latestRun?.engine ?? "none"}
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
              Total events: <strong>{latestRun?.total_events ?? 0}</strong>
            </p>
            <p>
              Services: <strong>{latestRun?.service_count ?? 0}</strong>
            </p>
            <p>
              Duration: <strong>{latestRun?.duration_ms ?? 0} ms</strong>
            </p>
          </div>

          {batchStatus.data?.warning ? (
            <p className="text-muted-foreground mb-3 text-xs">Warning: {batchStatus.data.warning}</p>
          ) : null}

          {batchStatus.isError ? (
            <p className="text-xs text-red-700 dark:text-red-300">
              Failed to load batch status: {getErrorMessage(batchStatus.error)}
            </p>
          ) : null}

          {batchHistory.isError ? (
            <p className="text-xs text-red-700 dark:text-red-300">
              Failed to load batch history: {getErrorMessage(batchHistory.error)}
            </p>
          ) : null}

          <Button onClick={() => runBatch.mutate()} disabled={runBatch.isPending}>
            {runBatch.isPending ? "Running..." : "Run Batch Once"}
          </Button>

          {runBatch.isError ? (
            <p className="text-xs text-red-700 dark:text-red-300">
              Batch run failed: {getErrorMessage(runBatch.error)}
            </p>
          ) : null}

          <div className="mt-3 border border-border bg-background/70">
            <p className="border-b border-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Recent Batch Runs
            </p>
            <div className="max-h-48 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted sticky top-0 text-[10px] uppercase">
                  <tr>
                    <th className="px-2 py-1.5">Run</th>
                    <th className="px-2 py-1.5">Engine</th>
                    <th className="px-2 py-1.5">Status</th>
                    <th className="px-2 py-1.5">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {(batchHistory.data?.items ?? []).length === 0 ? (
                    <tr>
                      <td className="px-2 py-2 text-muted-foreground" colSpan={4}>
                        No persisted runs yet.
                      </td>
                    </tr>
                  ) : (
                    (batchHistory.data?.items ?? []).map((run, index) => (
                      <tr key={run.run_id ?? `${run.started_at ?? "run"}-${index}`} className="border-t border-border">
                        <td className="px-2 py-1.5">{run.run_id?.slice(0, 8) ?? "-"}</td>
                        <td className="px-2 py-1.5">{run.engine}</td>
                        <td className="px-2 py-1.5">{run.status}</td>
                        <td className="px-2 py-1.5">{run.duration_ms ?? 0} ms</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
          <div className="border-border bg-background/70 max-h-115 overflow-auto border">
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
