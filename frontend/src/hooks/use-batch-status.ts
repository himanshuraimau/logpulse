import { useQuery } from "@tanstack/react-query"

import { getBatchStatus } from "@/api/logs"

export function useBatchStatus() {
  return useQuery({
    queryKey: ["batch-status"],
    queryFn: getBatchStatus,
    refetchInterval: 12000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
}
