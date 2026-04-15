import { Navigate, Route, Routes } from "react-router-dom"

import { AppShell } from "@/components/layout/app-shell"
import { AgentConsolePage } from "@/pages/agent-console-page"
import { AnomalyTimelinePage } from "@/pages/anomaly-timeline-page"
import { BatchAnalyticsPage } from "@/pages/batch-analytics-page"
import { LiveLogsPage } from "@/pages/live-logs-page"
import { MetricsPage } from "@/pages/metrics-page"

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/live-logs" element={<LiveLogsPage />} />
        <Route path="/anomalies" element={<AnomalyTimelinePage />} />
        <Route path="/metrics" element={<MetricsPage />} />
        <Route path="/batch" element={<BatchAnalyticsPage />} />
        <Route path="/agent" element={<AgentConsolePage />} />
        <Route path="*" element={<Navigate replace to="/live-logs" />} />
      </Routes>
    </AppShell>
  )
}

export default App
