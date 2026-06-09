import datetime as dt

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def utcnow():
    return dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    duration_weeks: Mapped[int | None] = mapped_column(Integer, default=12, nullable=True)  # Course duration in weeks (None = indefinite)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=90)  # Lesson duration in minutes
    start_date: Mapped[dt.datetime | None] = mapped_column(DateTime, default=utcnow, nullable=True)  # Course start date

    tests: Mapped[list["Test"]] = relationship("Test", back_populates="subject")
    lessons: Mapped[list["Lesson"]] = relationship("Lesson", back_populates="subject")


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    subject_id: Mapped[int] = mapped_column(Integer, ForeignKey("subjects.id"), nullable=False, index=True)
    teacher_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # FK to teacher
    teacher_name: Mapped[str] = mapped_column(String, nullable=False)  # Keep for backward compatibility
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon, 1=Tue, ..., 6=Sun
    time: Mapped[str] = mapped_column(String, nullable=False)  # "16:00"
    room: Mapped[str] = mapped_column(String, nullable=False)  # "Каб. 3"
    location: Mapped[str | None] = mapped_column(String, nullable=True)  # "г. Ташкент, ул. Фидокор, 7А"
    max_capacity: Mapped[int] = mapped_column(Integer, default=15)  # Max students per lesson
    lesson_plan: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: [{"title": "...", "description": "..."}]
    custom_title: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    subject: Mapped["Subject"] = relationship("Subject", back_populates="lessons")
    teacher: Mapped["User | None"] = relationship("User", foreign_keys=[teacher_id], back_populates="teaching_lessons")
    enrollments: Mapped[list["LessonEnrollment"]] = relationship("LessonEnrollment", back_populates="lesson")
    attendances: Mapped[list["Attendance"]] = relationship("Attendance", back_populates="lesson")
    lesson_statuses: Mapped[list["LessonStatus"]] = relationship("LessonStatus", back_populates="lesson")


class LessonEnrollment(Base):
    __tablename__ = "lesson_enrollments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lesson_id: Mapped[int] = mapped_column(Integer, ForeignKey("lessons.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    enrolled_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)

    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="enrollments")
    user: Mapped["User"] = relationship("User", back_populates="lesson_enrollments")

    __table_args__ = (UniqueConstraint("lesson_id", "user_id", name="uq_lesson_user"),)


class Attendance(Base):
    """Track student attendance for each lesson instance."""
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lesson_id: Mapped[int] = mapped_column(Integer, ForeignKey("lessons.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False)  # Specific date of the lesson
    present: Mapped[bool] = mapped_column(Boolean, default=False)  # True if present
    marked_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)  # Teacher who marked
    marked_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="attendances")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="attendances")
    marker: Mapped["User | None"] = relationship("User", foreign_keys=[marked_by])

    __table_args__ = (UniqueConstraint("lesson_id", "user_id", "date", name="uq_lesson_user_date"),)


class LessonStatus(Base):
    """Track whether a specific lesson instance happened or was cancelled."""
    __tablename__ = "lesson_statuses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lesson_id: Mapped[int] = mapped_column(Integer, ForeignKey("lessons.id"), nullable=False, index=True)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)  # "happened", "cancelled", or "rescheduled"
    marked_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    marked_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    override_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    override_time: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str | None] = mapped_column(String, nullable=True)

    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="lesson_statuses")
    marker: Mapped["User | None"] = relationship("User", foreign_keys=[marked_by])

    __table_args__ = (
        UniqueConstraint("lesson_id", "date", name="uq_lesson_date"),
        CheckConstraint("status IN ('happened', 'cancelled', 'rescheduled')", name="ck_lesson_status_status"),
    )


class TeacherAvailability(Base):
    """Recurring weekly availability slots for teachers."""
    __tablename__ = "teacher_availability"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    teacher_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon..6=Sun
    start_time: Mapped[str] = mapped_column(String, nullable=False)  # "HH:MM"
    end_time: Mapped[str] = mapped_column(String, nullable=False)  # "HH:MM"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    teacher: Mapped["User"] = relationship("User", foreign_keys=[teacher_id], back_populates="availabilities")

    __table_args__ = (UniqueConstraint("teacher_id", "day_of_week", "start_time", name="uq_teacher_day_start"),)


