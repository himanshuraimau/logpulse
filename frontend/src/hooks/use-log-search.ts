import { useMutation } from "@tanstack/react-query"

import { searchLogs, type SearchLogsParams } from "@/api/logs"

export function useLogSearch() {
  return useMutation({
    mutationFn: (params: SearchLogsParams) => searchLogs(params),
  })
}
