import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../client'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    staleTime: 15_000, // 15s — dashboard has notifications that need freshness
  })
}
