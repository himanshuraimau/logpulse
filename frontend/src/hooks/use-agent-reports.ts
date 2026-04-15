import { useQuery } from "@tanstack/react-query"

import { getAgentReports, type AgentReportsParams } from "@/api/logs"

export function useAgentReports(params: AgentReportsParams = {}) {
  return useQuery({
    queryKey: ["agent-reports", params.limit ?? 20, params.status ?? "all", params.eventId ?? "all"],
    queryFn: () => getAgentReports(params),
    refetchInterval: 6000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
}
