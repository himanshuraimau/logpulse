import { useMutation, useQueryClient } from "@tanstack/react-query"

import { runBatchJob } from "@/api/logs"

export function useRunBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: runBatchJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch-status"] })
    },
  })
}
