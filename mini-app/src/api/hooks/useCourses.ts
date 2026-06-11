import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCourses, getCourseDetail, joinCourse } from '../client'

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

export function useJoinCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (inviteCode: string) => joinCourse(inviteCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      queryClient.invalidateQueries({ queryKey: ['course'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
