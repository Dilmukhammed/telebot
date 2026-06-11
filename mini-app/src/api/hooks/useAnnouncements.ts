import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAnnouncements,
  getTeacherAnnouncements,
  getAnnouncementDetail,
  getTeacherAnnouncementDetail,
  markAnnouncementAsRead,
} from '../client'
import type { AnnouncementOut } from '../../shared/types'

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
    // Optimistic update: immediately mark as read in ALL cached announcement lists
    onMutate: async (id: number) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['announcements'] })
      await queryClient.cancelQueries({ queryKey: ['dashboard'] })

      // Snapshot previous values for rollback
      const announcementsSnapshot = queryClient.getQueriesData<AnnouncementOut[]>({ queryKey: ['announcements'] })
      const dashboardSnapshot = queryClient.getQueriesData<any>({ queryKey: ['dashboard'] })

      // Optimistically update ALL announcement list caches
      for (const [key, data] of announcementsSnapshot) {
        if (data) {
          queryClient.setQueryData<AnnouncementOut[]>(key, (old) =>
            old?.map((a) => (a.id === id ? { ...a, is_read: true } : a))
          )
        }
      }

      // Also update the dashboard cache (notifications)
      for (const [key, data] of dashboardSnapshot) {
        if (data?.notifications) {
          queryClient.setQueryData(key, {
            ...data,
            notifications: data.notifications.map((n: any) =>
              n.id === id ? { ...n, is_read: true } : n
            ),
          })
        }
      }

      return { announcementsSnapshot, dashboardSnapshot }
    },
    // If mutation fails, roll back ALL caches
    onError: (_err, _id, context) => {
      if (context?.announcementsSnapshot) {
        for (const [key, data] of context.announcementsSnapshot) {
          if (data) queryClient.setQueryData(key, data)
        }
      }
      if (context?.dashboardSnapshot) {
        for (const [key, data] of context.dashboardSnapshot) {
          if (data) queryClient.setQueryData(key, data)
        }
      }
    },
    // After mutation, refetch to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['announcement'] })
    },
  })
}
