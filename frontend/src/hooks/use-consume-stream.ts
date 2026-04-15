import { useMutation, useQueryClient } from "@tanstack/react-query"

import { consumeStream } from "@/api/logs"

export function useConsumeStream() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (maxMessages: number) => consumeStream(maxMessages),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-logs"] })
      queryClient.invalidateQueries({ queryKey: ["stream-status"] })
      queryClient.invalidateQueries({ queryKey: ["backend-health"] })
    },
  })
}
