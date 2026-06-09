import { useQuery } from '@tanstack/react-query'
import { getCourses, getCourseDetail } from '../client'

export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: getCourses,
    staleTime: 2 * 60_000, // курсы меняются редко
  })
}

export function useCourseDetail(id: number) {
  return useQuery({
    queryKey: ['course', id],
    queryFn: () => getCourseDetail(id),
    enabled: !!id,
  })
}
