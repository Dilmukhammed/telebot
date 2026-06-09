import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAdminStats,
  getAdminLessons,
  getAdminSubjects,
  getAdminSubjectDetail,
  getAdminUsers,
  getAdminUser,
  updateAdminUserRole,
  createAdminUser,
  getAdminAnnouncements,
  getAdminAnnouncementDetail,
  getAdminAnnouncementRecipients,
  createAdminAnnouncement,
  archiveAdminSubject,
  unarchiveAdminSubject,
  createAdminSubject,
  updateSubject,
  adminCreateLesson,
  toggleAdminLessonActive,
  adminEnrollStudent,
  adminUnenrollStudent,
  rescheduleLesson,
  cancelAdminLesson,
  markAdminLessonStatus,
  adminGetLessonAttendance,
  adminMarkAttendance,
  adminUpdateLesson,
  getAdminAuditLog,
  getTeachersForSchedule,
  adminSearchCourses,
} from '../client'

// ── Stats ──
export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: getAdminStats,
    staleTime: 30_000,
  })
}

// ── Lessons ──
export function useAdminLessons(filters: { week_offset?: number; teacher_id?: number; subject_id?: number }) {
  return useQuery({
    queryKey: ['admin-lessons', filters],
    queryFn: () => getAdminLessons(filters),
    staleTime: 30_000,
  })
}

export function useToggleLessonActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (lessonId: number) => toggleAdminLessonActive(lessonId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-lessons'] })
      qc.invalidateQueries({ queryKey: ['admin-subjects'] })
    },
  })
}

export function useRescheduleLesson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { lessonId: number; date: string; new_date: string; new_time?: string }) =>
      rescheduleLesson(data.lessonId, { date: data.date, new_date: data.new_date, new_time: data.new_time }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-lessons'] }),
  })
}

export function useCancelAdminLesson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { lessonId: number; date: string }) =>
      cancelAdminLesson(data.lessonId, { date: data.date }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-lessons'] }),
  })
}

export function useMarkAdminLessonStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { lessonId: number; date: string; status: string }) =>
      markAdminLessonStatus(data.lessonId, { date: data.date, status: data.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-lessons'] }),
  })
}

export function useAdminLessonAttendance(lessonId: number, date: string) {
  return useQuery({
    queryKey: ['admin-lesson-attendance', lessonId, date],
    queryFn: () => adminGetLessonAttendance(lessonId, date),
    enabled: !!lessonId && !!date,
  })
}

export function useAdminMarkAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { lessonId: number; date: string; records: { user_id: number; present: boolean }[] }) =>
      adminMarkAttendance(data.lessonId, data.date, data.records),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-lesson-attendance'] }),
  })
}

export function useAdminUpdateLesson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { lessonId: number; custom_title?: string | null; lesson_plan?: string | null }) =>
      adminUpdateLesson(data.lessonId, { custom_title: data.custom_title, lesson_plan: data.lesson_plan }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-lessons'] }),
  })
}

export function useAdminEnrollStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { lessonId: number; userId: number }) =>
      adminEnrollStudent(data.lessonId, data.userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-lessons'] })
      qc.invalidateQueries({ queryKey: ['admin-subjects'] })
    },
  })
}

export function useAdminUnenrollStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { lessonId: number; userId: number }) =>
      adminUnenrollStudent(data.lessonId, data.userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-lessons'] })
      qc.invalidateQueries({ queryKey: ['admin-subjects'] })
    },
  })
}

// ── Subjects ──
export function useAdminSubjects(archived: boolean = false) {
  return useQuery({
    queryKey: ['admin-subjects', archived],
    queryFn: () => getAdminSubjects(archived),
    staleTime: 30_000,
  })
}

export function useAdminSubjectDetail(id: number) {
  return useQuery({
    queryKey: ['admin-subject', id],
    queryFn: () => getAdminSubjectDetail(id),
    enabled: !!id,
  })
}

export function useArchiveSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => archiveAdminSubject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-subjects'] }),
  })
}

export function useUnarchiveSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => unarchiveAdminSubject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-subjects'] }),
  })
}

export function useCreateAdminSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createAdminSubject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-subjects'] }),
  })
}

export function useUpdateSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: number; name?: string; description?: string; start_date?: string; duration_weeks?: number; duration_minutes?: number }) =>
      updateSubject(data.id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-subjects'] }),
  })
}

export function useAdminCreateLesson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { subjectId: number; teacher_name: string; teacher_id?: number; day_of_week: number; time: string; room: string; location?: string; max_capacity?: number }) =>
      adminCreateLesson(data.subjectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-subjects'] }),
  })
}

// ── Users ──
export function useAdminUsers(role?: string) {
  return useQuery({
    queryKey: ['admin-users', role],
    queryFn: () => getAdminUsers({ role }),
    staleTime: 30_000,
  })
}

export function useAdminUser(id: number) {
  return useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => getAdminUser(id),
    enabled: !!id,
  })
}

export function useUpdateAdminUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: number; role: string }) =>
      updateAdminUserRole(data.id, data.role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}

export function useCreateAdminUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}

// ── Announcements ──
export function useAdminAnnouncements() {
  return useQuery({
    queryKey: ['admin-announcements'],
    queryFn: getAdminAnnouncements,
    staleTime: 30_000,
  })
}

export function useAdminAnnouncementDetail(id: number) {
  return useQuery({
    queryKey: ['admin-announcement', id],
    queryFn: () => getAdminAnnouncementDetail(id),
    enabled: !!id,
  })
}

export function useAdminAnnouncementRecipients(id: number) {
  return useQuery({
    queryKey: ['admin-announcement-recipients', id],
    queryFn: () => getAdminAnnouncementRecipients(id),
    enabled: !!id,
  })
}

export function useCreateAdminAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createAdminAnnouncement,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-announcements'] }),
  })
}

// ── Audit Log ──
export function useAdminAuditLog(params?: { entity_type?: string; entity_id?: number; limit?: number }) {
  return useQuery({
    queryKey: ['admin-audit-log', params],
    queryFn: () => getAdminAuditLog(params),
    staleTime: 10_000,
  })
}

// ── Search ──
export function useTeachersForSchedule() {
  return {
    mutateAsync: (schedule: { day_of_week: number; time: string; duration_minutes?: number }[]) =>
      getTeachersForSchedule(schedule),
  }
}

export function useAdminSearchCourses() {
  return {
    mutateAsync: (params: { days: number[]; time_from: string; time_to: string; teacher_id?: number; subject_id?: number }) =>
      adminSearchCourses(params),
  }
}
