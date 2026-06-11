import { useQuery } from '@tanstack/react-query'
import { getCalendar } from '../client'

export function useCalendar(weekOffset: number, userId?: number) {
  return useQuery({
    queryKey: ['calendar', weekOffset, userId],
    queryFn: () => getCalendar(weekOffset, userId),
    staleTime: 60_000,
    placeholderData: (prev) => prev, // показывать предыдущую неделю пока грузится новая
  })
}
