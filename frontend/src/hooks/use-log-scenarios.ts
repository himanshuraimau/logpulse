import { useQuery } from "@tanstack/react-query"

import { getLogScenarios } from "@/api/logs"

export function useLogScenarios() {
  return useQuery({
    queryKey: ["log-scenarios"],
    queryFn: getLogScenarios,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
