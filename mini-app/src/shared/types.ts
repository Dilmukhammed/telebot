export interface TestOut {
  id: number;
  subject_name: string;
  datetime: string;
  max_capacity: number;
  format: 'online' | 'offline';
  duration_minutes: number;
  registered_count: number;
  has_capacity: boolean;
  is_active: boolean;
}

export interface TestCreate {
  subject_name: string;
  datetime: string;
  max_capacity: number;
  format: 'online' | 'offline';
  duration_minutes: number;
}

export interface TestUpdate {
  subject_name?: string;
  datetime?: string;
  max_capacity?: number;
  format?: 'online' | 'offline';
  duration_minutes?: number;
  is_active?: boolean;
}

export interface RegistrationOut {
  id: number;
  test_id: number;
  test_subject: string;
  test_datetime: string;
  status: string;
  registered_at: string;
}

export interface RegistrationCreate {}

export interface ResultOut {
  id: number;
  registration_id: number;
  test_subject: string;
  test_datetime: string;
  score: number;
  max_score: number;
  comment?: string;
  created_at: string;
}

export interface ResultCreate {
  registration_id: number;
  score: number;
  max_score: number;
  comment?: string;
}

export interface ResultUpdate {
  score?: number;
  max_score?: number;
  comment?: string;
}

export interface AdminLogin {
  username: string;
  password: string;
}

export interface AdminToken {
  access_token: string;
  token_type: string;
}

export interface ApiResponse<T> {
  data?: T;
  message: string;
}

export interface UserOut {
  id: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code: string;
  is_premium: boolean;
  photo_url?: string;
  phone?: string;
  grade?: string;
  role: string;
  is_active: boolean;
  onboarded: boolean;
  phone_verified: boolean;
  created_at: string;
}

export interface OnboardingData {
  grade: string;
  phone?: string;
}

// Dashboard types
export interface DashboardLessonOut {
  id: number;
  subject_id: number;
  subject_name: string;
  teacher_name: string;
  day_label: string;  // "Сегодня", "Завтра", "Пятница"
  time: string;       // "16:00"
  room: string;       // "Каб. 3"
  date: string;       // "2024-10-23"
}

export interface DashboardResultOut {
  id: number;
  subject_name: string;
  score: number;
  max_score: number;
  icon: string;  // "assignment", "emoji_events"
}

export interface DashboardProfileOut {
  first_name: string;
  grade?: string;
  photo_url?: string;
}

export interface StudentDashboardStatsOut {
  lessons_this_week: number;
  total_courses: number;
}

export interface DashboardNotificationOut {
  id: number;
  title?: string;
  message: string;
  sent_at: string;
  sender_name?: string;
  sender_role?: string;
}

export interface DashboardOut {
  profile: DashboardProfileOut;
  lessons: DashboardLessonOut[];
  results: DashboardResultOut[];
  stats?: StudentDashboardStatsOut;
  notifications: DashboardNotificationOut[];
}

// Announcement types
export interface AnnouncementOut {
  id: number;
  title?: string;
  message: string;
  sent_at: string;
  sender_name?: string;
  sender_role?: string;
  recipient_count?: number;
}

export interface AnnouncementRecipient {
  id: number;
  first_name: string;
  username?: string;
}

// Calendar types
export interface CalendarLessonOut {
  id: number;
  subject_name: string;
  teacher_name: string;
  day_of_week: number;  // 0=Mon, 6=Sun
  time: string;         // "16:00"
  end_time: string;     // "17:30"
  room: string;
  status: string;       // "planned", "completed", "today"
}

export interface AvailableSlot {
  id: number;
  start_time: string;
  end_time: string;
}

export interface CalendarDayOut {
  date: string;         // "2024-10-23"
  day_of_week: number;  // 0=Mon
  day_name: string;     // "Пн"
  lessons: CalendarLessonOut[];
  available_slots: AvailableSlot[];
}

export interface CalendarWeekOut {
  days: CalendarDayOut[];
}

// Course creation types
export interface ScheduleSlot {
  day_of_week: number;
  time: string;
  room: string;
}

export interface AdminSubjectCreate {
  name: string;
  description?: string;
  duration_weeks?: number;
  duration_minutes?: number;
  teacher_id?: number;
  max_capacity?: number;
  schedule: ScheduleSlot[];
  student_ids?: number[];
}

// Course types
export interface CourseOut {
  id: number;
  name: string;
  teacher_name: string;
  lesson_count: number;
}

export interface CourseLessonOut {
  id: number;
  lesson_number: number;
  title: string;
  day_name: string;
  day_of_week: number;
  time: string;
  end_time: string;
  room: string;
  location?: string;
  teacher_name: string;
  status: 'today' | 'upcoming' | 'past';
  date: string;
}

export interface CourseDetailOut {
  id: number;
  name: string;
  teacher_name: string;
  description: string;
  location?: string;
  lesson_count: number;
  duration_weeks: number | null;
  duration_minutes: number;
  start_date?: string | null;
  lessons: CourseLessonOut[];
}

