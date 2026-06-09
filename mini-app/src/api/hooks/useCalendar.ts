import { useQuery } from '@tanstack/react-query'
import { getCalendar } from '../client'

export function useCalendar(weekOffset: number) {
  return useQuery({
    queryKey: ['calendar', weekOffset],
    queryFn: () => getCalendar(weekOffset),
    staleTime: 60_000,
    placeholderData: (prev) => prev, // показывать предыдущую неделю пока грузится новая
  })
}
