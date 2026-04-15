import { useMutation, useQueryClient } from "@tanstack/react-query"

import { analyzeAnomaly, type AnalyzeAnomalyPayload } from "@/api/logs"

export function useAgentAnalyze() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: AnalyzeAnomalyPayload) => analyzeAnomaly(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-reports"] })
    },
  })
}