class Notification(Base):
    """Store notification history."""
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sender_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)  # Admin/teacher who sent
    title: Mapped[str] = mapped_column(String, nullable=True)  # Short title
    message: Mapped[str] = mapped_column(String, nullable=False)  # Full message text
    target_type: Mapped[str] = mapped_column(String, nullable=False, index=True)  # all, teachers, students, course, teacher_students
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # teacher_id or subject_id
    sent_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow, index=True)

    sender: Mapped["User | None"] = relationship("User", foreign_keys=[sender_id])


class NotificationRecipient(Base):
    """Store individual recipients for targeted notifications (teacher_students type)."""
    __tablename__ = "notification_recipients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    notification_id: Mapped[int] = mapped_column(Integer, ForeignKey("notifications.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    notification: Mapped["Notification"] = relationship("Notification", backref="recipients")
    user: Mapped["User"] = relationship("User")


class Test(Base):
    __tablename__ = "tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    subject_id: Mapped[int] = mapped_column(Integer, ForeignKey("subjects.id"), nullable=False)
    datetime: Mapped[dt.datetime] = mapped_column(DateTime, nullable=False)
    max_capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    format: Mapped[str] = mapped_column(String, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    subject: Mapped["Subject"] = relationship("Subject", back_populates="tests")
    registrations: Mapped[list["Registration"]] = relationship("Registration", back_populates="test")


class Registration(Base):
    __tablename__ = "registrations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    test_id: Mapped[int] = mapped_column(Integer, ForeignKey("tests.id"), nullable=False)
    telegram_id: Mapped[int] = mapped_column(Integer, nullable=False)
    username: Mapped[str | None] = mapped_column(String, nullable=True)
    first_name: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="registered")
    registered_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)

    test: Mapped["Test"] = relationship("Test", back_populates="registrations")
    result: Mapped["Result"] = relationship("Result", back_populates="registration", uselist=False)

    __table_args__ = (UniqueConstraint("test_id", "telegram_id", name="uq_test_telegram"),)


class Result(Base):
    __tablename__ = "results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    registration_id: Mapped[int] = mapped_column(Integer, ForeignKey("registrations.id"), unique=True, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    max_score: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    registration: Mapped["Registration"] = relationship("Registration", back_populates="result")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    telegram_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    username: Mapped[str | None] = mapped_column(String, nullable=True)  # Telegram @username
    first_name: Mapped[str | None] = mapped_column(String, nullable=True)  # Real name (from Telegram or admin)
    last_name: Mapped[str | None] = mapped_column(String, nullable=True)
    language_code: Mapped[str] = mapped_column(String, default="ru")
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    grade: Mapped[str | None] = mapped_column(String, nullable=True)  # 1-11 or custom
    role: Mapped[str] = mapped_column(String, default="student")  # admin, teacher, student
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    lesson_enrollments: Mapped[list["LessonEnrollment"]] = relationship("LessonEnrollment", back_populates="user")
    teaching_lessons: Mapped[list["Lesson"]] = relationship("Lesson", foreign_keys=[Lesson.teacher_id], back_populates="teacher")
    attendances: Mapped[list["Attendance"]] = relationship("Attendance", foreign_keys=[Attendance.user_id], back_populates="user")
    availabilities: Mapped[list["TeacherAvailability"]] = relationship("TeacherAvailability", foreign_keys=[TeacherAvailability.teacher_id], back_populates="teacher")

    __table_args__ = (CheckConstraint("role IN ('student', 'teacher', 'admin')", name="ck_user_role"),)


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    telegram_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)


class AuditLog(Base):
    """Track all mutations for audit trail."""
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    entity_type: Mapped[str] = mapped_column(String, nullable=False, index=True)  # "subject", "lesson", "attendance", etc.
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)  # "update", "create", "delete", "enroll", etc.
    field_name: Mapped[str | None] = mapped_column(String, nullable=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    performed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    performed_by_type: Mapped[str | None] = mapped_column(String, nullable=True)  # "admin" or "teacher"
    performed_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow, index=True)

    __table_args__ = (
        Index("ix_audit_entity", "entity_type", "entity_id"),
    )
