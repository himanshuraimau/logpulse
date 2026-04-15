import { useQuery } from "@tanstack/react-query"

import { getAnomalyDetail } from "@/api/logs"

export function useAnomalyDetail(
  eventId: string | null,
  contextLimit = 20,
  enabled = true
) {
  return useQuery({
    queryKey: ["anomaly-detail", eventId, contextLimit],
    queryFn: () => getAnomalyDetail(eventId as string, contextLimit),
    enabled: enabled && Boolean(eventId),
  })
}
