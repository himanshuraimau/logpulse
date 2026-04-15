import { useQuery } from "@tanstack/react-query"

import { getLiveMetrics } from "@/api/logs"

export function useLiveMetrics(windowSize = 200) {
  return useQuery({
    queryKey: ["live-metrics", windowSize],
    queryFn: () => getLiveMetrics(windowSize),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
}
