import { useQuery } from "@tanstack/react-query"

import { getRecentLogs } from "@/api/logs"

export function useRecentLogs(limit = 50) {
  return useQuery({
    queryKey: ["recent-logs", limit],
    queryFn: () => getRecentLogs(limit),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
}
