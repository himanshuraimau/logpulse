import { useMemo, useState } from "react"

import { useAgentAnalyze } from "@/hooks/use-agent-analyze"
import { useAgentReport } from "@/hooks/use-agent-report"
import { useAgentReports } from "@/hooks/use-agent-reports"
import { useRecentAnomalies } from "@/hooks/use-recent-anomalies"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { getErrorMessage } from "@/lib/errors"
import { formatEventDateTime } from "@/lib/log-event"

const statusOptions = ["all", "queued", "running", "completed", "failed"]

export function AgentConsolePage() {
  const [eventId, setEventId] = useState("")
  const [contextLimit, setContextLimit] = useState(25)
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)

  const recentAnomalies = useRecentAnomalies(20, 240)
  const analyzeMutation = useAgentAnalyze()
  const reportsQuery = useAgentReports({
    limit: 30,
    status: statusFilter === "all" ? undefined : statusFilter,
  })

  const reports = useMemo(() => reportsQuery.data?.items ?? [], [reportsQuery.data?.items])
  const effectiveSelectedReportId = useMemo(() => {
    if (reports.length === 0) {
      return null
    }

    if (selectedReportId && reports.some((report) => report.report_id === selectedReportId)) {
      return selectedReportId
    }

    return reports[0].report_id
  }, [reports, selectedReportId])

  const selectedReportQuery = useAgentReport(
    effectiveSelectedReportId,
    Boolean(effectiveSelectedReportId)
  )
  const selectedReport =
    selectedReportQuery.data ??
    reports.find((report) => report.report_id === effectiveSelectedReportId) ??
    null

  const analyzeError = analyzeMutation.isError
    ? getErrorMessage(analyzeMutation.error)
    : null

  const onAnalyze = () => {
    const trimmedEventId = eventId.trim()
    if (!trimmedEventId) {
      return
    }

    analyzeMutation.mutate(
      {
        event_id: trimmedEventId,
        context_limit: contextLimit,
      },
      {
        onSuccess: (response) => {
          setSelectedReportId(response.report.report_id)
        },
      }
    )
  }

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>RCA Trigger</CardTitle>
          <CardDescription>
            Queue anomaly reports with contextual window size and monitor completion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant={reportsQuery.isFetching ? "warning" : "success"}>
              Reports {reportsQuery.isFetching ? "refreshing" : "ready"}
            </Badge>
            <Badge variant={analyzeMutation.isPending ? "warning" : "outline"}>
              Analyze {analyzeMutation.isPending ? "running" : "idle"}
            </Badge>
          </div>

          <div className="space-y-2">
            <label className="space-y-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Event ID
              <Input
                value={eventId}
                onChange={(event) => setEventId(event.target.value)}
                placeholder="Paste anomaly event_id"
              />
            </label>

            <label className="space-y-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Context Limit
              <Select
                value={String(contextLimit)}
                onChange={(event) => setContextLimit(Number(event.target.value))}
              >
                {[10, 20, 25, 40, 60, 100].map((value) => (
                  <option key={value} value={value}>
                    {value} events
                  </option>
                ))}
              </Select>
            </label>

            <Button onClick={onAnalyze} disabled={analyzeMutation.isPending || eventId.trim().length === 0}>
              {analyzeMutation.isPending ? "Queuing..." : "Queue RCA Analysis"}
            </Button>
          </div>

          {analyzeMutation.data ? (
            <p className="text-muted-foreground text-xs">
              Report queued: {analyzeMutation.data.report.report_id}
            </p>
          ) : null}

          {analyzeError ? (
            <p className="text-xs text-red-700 dark:text-red-300">Analyze failed: {analyzeError}</p>
          ) : null}

          <div className="mt-3 border border-border bg-background/70">
            <p className="border-b border-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Recent Anomalies
            </p>
            <div className="max-h-48 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted sticky top-0 text-[10px] uppercase">
                  <tr>
                    <th className="px-2 py-1.5">Event</th>
                    <th className="px-2 py-1.5">Service</th>
                    <th className="px-2 py-1.5">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentAnomalies.data?.items ?? []).length === 0 ? (
                    <tr>
                      <td className="px-2 py-2 text-muted-foreground" colSpan={3}>
                        No anomalies available.
                      </td>
                    </tr>
                  ) : (
                    (recentAnomalies.data?.items ?? []).map((item) => (
                      <tr
                        key={item.event_id}
                        className="cursor-pointer border-t border-border hover:bg-muted/40"
                        onClick={() => setEventId(item.event_id)}
                      >
                        <td className="px-2 py-1.5">{item.event_id.slice(0, 8)}</td>
                        <td className="px-2 py-1.5">{item.service}</td>
                        <td className="px-2 py-1.5">{formatEventDateTime(item.timestamp)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {recentAnomalies.isError ? (
            <p className="text-xs text-red-700 dark:text-red-300">
              Anomaly lookup failed: {getErrorMessage(recentAnomalies.error)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>RCA Reports</CardTitle>
          <CardDescription>Queue and completion states for generated reports.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="space-y-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Status Filter
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </label>

          {reportsQuery.isError ? (
            <p className="text-xs text-red-700 dark:text-red-300">
              Failed to load reports: {getErrorMessage(reportsQuery.error)}
            </p>
          ) : null}

          <div className="border-border bg-background/70 max-h-112 overflow-auto border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted sticky top-0 text-[10px] uppercase">
                <tr>
                  <th className="px-2 py-2">Report</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Event</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td className="px-2 py-3 text-muted-foreground" colSpan={3}>
                      No reports for current filter.
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr
                      key={report.report_id}
                      className="cursor-pointer border-t border-border hover:bg-muted/40"
                      onClick={() => setSelectedReportId(report.report_id)}
                    >
                      <td className="px-2 py-1.5">{report.report_id.slice(0, 8)}</td>
                      <td className="px-2 py-1.5">
                        <Badge
                          variant={
                            report.status === "completed"
                              ? "success"
                              : report.status === "failed"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {report.status}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5">{report.event_id.slice(0, 8)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Report Detail</CardTitle>
          <CardDescription>Structured RCA output with evidence and recommendation context.</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedReportQuery.isError ? (
            <p className="text-xs text-red-700 dark:text-red-300">
              Failed to load report detail: {getErrorMessage(selectedReportQuery.error)}
            </p>
          ) : null}

          {!selectedReport ? (
            <p className="text-xs text-muted-foreground">Select a report to inspect details.</p>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={
                    selectedReport.status === "completed"
                      ? "success"
                      : selectedReport.status === "failed"
                        ? "danger"
                        : "warning"
                  }
                >
                  {selectedReport.status}
                </Badge>
                <Badge variant="outline">Confidence {selectedReport.confidence ?? 0}</Badge>
                {selectedReport.fallback_used ? <Badge variant="warning">Fallback model</Badge> : null}
              </div>

              <div className="space-y-1 border border-border p-2">
                <p><strong>Report:</strong> {selectedReport.report_id}</p>
                <p><strong>Event:</strong> {selectedReport.event_id}</p>
                <p><strong>Created:</strong> {formatEventDateTime(selectedReport.created_at)}</p>
                <p><strong>Started:</strong> {formatEventDateTime(selectedReport.started_at)}</p>
                <p><strong>Completed:</strong> {formatEventDateTime(selectedReport.completed_at)}</p>
                <p><strong>Provider:</strong> {selectedReport.provider || "-"}</p>
                <p><strong>Model:</strong> {selectedReport.model || "-"}</p>
              </div>

              <div className="space-y-1 border border-border p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Summary</p>
                <p>{selectedReport.summary || "-"}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Root Cause</p>
                <p>{selectedReport.root_cause || "-"}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Impact</p>
                <p>{selectedReport.impact || "-"}</p>
                {selectedReport.error_message ? (
                  <p className="text-red-700 dark:text-red-300">Error: {selectedReport.error_message}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <div className="border border-border p-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Recommendations
                  </p>
                  <ul className="space-y-1">
                    {(selectedReport.recommendations ?? []).length === 0 ? (
                      <li className="text-muted-foreground">No recommendations.</li>
                    ) : (
                      (selectedReport.recommendations ?? []).map((item) => <li key={item}>- {item}</li>)
                    )}
                  </ul>
                </div>

                <div className="border border-border p-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Evidence</p>
                  <ul className="space-y-1">
                    {(selectedReport.evidence ?? []).length === 0 ? (
                      <li className="text-muted-foreground">No evidence captured.</li>
                    ) : (
                      (selectedReport.evidence ?? []).map((item) => <li key={item}>- {item}</li>)
                    )}
                  </ul>
                </div>

                <div className="border border-border p-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Timeline</p>
                  <ul className="space-y-1">
                    {(selectedReport.timeline ?? []).length === 0 ? (
                      <li className="text-muted-foreground">No timeline entries.</li>
                    ) : (
                      (selectedReport.timeline ?? []).map((item) => <li key={item}>- {item}</li>)
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
