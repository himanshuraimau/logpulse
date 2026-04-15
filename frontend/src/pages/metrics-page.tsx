import { useMemo } from "react"

import { useLiveMetrics } from "@/hooks/use-live-metrics"
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

export function MetricsPage() {
  const metricsQuery = useLiveMetrics(300)
  const serviceRows = useMemo(
    () =>
      Object.entries(metricsQuery.data?.services ?? {}).sort(
        (left, right) => right[1].total - left[1].total
      ),
    [metricsQuery.data?.services]
  )

  return (
    <section className="space-y-4">
      <PageHeader
        title="Live Metrics"
        description="Rolling operational metrics aggregated from recent stream activity."
        actions={
          <>
            <Badge variant={metricsQuery.data ? "success" : "warning"}>
              {metricsQuery.isFetching ? "Updating" : "Snapshot"}
            </Badge>
            <Badge variant="outline">Window {metricsQuery.data?.window_size ?? 0}</Badge>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>
              High-signal counters for stream health and anomaly pressure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Total events</p>
                <p className="text-lg font-semibold">{metricsQuery.data?.total_events ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Anomalies</p>
                <p className="text-lg font-semibold">{metricsQuery.data?.anomalies ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">5xx errors</p>
                <p className="text-lg font-semibold">{metricsQuery.data?.errors ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Last sequence</p>
                <p className="text-lg font-semibold">{metricsQuery.data?.last_sequence ?? 0}</p>
              </div>
            </div>

            {metricsQuery.isError ? (
              <p className="text-sm text-red-700 dark:text-red-300">
                Failed to load live metrics: {getErrorMessage(metricsQuery.error)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="xl:col-span-8">
          <CardHeader>
            <CardTitle>Service Breakdown</CardTitle>
            <CardDescription>
              Service-level totals with anomaly and server-error distribution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-border/70 bg-background/70">
              <div className="max-h-110 overflow-auto">
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
                          No service metrics yet.
                        </td>
                      </tr>
                    ) : (
                      serviceRows.map(([service, value]) => (
                        <tr key={service} className="border-t border-border/60 hover:bg-muted/30">
                          <td className="px-3 py-2">{service}</td>
                          <td className="px-3 py-2">{value.total}</td>
                          <td className="px-3 py-2">{value.anomalies}</td>
                          <td className="px-3 py-2">{value.errors}</td>
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
