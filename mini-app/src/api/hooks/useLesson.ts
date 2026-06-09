import { useQuery } from '@tanstack/react-query'
import { getLessonDetail } from '../client'

export function useLessonDetail(id: number, date?: string) {
  return useQuery({
    queryKey: ['lesson', id, date],
    queryFn: () => getLessonDetail(id, date),
    enabled: !!id,
  })
}
