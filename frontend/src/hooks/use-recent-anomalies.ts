import { useQuery } from "@tanstack/react-query"

import { getAnomalies } from "@/api/logs"

export function useRecentAnomalies(limit = 120, sinceMinutes = 240) {
  return useQuery({
    queryKey: ["recent-anomalies", limit, sinceMinutes],
    queryFn: () => getAnomalies(limit, sinceMinutes),
    refetchInterval: 12000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
}
