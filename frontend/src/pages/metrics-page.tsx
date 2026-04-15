import { useMemo } from "react"

import { useLiveMetrics } from "@/hooks/use-live-metrics"
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
    <section className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Live Summary</CardTitle>
          <CardDescription>
            Current rolling metrics from backend stream memory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant={metricsQuery.data ? "success" : "warning"}>
              {metricsQuery.isFetching ? "updating" : "snapshot"}
            </Badge>
            <Badge variant="outline">
              Window {metricsQuery.data?.window_size ?? 0}
            </Badge>
          </div>
          <div className="space-y-2 text-xs">
            <p>
              Total events: <strong>{metricsQuery.data?.total_events ?? 0}</strong>
            </p>
            <p>
              Anomalies: <strong>{metricsQuery.data?.anomalies ?? 0}</strong>
            </p>
            <p>
              5xx errors: <strong>{metricsQuery.data?.errors ?? 0}</strong>
            </p>
            <p>
              Last sequence: <strong>{metricsQuery.data?.last_sequence ?? 0}</strong>
            </p>
          </div>
          {metricsQuery.isError ? (
            <p className="text-xs text-red-700 dark:text-red-300">
              Failed to load live metrics: {getErrorMessage(metricsQuery.error)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Service Breakdown</CardTitle>
          <CardDescription>
            Service-level totals, anomalies, and server errors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-border bg-background/70 max-h-110 overflow-auto border">
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
                      No service metrics yet.
                    </td>
                  </tr>
                ) : (
                  serviceRows.map(([service, value]) => (
                    <tr key={service} className="border-border border-t">
                      <td className="px-2 py-1.5">{service}</td>
                      <td className="px-2 py-1.5">{value.total}</td>
                      <td className="px-2 py-1.5">{value.anomalies}</td>
                      <td className="px-2 py-1.5">{value.errors}</td>
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
