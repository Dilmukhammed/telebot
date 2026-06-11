import WebApp from '@twa-dev/sdk'
import type { TestOut, RegistrationOut, ResultOut, UserOut, OnboardingData, DashboardOut, CalendarWeekOut, CourseOut, CourseDetailOut, LessonDetailOut, TeacherDashboardOut, TeacherStudentsOut, TeacherStudentDetailOut, AnnouncementOut, AnnouncementRecipient, TeacherStudentOut, LessonStatusOut, AttendanceRecordIn, AttendanceListOut, TeacherAvailabilityOut, AdminStats, AdminLessonOut, SearchResultOut, AdminAnnouncementCreate, AdminAnnouncementOut, AdminSubjectOut, AdminSubjectDetailOut, AuditLogOut, AdminSubjectCreate, MaterialOut, MaterialCreate } from '../shared/types'

const BASE_URL = import.meta.env.VITE_API_URL || ''
const REQUEST_TIMEOUT_MS = 30_000

/** Normalize browser time input (HH:MM or HH:MM:SS) to HH:MM for API. */
function normalizeTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Send initData for HMAC validation on server.
  // X-Telegram-User fallback removed — it had no signature and allowed impersonation.
  const initData = WebApp.initData
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData
  }

  return headers
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`
  const authHeaders = getAuthHeaders()

  // Add request timeout to prevent permanent UI freezes on hanging server
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...authHeaders, ...(options.headers as Record<string, string> || {}) },
      signal: controller.signal,
      // Bypass browser HTTP cache — React Query manages staleness.
      // Without this, Cache-Control: max-age=X on the server causes the browser
      // to return stale cached responses even after invalidateQueries().
      cache: 'no-store',
    })

    if (!response.ok) {
      let message = `Error (${response.status})`
      try {
        const body = await response.json()
        if (body.detail) {
          message = Array.isArray(body.detail)
            ? body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('; ') || message
            : typeof body.detail === 'string' ? body.detail : message
        }
      } catch { /* ignore */ }
      throw new Error(message)
    }

    // Handle 204 No Content and empty responses
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as T
    }

    return response.json() as Promise<T>
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.')
    }
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error('Network error — could not reach the server')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

export function getTests(): Promise<TestOut[]> {
  return api<TestOut[]>('/api/tests')
}

export function getTest(id: number): Promise<TestOut> {
  return api<TestOut>(`/api/tests/${id}`)
}

export function registerForTest(id: number): Promise<RegistrationOut> {
  return api<RegistrationOut>(`/api/tests/${id}/register`, {
    method: 'POST',
  })
}

export function getMyRegistrations(): Promise<RegistrationOut[]> {
  return api<RegistrationOut[]>('/api/registrations/my')
}

export function cancelRegistration(id: number): Promise<void> {
  return api<void>(`/api/registrations/${id}/cancel`, {
    method: 'POST',
  })
}

export function getMyResults(): Promise<ResultOut[]> {
  return api<ResultOut[]>('/api/results/my')
}

export function getMe(): Promise<UserOut> {
  return api<UserOut>('/api/users/me')
}

export function completeOnboarding(data: OnboardingData): Promise<UserOut> {
  return api<UserOut>('/api/users/onboarding', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getDashboard(): Promise<DashboardOut> {
  return api<DashboardOut>('/api/dashboard')
}

export function getCalendar(weekOffset: number = 0): Promise<CalendarWeekOut> {
  return api<CalendarWeekOut>(`/api/dashboard/calendar?week_offset=${weekOffset}`)
}

export function getCourses(): Promise<CourseOut[]> {
  return api<CourseOut[]>('/api/courses')
}

export function getCourseDetail(id: number): Promise<CourseDetailOut> {
  return api<CourseDetailOut>(`/api/courses/${id}`)
}

export function joinCourse(inviteCode: string): Promise<{ message: string; subject_name: string }> {
  return api('/api/courses/join', {
    method: 'POST',
    body: JSON.stringify({ invite_code: inviteCode }),
  })
}

export function getLessonDetail(id: number, date?: string): Promise<LessonDetailOut> {
  const params = date ? `?date=${date}` : ''
  return api<LessonDetailOut>(`/api/courses/lessons/${id}${params}`)
}

export function getTeacherDashboard(): Promise<TeacherDashboardOut> {
  return api<TeacherDashboardOut>('/api/teacher/dashboard')
}

export function getTeacherStudents(): Promise<TeacherStudentsOut> {
  return api<TeacherStudentsOut>('/api/teacher/students')
}

export function getTeacherStudentDetail(studentId: number): Promise<TeacherStudentDetailOut> {
  return api<TeacherStudentDetailOut>(`/api/teacher/students/${studentId}`)
}

export function getAnnouncements(): Promise<AnnouncementOut[]> {
  return api<AnnouncementOut[]>('/api/dashboard/announcements')
}

export function getTeacherAnnouncements(): Promise<AnnouncementOut[]> {
  return api<AnnouncementOut[]>('/api/teacher/announcements')
}

export function getTeacherAnnouncementDetail(id: number): Promise<AnnouncementOut> {
  return api<AnnouncementOut>(`/api/teacher/announcements/${id}`)
}

export function getAnnouncementRecipients(id: number): Promise<AnnouncementRecipient[]> {
  return api<AnnouncementRecipient[]>(`/api/teacher/announcements/${id}/recipients`)
}

export function markAnnouncementAsRead(id: number): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/dashboard/announcements/${id}/read`, { method: 'POST' })
}