// Lesson detail types
export interface LessonMaterialOut {
  id: number;
  title: string;
  type: 'slides' | 'worksheet' | 'video' | 'document';
  url?: string;
}

export interface LessonAgendaItemOut {
  id: number;
  title: string;
  description?: string;
}

export interface LessonHomeworkOut {
  id: number;
  title: string;
  description?: string;
  due_date?: string;
  status: 'pending' | 'submitted' | 'graded';
}

export interface LessonDetailOut {
  id: number;
  subject_id: number;
  subject_name: string;
  title: string;
  teacher_name: string;
  teacher_username?: string;
  teacher_title?: string;
  teacher_photo_url?: string;
  day_of_week: number;
  day_name: string;
  time: string;
  end_time: string;
  room: string;
  location?: string;
  date: string;
  status: 'today' | 'upcoming' | 'past';
  duration_minutes: number;
  materials: LessonMaterialOut[];
  agenda: LessonAgendaItemOut[];
  homework?: LessonHomeworkOut;
  lesson_status?: string | null;
  is_teacher?: boolean;
}

// Teacher Dashboard types
export interface TeacherDashboardLessonOut {
  id: number;
  subject_id: number;
  subject_name: string;
  day_label: string;  // "Сегодня", "Завтра", "Пятница"
  time: string;       // "16:00"
  room: string;       // "Каб. 3"
  student_count: number;
}

export interface TeacherDashboardStatsOut {
  lessons_this_week: number;
  total_students: number;
}

export interface TeacherDashboardProfileOut {
  first_name: string;
  photo_url?: string;
}

export interface TeacherAvailabilityOut {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface TeacherDashboardOut {
  profile: TeacherDashboardProfileOut;
  stats: TeacherDashboardStatsOut;
  lessons: TeacherDashboardLessonOut[];
}

// Teacher Students types
export interface TeacherStudentOut {
  id: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  phone?: string;
  grade?: string;
}

export interface TeacherStudentsOut {
  students: TeacherStudentOut[];
  total: number;
}

// Teacher Student Detail types
export interface TeacherStudentCourseAttendance {
  subject_id: number;
  subject_name: string;
  total_lessons: number;
  attended_lessons: number;
  attendance_percent: number;
}

export interface TeacherStudentDetailOut {
  id: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  phone?: string;
  grade?: string;
  courses: TeacherStudentCourseAttendance[];
}

// Lesson Status types
export interface LessonStatusOut {
  lesson_id: number;
  date: string;
  status: 'happened' | 'cancelled';
  marked_by?: number;
  marked_at?: string;
}

// Attendance types
export interface AttendanceRecordIn {
  user_id: number;
  present: boolean;
}

export interface AttendanceRecordOut {
  user_id: number;
  first_name: string;
  username?: string;
  present: boolean;
}

export interface AttendanceListOut {
  lesson_id: number;
  date: string;
  status?: string;
  saved: boolean;
  records: AttendanceRecordOut[];
}

// ── Admin types ──────────────────────────────────────────────────────

export interface AdminStats {
  student_count: number;
  teacher_count: number;
  course_count: number;
  active_tests: number;
  today_lessons: DashboardLessonOut[];
}

export interface AdminLessonOut {
  id: number;
  subject_id: number;
  subject_name: string;
  teacher_name: string;
  teacher_id: number | null;
  day_of_week: number;
  day_name: string;
  time: string;
  end_time: string;
  room: string;
  student_count: number;
  lesson_status: string | null;
  date: string;
}

export interface SearchCourseResult {
  id: number;
  name: string;
  teacher_name: string;
  day_of_week: number;
  day_name: string;
  time: string;
  end_time: string;
  room: string;
  student_count: number;
  has_open_slots: boolean;
}

export interface SearchAvailabilityResult {
  teacher_id: number;
  teacher_name: string;
  day_of_week: number;
  day_name: string;
  start_time: string;
  end_time: string;
}

export interface SearchResultOut {
  courses: SearchCourseResult[];
  open_slots: SearchAvailabilityResult[];
}

export interface AdminAnnouncementCreate {
  title?: string;
  message: string;
  target_type: 'all' | 'teachers' | 'students' | 'course' | 'teacher_courses' | 'specific_students';
  target_id?: number;
  course_ids?: number[];
  student_ids?: number[];
}

export interface AdminAnnouncementOut {
  id: number;
  title?: string;
  message: string;
  target_type: string;
  target_summary: string;
  target_id?: number;
  recipient_count: number;
  sent_at: string;
  sender_name?: string;
}

export interface AdminSubjectOut {
  id: number;
  name: string;
  description?: string;
  duration_minutes: number;
  lesson_count: number;
  student_count: number;
  teacher_names: string[];
}

export interface AdminSubjectDetailOut {
  id: number;
  name: string;
  description?: string;
  duration_minutes: number;
  duration_weeks?: number;
  start_date?: string;
  lessons: AdminLessonOut[];
  students: UserOut[];
}

// Audit log
export interface AuditLogOut {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  performed_by?: number;
  performed_by_name?: string;
  performed_by_type: string;
  performed_at: string;
}