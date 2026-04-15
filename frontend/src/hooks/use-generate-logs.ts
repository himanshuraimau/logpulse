import { useMutation, useQueryClient } from "@tanstack/react-query"

import { generateLogs, type GenerateLogsPayload } from "@/api/logs"

export function useGenerateLogs() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: GenerateLogsPayload) => generateLogs(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-logs"] })
      queryClient.invalidateQueries({ queryKey: ["stream-status"] })
      queryClient.invalidateQueries({ queryKey: ["backend-health"] })
    },
  })
}
