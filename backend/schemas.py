from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime
from typing import Optional, Generic, TypeVar, List


T = TypeVar('T')


class TestOut(BaseModel):
    id: int
    subject_name: str
    datetime: str
    max_capacity: int
    format: str
    duration_minutes: int
    registered_count: int
    has_capacity: bool
    is_active: bool


class TestCreate(BaseModel):
    subject_name: str = Field(max_length=100)
    datetime: str = Field(max_length=50)
    max_capacity: int = Field(ge=1)
    format: str = Field(max_length=20)
    duration_minutes: int = Field(ge=1)


class TestUpdate(BaseModel):
    subject_name: Optional[str] = None
    datetime: Optional[str] = None
    max_capacity: Optional[int] = None
    format: Optional[str] = None
    duration_minutes: Optional[int] = None
    is_active: Optional[bool] = None


class RegistrationOut(BaseModel):
    id: int
    test_id: int
    test_subject: str
    test_datetime: str
    status: str
    registered_at: str


class RegistrationCreate(BaseModel):
    pass


class ResultOut(BaseModel):
    id: int
    registration_id: int
    test_subject: str
    test_datetime: str
    score: int
    max_score: int
    comment: Optional[str]
    created_at: str


class ResultCreate(BaseModel):
    registration_id: int
    score: int = Field(ge=0)
    max_score: int = Field(ge=1)
    comment: Optional[str] = Field(default=None, max_length=1000)


class ResultUpdate(BaseModel):
    score: Optional[int] = Field(default=None, ge=0)
    max_score: Optional[int] = Field(default=None, ge=1)
    comment: Optional[str] = None


class ProfileThemeOut(BaseModel):
    card_theme: str = "default"
    status_emoji: Optional[str] = None
    status_text: Optional[str] = None


class ProfileThemeUpdate(BaseModel):
    card_theme: Optional[str] = Field(
        default=None,
        pattern="^(default|lavender|mint|dusk|slate|rose|ocean)$",
    )
    status_emoji: Optional[str] = Field(default=None, max_length=8)
    status_text: Optional[str] = Field(default=None, max_length=60)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    telegram_id: int
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    language_code: str
    is_premium: bool
    photo_url: Optional[str]
    phone: Optional[str]
    grade: Optional[str]
    role: str
    is_active: bool
    onboarded: bool
    phone_verified: bool = False
    profile_theme: ProfileThemeOut = ProfileThemeOut()
    created_at: str


class UserRoleUpdate(BaseModel):
    role: str = Field(pattern="^(admin|teacher|student)$")


class OnboardingData(BaseModel):
    grade: Optional[str] = Field(default=None, max_length=50)
    phone: Optional[str] = Field(default=None, max_length=20)


class TeacherCreateIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    username: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=1, max_length=20)


class AdminLogin(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=100)


