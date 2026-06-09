import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../client'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    staleTime: 60_000, // дашборд — 1 минута
  })
}
