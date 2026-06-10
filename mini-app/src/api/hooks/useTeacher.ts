import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getTeacherDashboard,
  getTeacherStudents,
  getTeacherStudentDetail,
  getTeacherCourses,
  getCourseStudents,
  getAvailability,
  createAvailability,
  deleteAvailability,
  markLessonStatus,
  markAttendance,
  getLessonAttendance,
  updateLesson,
  getEnrollmentRequests,
  approveEnrollment,
  rejectEnrollment,
} from '../client'

export function useTeacherDashboard() {
  return useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: getTeacherDashboard,
    staleTime: 60_000,
  })
}

export function useTeacherStudents() {
  return useQuery({
    queryKey: ['teacher-students'],
    queryFn: getTeacherStudents,
    staleTime: 30_000,
  })
}

export function useTeacherStudentDetail(studentId: number) {
  return useQuery({
    queryKey: ['teacher-student', studentId],
    queryFn: () => getTeacherStudentDetail(studentId),
    enabled: !!studentId,
  })
}

export function useTeacherCourses() {
  return useQuery({
    queryKey: ['teacher-courses'],
    queryFn: getTeacherCourses,
    staleTime: 60_000,
  })
}

export function useCourseStudents(courseId: number) {
  return useQuery({
    queryKey: ['course-students', courseId],
    queryFn: () => getCourseStudents(courseId),
    enabled: !!courseId,
  })
}

export function useAvailability() {
  return useQuery({
    queryKey: ['availability'],
    queryFn: getAvailability,
    staleTime: 60_000,
  })
}

export function useCreateAvailability() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { day_of_week: number; start_time: string; end_time: string }) =>
      createAvailability(data.day_of_week, data.start_time, data.end_time),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}

export function useDeleteAvailability() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteAvailability(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}

export function useMarkLessonStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { lessonId: number; date: string; status: 'happened' | 'cancelled' }) =>
      markLessonStatus(data.lessonId, data.date, data.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

export function useMarkAttendance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { lessonId: number; date: string; records: { user_id: number; present: boolean }[] }) =>
      markAttendance(data.lessonId, data.date, data.records),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] })
    },
  })
}

export function useLessonAttendance(lessonId: number, date: string) {
  return useQuery({
    queryKey: ['lesson-attendance', lessonId, date],
    queryFn: () => getLessonAttendance(lessonId, date),
    enabled: !!lessonId && !!date,
  })
}

export function useUpdateLesson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { lessonId: number; custom_title?: string | null; lesson_plan?: string | null }) =>
      updateLesson(data.lessonId, { custom_title: data.custom_title, lesson_plan: data.lesson_plan }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson'] })
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] })
    },
  })
}

export function useEnrollmentRequests() {
  return useQuery({
    queryKey: ['enrollment-requests'],
    queryFn: getEnrollmentRequests,
    staleTime: 10_000,
  })
}

export function useApproveEnrollment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestId: number) => approveEnrollment(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment-requests'] })
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['teacher-students'] })
      queryClient.invalidateQueries({ queryKey: ['teacher-courses'] })
    },
  })
}

export function useRejectEnrollment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestId: number) => rejectEnrollment(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment-requests'] })
    },
  })
}
