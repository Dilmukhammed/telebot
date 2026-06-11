// Dashboard
export { useDashboard } from './useDashboard'

// Courses
export { useCourses, useCourseDetail, useJoinCourse } from './useCourses'

// Calendar
export { useCalendar } from './useCalendar'

// Announcements
export { useAnnouncements, useAnnouncementDetail, useMarkAnnouncementRead } from './useAnnouncements'

// Tests
export { useTests, useTest, useRegisterForTest, useCancelRegistration } from './useTests'

// Registrations & Results
export { useMyRegistrations, useMyResults } from './useRegistrations'

// Teacher
export {
  useTeacherDashboard,
  useTeacherStudents,
  useTeacherStudentDetail,
  useTeacherCourses,
  useCourseStudents,
  useAvailability,
  useCreateAvailability,
  useDeleteAvailability,
  useMarkLessonStatus,
  useMarkAttendance,
  useLessonAttendance,
  useUpdateLesson,
  useEnrollmentRequests,
  useApproveEnrollment,
  useRejectEnrollment,
} from './useTeacher'

// Lesson
export { useLessonDetail } from './useLesson'

// Materials
export { useMaterials, useCreateMaterial, useUploadMaterial, useDeleteMaterial } from './useMaterials'

// Admin
export {
  useAdminStats,
  useAdminLessons,
  prefetchAdminLessons,
  useToggleLessonActive,
  useRescheduleLesson,
  useCancelAdminLesson,
  useMarkAdminLessonStatus,
  useAdminLessonAttendance,
  useAdminMarkAttendance,
  useAdminUpdateLesson,
  useAdminEnrollStudent,
  useAdminUnenrollStudent,
  useAdminSubjects,
  useAdminSubjectDetail,
  useArchiveSubject,
  useUnarchiveSubject,
  useDeleteAdminSubject,
  useCreateAdminSubject,
  useUpdateSubject,
  useAdminCreateLesson,
  useAdminUsers,
  useAdminUser,
  useUpdateAdminUserRole,
  useCreateAdminUser,
  useAdminAnnouncements,
  useAdminAnnouncementDetail,
  useAdminAnnouncementRecipients,
  useCreateAdminAnnouncement,
  useAdminAuditLog,
  useTeachersForSchedule,
  useAdminSearchCourses,
} from './useAdmin'
