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

      // Snapshot previous values
      const queryKeys = queryClient.getQueriesData<AnnouncementOut[]>({ queryKey: ['announcements'] })

      // Optimistically update ALL announcement list caches
      for (const [key, data] of queryKeys) {
        if (data) {
          queryClient.setQueryData<AnnouncementOut[]>(key, (old) =>
            old?.map((a) => (a.id === id ? { ...a, is_read: true } : a))
          )
        }
      }

      // Also update the dashboard cache (notifications)
      queryClient.setQueriesData<any>({ queryKey: ['dashboard'] }, (old: any) => {
        if (!old?.notifications) return old
        return {
          ...old,
          notifications: old.notifications.map((n: any) =>
            n.id === id ? { ...n, is_read: true } : n
          ),
        }
      })

      return { queryKeys }
    },
    // If mutation fails, roll back
    onError: (_err, _id, context) => {
      if (context?.queryKeys) {
        for (const [key, data] of context.queryKeys) {
          if (data) queryClient.setQueryData(key, data)
        }
      }
    },
    // After mutation, refetch to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
