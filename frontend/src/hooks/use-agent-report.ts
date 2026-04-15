import { useQuery } from "@tanstack/react-query"

import { getAgentReportById } from "@/api/logs"

export function useAgentReport(reportId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["agent-report", reportId],
    queryFn: () => getAgentReportById(reportId as string),
    enabled: enabled && Boolean(reportId),
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
}
