import { useQuery } from "@tanstack/react-query"

import { getHealth } from "@/api/logs"

export function useBackendHealth() {
  return useQuery({
    queryKey: ["backend-health"],
    queryFn: getHealth,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
}