class AdminToken(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ApiResponse(BaseModel, Generic[T]):
    data: Optional[T] = None
    message: str = "ok"


# Course schemas
class CourseOut(BaseModel):
    id: int
    name: str
    teacher_name: str
    lesson_count: int


class CourseLessonOut(BaseModel):
    id: int
    lesson_number: int
    title: str
    day_name: str
    day_of_week: int
    time: str
    end_time: str
    room: str
    location: Optional[str] = None
    teacher_name: str
    status: str  # "today", "upcoming", "past"
    date: str
    is_frozen: bool = False  # Archived course: future lesson instances are frozen


class CourseDetailOut(BaseModel):
    id: int
    name: str
    teacher_name: str
    description: str
    location: Optional[str] = None
    lesson_count: int
    duration_weeks: Optional[int] = None  # Course duration in weeks (None = indefinite)
    duration_minutes: int = 90  # Lesson duration in minutes
    start_date: Optional[str] = None  # Course start date ("YYYY-MM-DD")
    invite_code: Optional[str] = None
    is_archived: bool = False
    archived_at: Optional[str] = None
    lessons: list[CourseLessonOut]


# Lesson schemas
class LessonOut(BaseModel):
    id: int
    subject_name: str
    teacher_name: str
    day_of_week: int  # 0=Mon, 1=Tue, ..., 6=Sun
    time: str  # "16:00"
    room: str  # "Каб. 3"
    is_active: bool


class MaterialOut(BaseModel):
    id: int
    title: str
    type: str  # "file", "video", "youtube", "link", "text"
    url: Optional[str] = None
    content: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    created_by: int
    created_at: str


class MaterialCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    type: str = Field(pattern="^(file|image|video|youtube|link|text)$")
    subject_id: Optional[int] = None
    lesson_id: Optional[int] = None
    url: Optional[str] = None
    content: Optional[str] = None


class MaterialUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    content: Optional[str] = None


class MaterialDuplicateOut(BaseModel):
    duplicate: bool
    material: Optional[MaterialOut] = None


# Legacy alias for backward compatibility
LessonMaterialOut = MaterialOut


class LessonAgendaItemOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None


class LessonHomeworkOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None
    status: str = "pending"  # "pending", "submitted", "graded"


class LessonDetailOut(BaseModel):
    id: int
    subject_id: int
    subject_name: str
    title: str
    teacher_name: str
    teacher_username: Optional[str] = None
    teacher_title: Optional[str] = None
    teacher_photo_url: Optional[str] = None
    day_of_week: int
    day_name: str
    time: str
    end_time: str
    room: str
    location: Optional[str] = None
    date: str
    status: str  # "today", "upcoming", "past"
    duration_minutes: int
    materials: list[LessonMaterialOut] = []
    agenda: list[LessonAgendaItemOut] = []
    homework: Optional[LessonHomeworkOut] = None
    lesson_status: Optional[str] = None  # "happened", "cancelled", or None (unmarked)
    is_teacher: bool = False
    custom_title: Optional[str] = None


class DashboardLessonOut(BaseModel):
    id: int
    subject_id: int
    subject_name: str
    teacher_name: str
    day_label: str  # "Сегодня", "Завтра", "Пятница"
    time: str       # "16:00"
    room: str       # "Каб. 3"
    date: str       # "2024-10-23"


class DashboardResultOut(BaseModel):
    id: int
    subject_name: str
    score: int
    max_score: int
    icon: str  # "assignment", "emoji_events"


class DashboardProfileOut(BaseModel):
    first_name: str
    grade: Optional[str]
    photo_url: Optional[str]


class StudentDashboardStatsOut(BaseModel):
    lessons_this_week: int
    total_courses: int


class DashboardNotificationOut(BaseModel):
    id: int
    title: Optional[str] = None
    message: str
    sent_at: str  # Format: "2024-10-23T16:00:00"
    sender_name: Optional[str] = None  # "Admin" or teacher name
    sender_role: Optional[str] = None  # "admin" or "teacher"
    sender_id: Optional[int] = None
    is_read: bool = False


class NotificationAttachmentOut(BaseModel):
    id: int
    title: str
    type: str  # "file" or "link"
    url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None


class DashboardOut(BaseModel):
    profile: DashboardProfileOut
    lessons: list[DashboardLessonOut]
    results: list[DashboardResultOut]
    stats: Optional[StudentDashboardStatsOut] = None
    notifications: list[DashboardNotificationOut] = []
    unread_count: int = 0  # Total unread announcements (not limited to top 3)


class NotificationCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    message: str = Field(max_length=2000)
    target_type: str = Field(pattern="^(course|students)$")
    course_ids: Optional[list[int]] = None  # subject_ids for "course" (multiple)
    student_ids: Optional[list[int]] = None  # for "students"
    attachment_ids: Optional[list[int]] = None  # IDs of pre-uploaded NotificationAttachment rows


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    duration_weeks: Optional[int] = Field(default=None, ge=1)
    duration_minutes: Optional[int] = Field(default=None, ge=1)


# Lesson Status schemas
class LessonUpdateIn(BaseModel):
    custom_title: Optional[str] = None
    lesson_plan: Optional[str] = None  # JSON string of [{"title", "description"}]


class AdminLessonScheduleUpdate(BaseModel):
    """Update recurring slot schedule/teacher; applies from effective_from (default: today)."""
    day_of_week: Optional[int] = Field(default=None, ge=0, le=6)
    time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    room: Optional[str] = Field(default=None, max_length=100)
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = Field(default=None, max_length=200)
    effective_from: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class LessonStatusIn(BaseModel):
    lesson_id: int
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    status: str = Field(pattern="^(happened|cancelled|rescheduled)$")


class LessonStatusOut(BaseModel):
    lesson_id: int
    date: str
    status: str
    marked_by: Optional[int] = None
    marked_at: Optional[str] = None


# Attendance schemas
class AttendanceRecordIn(BaseModel):
    user_id: int
    present: bool


class AttendanceBulkIn(BaseModel):
    lesson_id: int
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    records: list[AttendanceRecordIn]


class AttendanceRecordOut(BaseModel):
    user_id: int
    first_name: str
    username: Optional[str] = None
    present: bool


class AttendanceListOut(BaseModel):
    lesson_id: int
    date: str
    status: Optional[str] = None  # LessonStatus.status if exists
    saved: bool = False  # True if attendance records already exist in DB
    records: list[AttendanceRecordOut]


class TeacherAvailabilityIn(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(pattern=r"^\d{2}:\d{2}$")


class TeacherAvailabilityOut(BaseModel):
    id: int
    day_of_week: int
    start_time: str
    end_time: str
    specific_date: Optional[str] = None
    is_active: bool


class AvailabilityRequestIn(BaseModel):
    lesson_id: int
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(pattern=r"^\d{2}:\d{2}$")


class AvailabilityRequestOut(BaseModel):
    id: int
    lesson_id: int
    teacher_id: int
    date: str
    start_time: str
    end_time: str
    status: str
    created_at: str
    subject_name: Optional[str] = None
    teacher_name: Optional[str] = None


# --- Admin Panel Schemas ---

class AdminStatsOut(BaseModel):
    student_count: int
    teacher_count: int
    course_count: int
    active_tests: int
    today_lessons: list[DashboardLessonOut]


class AdminAvailabilitySlot(BaseModel):
    id: int
    start_time: str
    end_time: str


class AdminLessonOut(BaseModel):
    id: int
    subject_id: int
    subject_name: str
    teacher_name: str
    teacher_id: Optional[int] = None
    day_of_week: int
    day_name: str
    time: str
    end_time: str
    room: str
    student_count: int
    lesson_status: Optional[str] = None
    date: str
    available_slots: list[AdminAvailabilitySlot] = []


class CancelLessonIn(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


class RescheduleIn(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")  # The original lesson date to reschedule
    new_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    new_time: Optional[str] = None  # "HH:MM"


class AdminAnnouncementCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    message: str = Field(max_length=2000)
    target_type: str = Field(pattern="^(all|teachers|students|course|teacher_courses|specific_students)$")
    target_id: Optional[int] = None  # teacher_id for teacher_courses
    course_ids: Optional[list[int]] = None
    student_ids: Optional[list[int]] = None
    attachment_ids: Optional[list[int]] = None  # IDs of pre-uploaded NotificationAttachment rows


class AdminAnnouncementOut(BaseModel):
    id: int
    title: Optional[str] = None
    message: str
    target_type: str
    target_summary: str
    target_id: Optional[int] = None
    recipient_count: int
    sent_at: str
    sender_name: Optional[str] = None


class SearchCourseResult(BaseModel):
    id: int
    lesson_id: int
    name: str
    teacher_name: str
    day_of_week: int
    day_name: str
    time: str
    end_time: str
    room: str
    student_count: int
    max_capacity: int
    spots_left: int
    has_open_slots: bool


class SearchAvailabilityResult(BaseModel):
    teacher_id: int
    teacher_name: str
    day_of_week: int
    day_name: str
    start_time: str
    end_time: str


class SearchResultOut(BaseModel):
    courses: list[SearchCourseResult]
    open_slots: list[SearchAvailabilityResult]


class AdminSubjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    duration_minutes: int = 90
    lesson_count: int = 0
    student_count: int = 0
    teacher_names: list[str] = []
    is_archived: bool = False
    is_deleted: bool = False
    invite_code: Optional[str] = None


class AdminSubjectDetailOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    duration_minutes: int = 90
    duration_weeks: Optional[int] = None
    start_date: Optional[str] = None
    is_archived: bool = False
    is_deleted: bool = False
    archived_at: Optional[str] = None
    invite_code: Optional[str] = None
    lessons: list[AdminLessonOut] = []
    students: list[UserOut] = []


class LessonStatusMarkIn(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    status: str = Field(pattern="^(happened|cancelled|rescheduled)$")


# --- Admin Lesson Create ---

class AdminLessonCreate(BaseModel):
    teacher_name: str = Field(max_length=200)
    teacher_id: Optional[int] = None
    day_of_week: int = Field(ge=0, le=6)
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    room: str = Field(max_length=100)
    location: Optional[str] = None
    max_capacity: int = Field(default=15, ge=1)


class ScheduleSlot(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    time: str = Field(pattern=r"^\d{2}:\d{2}(:\d{2})?$")
    room: str = Field(max_length=100)


class ScheduleTimeSlot(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    time: str = Field(pattern=r"^\d{2}:\d{2}(:\d{2})?$")
    duration_minutes: int = Field(default=90, ge=1)


class AdminSubjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    duration_weeks: Optional[int] = Field(default=None, ge=1)  # None = indefinite
    duration_minutes: int = Field(default=90, ge=1)
    teacher_id: Optional[int] = None
    max_capacity: int = Field(default=15, ge=1)
    schedule: list[ScheduleSlot] = Field(min_length=1)
    student_ids: list[int] = []


class AdminSubjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_weeks: Optional[int] = None  # None = keep current, 0 or null = indefinite
    duration_minutes: Optional[int] = None
    start_date: Optional[str] = None


class EnrollStudentIn(BaseModel):
    user_id: int


# --- Audit Log ---

class AuditLogOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    action: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    performed_by: Optional[int] = None
    performed_by_name: Optional[str] = None
    performed_by_type: Optional[str] = None
    performed_at: str


# --- Enrollment ---

class JoinCourseIn(BaseModel):
    invite_code: str = Field(min_length=6, max_length=6)


class EnrollmentRequestOut(BaseModel):
    id: int
    subject_id: int
    subject_name: str
    user_id: int
    user_name: str
    photo_url: Optional[str] = None
    username: Optional[str] = None
    grade: Optional[str] = None
    status: str
    created_at: str