export function createAnnouncement(data: {
  title?: string
  message: string
  target_type: 'course' | 'students'
  course_ids?: number[]
  student_ids?: number[]
}): Promise<AnnouncementOut> {
  return api<AnnouncementOut>('/api/teacher/announcements', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getTeacherCourses(): Promise<{ id: number; name: string; student_count: number }[]> {
  return api('/api/teacher/courses')
}

export function getCourseStudents(courseId: number): Promise<TeacherStudentOut[]> {
  return api<TeacherStudentOut[]>(`/api/teacher/courses/${courseId}/students`)
}

export function getAnnouncementDetail(id: number): Promise<AnnouncementOut> {
  return api<AnnouncementOut>(`/api/dashboard/announcements/${id}`)
}

export function updateName(first_name: string, last_name?: string): Promise<UserOut> {
  return api<UserOut>('/api/users/me/name', {
    method: 'PUT',
    body: JSON.stringify({ first_name, last_name }),
  })
}

export function markLessonStatus(lessonId: number, date: string, status: 'happened' | 'cancelled'): Promise<LessonStatusOut> {
  return api<LessonStatusOut>(`/api/teacher/lessons/${lessonId}/status`, {
    method: 'POST',
    body: JSON.stringify({ lesson_id: lessonId, date, status }),
  })
}

export function markAttendance(lessonId: number, date: string, records: AttendanceRecordIn[]): Promise<AttendanceListOut> {
  return api<AttendanceListOut>(`/api/teacher/lessons/${lessonId}/attendance`, {
    method: 'POST',
    body: JSON.stringify({ lesson_id: lessonId, date, records }),
  })
}

export function getLessonAttendance(lessonId: number, date: string): Promise<AttendanceListOut> {
  return api<AttendanceListOut>(`/api/teacher/lessons/${lessonId}/attendance?date=${date}`)
}

export interface EnrollmentRequestOut {
  id: number
  subject_id: number
  subject_name: string
  user_id: number
  user_name: string
  photo_url?: string | null
  username?: string | null
  grade?: string | null
  status: string
  created_at: string
}

export function getEnrollmentRequests(): Promise<EnrollmentRequestOut[]> {
  return api<EnrollmentRequestOut[]>('/api/teacher/enrollment-requests')
}

export function approveEnrollment(requestId: number): Promise<{ message: string }> {
  return api(`/api/teacher/enrollment-requests/${requestId}/approve`, { method: 'POST' })
}

export function rejectEnrollment(requestId: number): Promise<{ message: string }> {
  return api(`/api/teacher/enrollment-requests/${requestId}/reject`, { method: 'POST' })
}

export function updateLesson(lessonId: number, data: { custom_title?: string | null; lesson_plan?: string | null }): Promise<LessonDetailOut> {
  return api<LessonDetailOut>(`/api/teacher/lessons/${lessonId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function getAvailability(): Promise<TeacherAvailabilityOut[]> {
  return api<TeacherAvailabilityOut[]>('/api/teacher/availability')
}

export function createAvailability(day_of_week: number, start_time: string, end_time: string): Promise<TeacherAvailabilityOut> {
  return api<TeacherAvailabilityOut>('/api/teacher/availability', {
    method: 'POST',
    body: JSON.stringify({ day_of_week, start_time, end_time }),
  })
}

export function deleteAvailability(id: number): Promise<void> {
  return api<void>(`/api/teacher/availability/${id}`, { method: 'DELETE' })
}

// ── Admin API ──────────────────────────────────────────────────────

export function getAdminStats(): Promise<AdminStats> {
  return api<AdminStats>('/api/admin/stats')
}

export function getAdminLessons(params: { week_offset?: number; teacher_id?: number; subject_id?: number } = {}): Promise<AdminLessonOut[]> {
  const searchParams = new URLSearchParams()
  if (params.week_offset !== undefined) searchParams.append('week_offset', String(params.week_offset))
  if (params.teacher_id !== undefined) searchParams.append('teacher_id', String(params.teacher_id))
  if (params.subject_id !== undefined) searchParams.append('subject_id', String(params.subject_id))
  const query = searchParams.toString()
  return api<AdminLessonOut[]>(`/api/admin/lessons${query ? '?' + query : ''}`)
}

export function adminSearchCourses(params: { days: number[]; time_from: string; time_to: string; teacher_id?: number; subject_id?: number }): Promise<SearchResultOut> {
  const searchParams = new URLSearchParams()
  params.days.forEach(day => searchParams.append('days', String(day)))
  searchParams.append('time_from', normalizeTime(params.time_from))
  searchParams.append('time_to', normalizeTime(params.time_to))
  if (params.teacher_id !== undefined) searchParams.append('teacher_id', String(params.teacher_id))
  if (params.subject_id !== undefined) searchParams.append('subject_id', String(params.subject_id))
  return api<SearchResultOut>(`/api/admin/search?${searchParams.toString()}`)
}

export function rescheduleLesson(lessonId: number, data: { date: string; new_date: string; new_time?: string }): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/admin/lessons/${lessonId}/reschedule`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function cancelAdminLesson(lessonId: number, data: { date: string }): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/admin/lessons/${lessonId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function markAdminLessonStatus(lessonId: number, data: { date: string; status: string }): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/admin/lessons/${lessonId}/status`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getAdminAnnouncements(): Promise<AdminAnnouncementOut[]> {
  return api<AdminAnnouncementOut[]>('/api/admin/announcements')
}

export function getAdminAnnouncementDetail(id: number): Promise<AdminAnnouncementOut> {
  return api<AdminAnnouncementOut>(`/api/admin/announcements/${id}`)
}

export function getAdminAnnouncementRecipients(id: number): Promise<AnnouncementRecipient[]> {
  return api<AnnouncementRecipient[]>(`/api/admin/announcements/${id}/recipients`)
}

export function createAdminAnnouncement(data: AdminAnnouncementCreate): Promise<AdminAnnouncementOut> {
  return api<AdminAnnouncementOut>('/api/admin/announcements', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getAdminSubjects(archived: boolean = false): Promise<AdminSubjectOut[]> {
  return api<AdminSubjectOut[]>(`/api/admin/subjects?archived=${archived}`)
}

export function getAdminSubjectDetail(id: number): Promise<AdminSubjectDetailOut> {
  return api<AdminSubjectDetailOut>(`/api/admin/subjects/${id}`)
}

export function archiveAdminSubject(id: number): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/admin/subjects/${id}/archive`, { method: 'PATCH' })
}

export function unarchiveAdminSubject(id: number): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/admin/subjects/${id}/unarchive`, { method: 'PATCH' })
}

export function createAdminSubject(data: AdminSubjectCreate): Promise<AdminSubjectDetailOut> {
  return api<AdminSubjectDetailOut>('/api/admin/subjects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getTeachersForSchedule(schedule: { day_of_week: number; time: string; duration_minutes?: number }[]): Promise<UserOut[]> {
  return api<UserOut[]>('/api/admin/teachers-for-schedule', {
    method: 'POST',
    body: JSON.stringify(schedule.map(slot => ({
      ...slot,
      time: normalizeTime(slot.time),
    }))),
  })
}

export function getAdminUsers(params: { role?: string } = {}): Promise<UserOut[]> {
  const searchParams = new URLSearchParams()
  if (params.role) searchParams.append('role', params.role)
  const query = searchParams.toString()
  return api<UserOut[]>(`/api/admin/users${query ? '?' + query : ''}`)
}

export function getAdminUser(id: number): Promise<UserOut> {
  return api<UserOut>(`/api/admin/users/${id}`)
}

export function updateAdminUserRole(id: number, role: string): Promise<UserOut> {
  return api<UserOut>(`/api/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export function createAdminUser(data: {
  first_name: string
  last_name: string
  username: string
  phone: string
}): Promise<UserOut> {
  return api<UserOut>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function toggleAdminLessonActive(lessonId: number): Promise<{ ok: boolean; is_active: boolean }> {
  return api<{ ok: boolean; is_active: boolean }>(`/api/admin/lessons/${lessonId}/toggle-active`, { method: 'PATCH' })
}

export function adminEnrollStudent(lessonId: number, userId: number): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/admin/lessons/${lessonId}/enroll`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  })
}

export function adminUnenrollStudent(lessonId: number, userId: number): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/admin/lessons/${lessonId}/enroll/${userId}`, { method: 'DELETE' })
}

export function adminGetLessonAttendance(lessonId: number, date: string): Promise<AttendanceListOut> {
  return api<AttendanceListOut>(`/api/admin/lessons/${lessonId}/attendance?date=${date}`)
}

export function adminMarkAttendance(lessonId: number, date: string, records: AttendanceRecordIn[]): Promise<AttendanceListOut> {
  return api<AttendanceListOut>(`/api/admin/lessons/${lessonId}/attendance`, {
    method: 'POST',
    body: JSON.stringify({ lesson_id: lessonId, date, records }),
  })
}

export function adminUpdateLesson(lessonId: number, data: { custom_title?: string | null; lesson_plan?: string | null }): Promise<LessonDetailOut> {
  return api<LessonDetailOut>(`/api/admin/lessons/${lessonId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function updateSubject(id: number, data: { name?: string; description?: string; start_date?: string; duration_weeks?: number; duration_minutes?: number }): Promise<AdminSubjectDetailOut> {
  return api<AdminSubjectDetailOut>(`/api/admin/subjects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function adminCreateLesson(subjectId: number, data: { teacher_name: string; teacher_id?: number; day_of_week: number; time: string; room: string; location?: string; max_capacity?: number }): Promise<AdminLessonOut> {
  return api<AdminLessonOut>(`/api/admin/subjects/${subjectId}/lessons`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getAdminAuditLog(params?: { entity_type?: string; entity_id?: number; limit?: number }): Promise<AuditLogOut[]> {
  const searchParams = new URLSearchParams()
  if (params?.entity_type) searchParams.append('entity_type', params.entity_type)
  if (params?.entity_id) searchParams.append('entity_id', String(params.entity_id))
  if (params?.limit) searchParams.append('limit', String(params.limit))
  const query = searchParams.toString()
  return api<AuditLogOut[]>(`/api/admin/audit-log${query ? '?' + query : ''}`)
}

// ── Materials API ──────────────────────────────────────────────────

export function getMaterials(subjectId?: number, lessonId?: number): Promise<MaterialOut[]> {
  const params = new URLSearchParams()
  if (subjectId !== undefined) params.append('subject_id', String(subjectId))
  if (lessonId !== undefined) params.append('lesson_id', String(lessonId))
  return api<MaterialOut[]>(`/api/materials?${params.toString()}`)
}

export function createMaterial(data: MaterialCreate): Promise<MaterialOut> {
  return api<MaterialOut>('/api/materials', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function uploadMaterial(file: File, title: string, subjectId?: number, lessonId?: number): Promise<MaterialOut> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('title', title)
  if (subjectId !== undefined) formData.append('subject_id', String(subjectId))
  if (lessonId !== undefined) formData.append('lesson_id', String(lessonId))

  const url = `${BASE_URL}/api/materials/upload`
  const authHeaders = getAuthHeaders()
  // Remove Content-Type for FormData (browser sets it with boundary)
  const { 'Content-Type': _, ...headers } = authHeaders

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    let message = `Error (${response.status})`
    try {
      const body = await response.json()
      if (body.detail) message = body.detail
    } catch { /* ignore */ }
    throw new Error(message)
  }

  return response.json()
}

export function deleteMaterial(id: number): Promise<void> {
  return api<void>(`/api/materials/${id}`, { method: 'DELETE' })
}