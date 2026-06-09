import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAnnouncements,
  getTeacherAnnouncements,
  getAnnouncementDetail,
  getTeacherAnnouncementDetail,
  markAnnouncementAsRead,
} from '../client'

export function useAnnouncements(role: string) {
  return useQuery({
    queryKey: ['announcements', role],
    queryFn: role === 'student' ? getAnnouncements : getTeacherAnnouncements,
    staleTime: 30_000,
  })
}

export function useAnnouncementDetail(id: number, role: string) {
  return useQuery({
    queryKey: ['announcement', id],
    queryFn: () =>
      role === 'student'
        ? getAnnouncementDetail(id)
        : getTeacherAnnouncementDetail(id),
    enabled: !!id,
  })
}

export function useMarkAnnouncementRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => markAnnouncementAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
