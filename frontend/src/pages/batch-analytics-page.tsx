import { useMemo } from "react"

import { useBatchHistory } from "@/hooks/use-batch-history"
import { useBatchStatus } from "@/hooks/use-batch-status"
import { useRunBatch } from "@/hooks/use-run-batch"
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
    <section className="space-y-4">
      <PageHeader
        title="Batch Analytics"
        description="Inspect scheduled aggregation readiness and compare persisted run outputs."
        actions={
          <>
            <Badge variant={batchStatus.data?.status === "ok" ? "success" : "outline"}>
              Status {latestRun?.status ?? "idle"}
            </Badge>
            <Badge variant={latestRun?.engine === "pyspark" ? "success" : "warning"}>
              Engine {latestRun?.engine ?? "none"}
            </Badge>
            <Badge variant="outline">Window {batchStatus.data?.configured_window_events ?? 0}</Badge>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>Run Controls</CardTitle>
            <CardDescription>
              Trigger one-off batch processing and monitor the latest execution snapshot.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Total events</p>
                <p className="text-lg font-semibold">{latestRun?.total_events ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Services</p>
                <p className="text-lg font-semibold">{latestRun?.service_count ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-lg font-semibold">{latestRun?.duration_ms ?? 0} ms</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Interval</p>
                <p className="text-lg font-semibold">{batchStatus.data?.configured_interval_seconds ?? 0}s</p>
              </div>
            </div>

            <Button onClick={() => runBatch.mutate()} disabled={runBatch.isPending}>
              {runBatch.isPending ? "Running..." : "Run Batch Once"}
            </Button>

            {batchStatus.data?.warning ? (
              <p className="text-sm text-muted-foreground">Warning: {batchStatus.data.warning}</p>
            ) : null}

            {batchStatus.isError ? (
              <p className="text-sm text-red-700 dark:text-red-300">
                Failed to load batch status: {getErrorMessage(batchStatus.error)}
              </p>
            ) : null}
            {batchHistory.isError ? (
              <p className="text-sm text-red-700 dark:text-red-300">
                Failed to load batch history: {getErrorMessage(batchHistory.error)}
              </p>
            ) : null}
            {runBatch.isError ? (
              <p className="text-sm text-red-700 dark:text-red-300">
                Batch run failed: {getErrorMessage(runBatch.error)}
              </p>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-border/70 bg-background/70">
              <div className="border-b border-border/70 px-3 py-2 text-xs font-medium text-muted-foreground">
                Recent Batch Runs
              </div>
              <div className="max-h-56 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-[11px] font-medium text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Run</th>
                      <th className="px-3 py-2">Engine</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(batchHistory.data?.items ?? []).length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={4}>
                          No persisted runs yet.
                        </td>
                      </tr>
                    ) : (
                      (batchHistory.data?.items ?? []).map((run, index) => (
                        <tr
                          key={run.run_id ?? `${run.started_at ?? "run"}-${index}`}
                          className="border-t border-border/60 hover:bg-muted/30"
                        >
                          <td className="px-3 py-2">{run.run_id?.slice(0, 8) ?? "-"}</td>
                          <td className="px-3 py-2">{run.engine}</td>
                          <td className="px-3 py-2">{run.status}</td>
                          <td className="px-3 py-2">{run.duration_ms ?? 0} ms</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-8">
          <CardHeader>
            <CardTitle>Service Aggregates</CardTitle>
            <CardDescription>
              Current batch summary by service, anomalies, and server errors.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-border/70 bg-background/70">
              <div className="max-h-115 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-[11px] font-medium text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Service</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Anomalies</th>
                      <th className="px-3 py-2">5xx errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={4}>
                          Run the batch scaffold to generate service aggregates.
                        </td>
                      </tr>
                    ) : (
                      serviceRows.map((item) => (
                        <tr key={item.service} className="border-t border-border/60 hover:bg-muted/30">
                          <td className="px-3 py-2">{item.service}</td>
                          <td className="px-3 py-2">{item.total}</td>
                          <td className="px-3 py-2">{item.anomalies}</td>
                          <td className="px-3 py-2">{item.errors}</td>
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
