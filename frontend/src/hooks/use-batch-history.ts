import { useQuery } from "@tanstack/react-query"

import { getBatchMetrics } from "@/api/logs"

export function useBatchHistory(limit = 20) {
  return useQuery({
    queryKey: ["batch-history", limit],
    queryFn: () => getBatchMetrics(limit),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
}
