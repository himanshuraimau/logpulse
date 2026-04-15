import { useQuery } from "@tanstack/react-query"

import { getStreamStatus } from "@/api/logs"

export function useStreamStatus() {
  return useQuery({
    queryKey: ["stream-status"],
    queryFn: getStreamStatus,
    refetchInterval: 5000,
  })
}
