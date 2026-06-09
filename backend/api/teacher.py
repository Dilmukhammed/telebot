import logging
from html import escape
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, distinct
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

from database import get_db
from models import User, Lesson, LessonEnrollment, Subject, Attendance, Notification, NotificationRecipient, LessonStatus
from api.deps import require_teacher

router = APIRouter(prefix="/teacher", tags=["teacher"])

DAY_NAMES_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]

TASHKENT_OFFSET = timedelta(hours=5)


def _to_tashkent_iso(utc_dt: datetime) -> str:
    """Convert naive UTC datetime to Tashkent time ISO string."""
    return (utc_dt + TASHKENT_OFFSET).isoformat()


def _get_day_label(lesson_day: int, today: int) -> str:
    if lesson_day == today:
        return "Сегодня"
    if lesson_day == (today + 1) % 7:
        return "Завтра"
    return DAY_NAMES_RU[lesson_day]


# Schemas (inline for simplicity)
from pydantic import BaseModel


class TeacherDashboardProfileOut(BaseModel):
    first_name: str
    photo_url: str | None = None


class TeacherDashboardStatsOut(BaseModel):
    lessons_this_week: int
    total_students: int


class TeacherDashboardLessonOut(BaseModel):
    id: int
    subject_id: int
    subject_name: str
    day_label: str
    time: str
    room: str
    student_count: int
    date: str


class TeacherDashboardOut(BaseModel):
    profile: TeacherDashboardProfileOut
    stats: TeacherDashboardStatsOut
    lessons: list[TeacherDashboardLessonOut]


@router.get("/dashboard", response_model=TeacherDashboardOut)
async def get_teacher_dashboard(
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get teacher dashboard data."""
    import datetime as _dt
    tashkent_tz = _dt.timezone(_dt.timedelta(hours=5))
    now = _dt.datetime.now(tashkent_tz).replace(tzinfo=None)
    today = now.weekday()  # 0=Mon, 6=Sun
    current_time = now.strftime("%H:%M")

    # Profile
    display_name = user.first_name or (f"@{user.username}" if user.username else "Преподаватель")
    profile = TeacherDashboardProfileOut(
        first_name=display_name,
        photo_url=user.photo_url,
    )

    # Get lessons taught by this teacher (use teacher_id instead of teacher_name)
    lessons_result = await db.execute(
        select(Lesson, Subject)
        .join(Subject, Subject.id == Lesson.subject_id)
        .where(
            and_(
                Lesson.teacher_id == user.id,
                Lesson.is_active == True,
            )
        )
        .order_by(Lesson.day_of_week, Lesson.time)
    )
    teacher_lessons = lessons_result.all()

    # Get all lesson IDs for this teacher
    lesson_ids = [lesson.id for lesson, _ in teacher_lessons]

    # Count unique students across all lessons
    if lesson_ids:
        unique_students_result = await db.execute(
            select(func.count(func.distinct(LessonEnrollment.user_id)))
            .where(LessonEnrollment.lesson_id.in_(lesson_ids))
        )
        total_students = unique_students_result.scalar() or 0
    else:
        total_students = 0

    # Build upcoming lessons list
    upcoming_lessons = []
    for lesson, subject in teacher_lessons:
        # Count enrollments for this specific lesson
        enrollments_count = await db.execute(
            select(func.count(LessonEnrollment.id))
            .where(LessonEnrollment.lesson_id == lesson.id)
        )
        student_count = enrollments_count.scalar() or 0

        # Calculate days until lesson
        lesson_day = lesson.day_of_week
        lesson_time = lesson.time
        days_until = (lesson_day - today) % 7
        if days_until == 0 and lesson_time <= current_time:
            days_until = 7

        upcoming_lessons.append({
            'lesson': lesson,
            'subject': subject,
            'student_count': student_count,
            'days_until': days_until,
            'sort_key': days_until * 10000 + int(lesson_time.split(':')[0]) * 60 + int(lesson_time.split(':')[1]),
        })

    # Sort by nearest upcoming and take first 3
    upcoming_lessons.sort(key=lambda x: x['sort_key'])
    upcoming_lessons = upcoming_lessons[:3]

    lessons_with_students = []
    for item in upcoming_lessons:
        lesson = item['lesson']
        subject = item['subject']
        student_count = item['student_count']
        days_until = item['days_until']

        if days_until == 0:
            day_label = "Сегодня"
        elif days_until == 1:
            day_label = "Завтра"
        else:
            day_label = DAY_NAMES_RU[lesson.day_of_week]

        instance_date = now.date() + _dt.timedelta(days=days_until)

        lessons_with_students.append(TeacherDashboardLessonOut(
            id=lesson.id,
            subject_id=subject.id,
            subject_name=subject.name,
            day_label=day_label,
            time=lesson.time,
            room=lesson.room,
            student_count=student_count,
            date=instance_date.strftime("%Y-%m-%d"),
        ))

    # Count total lessons (not unique days)
    lessons_this_week = len(teacher_lessons)

    stats = TeacherDashboardStatsOut(
        lessons_this_week=lessons_this_week,
        total_students=total_students,
    )

    return TeacherDashboardOut(
        profile=profile,
        stats=stats,
        lessons=lessons_with_students,
    )


class TeacherStudentOut(BaseModel):
    id: int
    telegram_id: int
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    photo_url: str | None = None
    phone: str | None = None
    grade: str | None = None


class TeacherStudentsOut(BaseModel):
    students: list[TeacherStudentOut]
    total: int


@router.get("/students", response_model=TeacherStudentsOut)
async def get_teacher_students(
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get all students enrolled in teacher's lessons."""
    # Get all lesson IDs for this teacher
    lessons_result = await db.execute(
        select(Lesson.id)
        .where(
            and_(
                Lesson.teacher_id == user.id,
                Lesson.is_active == True,
            )
        )
    )
    lesson_ids = [row[0] for row in lessons_result.fetchall()]

    if not lesson_ids:
        return TeacherStudentsOut(students=[], total=0)

    # Get unique students enrolled in these lessons
    students_result = await db.execute(
        select(User)
        .join(LessonEnrollment, LessonEnrollment.user_id == User.id)
        .where(LessonEnrollment.lesson_id.in_(lesson_ids))
        .group_by(User.id)
        .order_by(User.first_name)
    )
    students_data = students_result.scalars().all()

    students = []
    for student in students_data:
        display_name = student.first_name or (f"@{student.username}" if student.username else "Ученик")
        students.append(TeacherStudentOut(
            id=student.id,
            telegram_id=student.telegram_id,
            username=student.username,
            first_name=display_name,
            last_name=student.last_name,
            photo_url=student.photo_url,
            phone=student.phone,
            grade=student.grade,
        ))

    return TeacherStudentsOut(students=students, total=len(students))


# Student Detail schemas (teacher view)
class TeacherStudentCourseAttendance(BaseModel):
    subject_id: int
    subject_name: str
    total_lessons: int
    attended_lessons: int
    attendance_percent: float


class TeacherStudentDetailOut(BaseModel):
    id: int
    telegram_id: int
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    photo_url: str | None = None
    phone: str | None = None
    grade: str | None = None
    courses: list[TeacherStudentCourseAttendance]


@router.get("/students/{student_id}", response_model=TeacherStudentDetailOut)
async def get_teacher_student_detail(
    student_id: int,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get student details with attendance per course."""
    # Get student
    student_result = await db.execute(
        select(User).where(User.id == student_id)
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get all lesson IDs for this teacher
    lessons_result = await db.execute(
        select(Lesson.id)
        .where(
            and_(
                Lesson.teacher_id == user.id,
                Lesson.is_active == True,
            )
        )
    )
    lesson_ids = [row[0] for row in lessons_result.fetchall()]
    
    # Get courses this student is enrolled in with this teacher
    courses = []
    if lesson_ids:
        # Get unique subjects this student is enrolled in
        subjects_result = await db.execute(
            select(Subject)
            .join(Lesson, Lesson.subject_id == Subject.id)
            .join(LessonEnrollment, LessonEnrollment.lesson_id == Lesson.id)
            .where(
                and_(
                    LessonEnrollment.user_id == student_id,
                    Lesson.id.in_(lesson_ids),
                )
            )
            .group_by(Subject.id)
        )
        subjects = subjects_result.scalars().all()
        
        for subject in subjects:
            # Get all lessons for this subject taught by this teacher
            subject_lessons_result = await db.execute(
                select(Lesson.id)
                .where(
                    and_(
                        Lesson.subject_id == subject.id,
                        Lesson.teacher_id == user.id,
                        Lesson.is_active == True,
                    )
                )
            )
            subject_lesson_ids = [row[0] for row in subject_lessons_result.fetchall()]
            
            # Count attendance for this student in these lessons
            if subject_lesson_ids:
                attendance_result = await db.execute(
                    select(func.count(Attendance.id))
                    .where(
                        and_(
                            Attendance.user_id == student_id,
                            Attendance.lesson_id.in_(subject_lesson_ids),
                            Attendance.present == True,
                        )
                    )
                )
                attended = attendance_result.scalar() or 0
                
                # Total attendance records (present + absent)
                total_result = await db.execute(
                    select(func.count(Attendance.id))
                    .where(
                        and_(
                            Attendance.user_id == student_id,
                            Attendance.lesson_id.in_(subject_lesson_ids),
                        )
                    )
                )
                total = total_result.scalar() or 0
                
                attendance_percent = (attended / total * 100) if total > 0 else 0
            else:
                attended = 0
                total = 0
                attendance_percent = 0
            
            courses.append(TeacherStudentCourseAttendance(
                subject_id=subject.id,
                subject_name=subject.name,
                total_lessons=total,
                attended_lessons=attended,
                attendance_percent=round(attendance_percent, 1),
            ))
    
    display_name = student.first_name or (f"@{student.username}" if student.username else "Ученик")
    
    return TeacherStudentDetailOut(
        id=student.id,
        telegram_id=student.telegram_id,
        username=student.username,
        first_name=display_name,
        last_name=student.last_name,
        photo_url=student.photo_url,
        phone=student.phone,
        grade=student.grade,
        courses=courses,
    )



# Teacher announcements
from typing import Optional
from pydantic import BaseModel


class TeacherAnnouncementOut(BaseModel):
    id: int
    title: Optional[str] = None
    message: str
    sent_at: str
    sender_name: Optional[str] = None
    sender_role: Optional[str] = None
    recipient_count: int = 0


@router.get("/announcements", response_model=list[TeacherAnnouncementOut])
async def get_teacher_announcements(
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get announcements for teachers: from admins + own announcements."""
    result = await db.execute(
        select(Notification, User)
        .outerjoin(User, User.id == Notification.sender_id)
        .where(
            or_(
                # Admin announcements for all/teachers
                and_(
                    Notification.target_type.in_(["all", "teachers"]),
                    or_(
                        User.role == "admin",
                        Notification.sender_id.is_(None),
                    ),
                ),
                # Teacher's own announcements (any target_type)
                Notification.sender_id == user.id,
            )
        )
        .order_by(Notification.sent_at.desc())
        .limit(50)
    )
    raw = result.all()

    # Get recipient counts for own announcements
    own_ids = [n.id for n, u in raw if n.sender_id == user.id]
    counts: dict[int, int] = {}
    if own_ids:
        count_result = await db.execute(
            select(NotificationRecipient.notification_id, func.count(NotificationRecipient.id))
            .where(NotificationRecipient.notification_id.in_(own_ids))
            .group_by(NotificationRecipient.notification_id)
        )
        counts = {nid: cnt for nid, cnt in count_result.all()}

    return [
        TeacherAnnouncementOut(
            id=n.id,
            title=n.title,
            message=n.message,
            sent_at=_to_tashkent_iso(n.sent_at),
            sender_name=u.first_name if u else None,
            sender_role=u.role if u else None,
            recipient_count=counts.get(n.id, 0),
        )
        for n, u in raw
    ]


@router.get("/announcements/{announcement_id}", response_model=TeacherAnnouncementOut)
async def get_teacher_announcement_detail(
    announcement_id: int,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get announcement detail for teachers: from admins + own."""
    from fastapi import HTTPException
    result = await db.execute(
        select(Notification, User)
        .outerjoin(User, User.id == Notification.sender_id)
        .where(
            and_(
                Notification.id == announcement_id,
                or_(
                    and_(
                        Notification.target_type.in_(["all", "teachers"]),
                        or_(
                            User.role == "admin",
                            Notification.sender_id.is_(None),
                        ),
                    ),
                    Notification.sender_id == user.id,
                ),
            )
        )
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Announcement not found")

    n, u = row

    # Count recipients for own announcements
    recipient_count = 0
    if n.sender_id == user.id:
        cnt_result = await db.execute(
            select(func.count(NotificationRecipient.id))
            .where(NotificationRecipient.notification_id == n.id)
        )
        recipient_count = cnt_result.scalar() or 0

    return TeacherAnnouncementOut(
        id=n.id,
        title=n.title,
        message=n.message,
        sent_at=_to_tashkent_iso(n.sent_at),
        sender_name=u.first_name if u else None,
        sender_role=u.role if u else None,
        recipient_count=recipient_count,
    )


class AnnouncementRecipientOut(BaseModel):
    id: int
    first_name: str
    username: str | None = None


@router.get("/announcements/{announcement_id}/recipients", response_model=list[AnnouncementRecipientOut])
async def get_announcement_recipients(
    announcement_id: int,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get recipients of teacher's own announcement."""
    from fastapi import HTTPException

    # Verify this is the teacher's own announcement
    notif_result = await db.execute(
        select(Notification).where(
            and_(
                Notification.id == announcement_id,
                Notification.sender_id == user.id,
            )
        )
    )
    notification = notif_result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Announcement not found")

    # Get recipients
    result = await db.execute(
        select(User)
        .join(NotificationRecipient, NotificationRecipient.user_id == User.id)
        .where(NotificationRecipient.notification_id == announcement_id)
        .order_by(User.first_name)
    )
    users = result.scalars().all()

    return [
        AnnouncementRecipientOut(
            id=u.id,
            first_name=u.first_name or (f"@{u.username}" if u.username else "Ученик"),
            username=u.username,
        )
        for u in users
    ]


# Teacher courses list (for announcement form)
class TeacherCourseOut(BaseModel):
    id: int
    name: str
    student_count: int


@router.get("/courses", response_model=list[TeacherCourseOut])
async def get_teacher_courses(
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get courses taught by this teacher with student counts."""
    from fastapi import HTTPException

    # Get subjects where teacher has active lessons
    result = await db.execute(
        select(Subject)
        .join(Lesson, Lesson.subject_id == Subject.id)
        .where(
            and_(
                Lesson.teacher_id == user.id,
                Lesson.is_active == True,
            )
        )
        .group_by(Subject.id)
        .order_by(Subject.name)
    )
    subjects = result.scalars().all()

    courses = []
    for subject in subjects:
        # Count unique students in this subject's lessons
        count_result = await db.execute(
            select(func.count(func.distinct(LessonEnrollment.user_id)))
            .join(Lesson, Lesson.id == LessonEnrollment.lesson_id)
            .where(
                and_(
                    Lesson.subject_id == subject.id,
                    Lesson.teacher_id == user.id,
                    Lesson.is_active == True,
                )
            )
        )
        student_count = count_result.scalar() or 0
        courses.append(TeacherCourseOut(
            id=subject.id,
            name=subject.name,
            student_count=student_count,
        ))

    return courses


@router.get("/courses/{course_id}/students", response_model=list[TeacherStudentOut])
async def get_course_students(
    course_id: int,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get students enrolled in a specific course.
    Admins see all students in the course, while teachers only see students enrolled in their own lessons for that course.
    """
    from fastapi import HTTPException

    if user.role == "admin":
        # Get all active lesson IDs for this course
        lessons_result = await db.execute(
            select(Lesson.id)
            .where(
                and_(
                    Lesson.subject_id == course_id,
                    Lesson.is_active == True,
                )
            )
        )
        lesson_ids = [row[0] for row in lessons_result.fetchall()]
    else:
        # Verify teacher teaches this course
        lesson_check = await db.execute(
            select(Lesson.id)
            .where(
                and_(
                    Lesson.subject_id == course_id,
                    Lesson.teacher_id == user.id,
                    Lesson.is_active == True,
                )
            )
            .limit(1)
        )
        if not lesson_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="You don't teach this course")

        # Get lesson IDs for this course + teacher
        lessons_result = await db.execute(
            select(Lesson.id)
            .where(
                and_(
                    Lesson.subject_id == course_id,
                    Lesson.teacher_id == user.id,
                    Lesson.is_active == True,
                )
            )
        )
        lesson_ids = [row[0] for row in lessons_result.fetchall()]

    if not lesson_ids:
        return []

    # Get unique students
    students_result = await db.execute(
        select(User)
        .join(LessonEnrollment, LessonEnrollment.user_id == User.id)
        .where(LessonEnrollment.lesson_id.in_(lesson_ids))
        .group_by(User.id)
        .order_by(User.first_name)
    )
    students = students_result.scalars().all()

    return [
        TeacherStudentOut(
            id=s.id,
            telegram_id=s.telegram_id,
            username=s.username,
            first_name=s.first_name or (f"@{s.username}" if s.username else "Ученик"),
            last_name=s.last_name,
            photo_url=s.photo_url,
            phone=s.phone,
            grade=s.grade,
        )
        for s in students
    ]


# Create announcement
from schemas import NotificationCreate


@router.post("/announcements", response_model=TeacherAnnouncementOut)
async def create_announcement(
    data: NotificationCreate,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Create a new announcement. Teacher can send to their course or selected students."""
    from fastapi import HTTPException

    if data.target_type == "course":
        if not data.course_ids:
            raise HTTPException(status_code=400, detail="course_ids required for course")

        # Verify teacher teaches all selected courses
        for course_id in data.course_ids:
            lesson_check = await db.execute(
                select(Lesson.id)
                .where(
                    and_(
                        Lesson.subject_id == course_id,
                        Lesson.teacher_id == user.id,
                        Lesson.is_active == True,
                    )
                )
                .limit(1)
            )
            if not lesson_check.scalar_one_or_none():
                raise HTTPException(status_code=403, detail=f"You don't teach course {course_id}")

        # Collect all unique students from selected courses
        lesson_ids_result = await db.execute(
            select(Lesson.id)
            .where(
                and_(
                    Lesson.subject_id.in_(data.course_ids),
                    Lesson.teacher_id == user.id,
                    Lesson.is_active == True,
                )
            )
        )
        lesson_ids = [row[0] for row in lesson_ids_result.fetchall()]

        students_result = await db.execute(
            select(func.distinct(LessonEnrollment.user_id))
            .where(LessonEnrollment.lesson_id.in_(lesson_ids))
        )
        student_ids = [row[0] for row in students_result.fetchall()]

        notification = Notification(
            sender_id=user.id,
            title=data.title,
            message=data.message,
            target_type="course",
            target_id=data.course_ids[0],  # primary course for reference
        )

    elif data.target_type == "students":
        if not data.student_ids:
            raise HTTPException(status_code=400, detail="student_ids required")

        # Get all lesson IDs for this teacher
        lessons_result = await db.execute(
            select(Lesson.id)
            .where(
                and_(
                    Lesson.teacher_id == user.id,
                    Lesson.is_active == True,
                )
            )
        )
        teacher_lesson_ids = [row[0] for row in lessons_result.fetchall()]

        # Verify all students are in teacher's classes
        enrolled_result = await db.execute(
            select(func.count(func.distinct(LessonEnrollment.user_id)))
            .where(
                and_(
                    LessonEnrollment.lesson_id.in_(teacher_lesson_ids),
                    LessonEnrollment.user_id.in_(data.student_ids),
                )
            )
        )
        enrolled_count = enrolled_result.scalar() or 0
        if enrolled_count != len(data.student_ids):
            raise HTTPException(status_code=400, detail="Some students are not in your classes")

        # Store as "teacher_students" with student_ids in a JSON-like format
        # For now, create one notification with target_type="teacher_students"
        # The student_ids will be stored via a join table approach
        # Simple approach: create notification, then we'll handle filtering on read
        notification = Notification(
            sender_id=user.id,
            title=data.title,
            message=data.message,
            target_type="teacher_students",
            target_id=user.id,  # teacher_id as target
        )

    db.add(notification)
    await db.commit()
    await db.refresh(notification)

    # Store individual recipients
    recipient_ids = []
    if data.target_type == "course":
        recipient_ids = student_ids  # collected from courses above
    elif data.target_type == "students" and data.student_ids:
        recipient_ids = data.student_ids

    for student_id in recipient_ids:
        recipient = NotificationRecipient(
            notification_id=notification.id,
            user_id=student_id,
        )
        db.add(recipient)
    if recipient_ids:
        await db.commit()

    # Send Telegram messages to recipients
    if recipient_ids:
        from bot.bot import bot

        # Get telegram_ids for all recipients
        users_result = await db.execute(
            select(User.telegram_id)
            .where(User.id.in_(recipient_ids))
        )
        telegram_ids = [row[0] for row in users_result.fetchall()]

        # Format message
        sender_name = user.first_name or "Преподаватель"
        parts = [f"📢 <b>Объявление от {escape(sender_name)}</b>"]
        if data.title:
            parts.append(f"\n<b>{escape(data.title)}</b>")
        parts.append(f"\n{escape(data.message)}")
        text = "\n".join(parts)

        for tg_id in telegram_ids:
            try:
                await bot.send_message(chat_id=tg_id, text=text, parse_mode="HTML")
            except Exception as e:
                logger.warning(f"Failed to send Telegram message to {tg_id}: {e}")

    return TeacherAnnouncementOut(
        id=notification.id,
        title=notification.title,
        message=notification.message,
        sent_at=_to_tashkent_iso(notification.sent_at) if notification.sent_at else "",
        sender_name=user.first_name,
        sender_role=user.role,
    )


# --- Lesson Status & Attendance Endpoints ---

from schemas import LessonStatusIn, LessonStatusOut, AttendanceBulkIn, AttendanceRecordOut, AttendanceListOut, LessonUpdateIn, LessonDetailOut
from fastapi import HTTPException, Query
import datetime as _dt


def _get_tashkent_now():
    tashkent_tz = _dt.timezone(_dt.timedelta(hours=5))
    return _dt.datetime.now(tashkent_tz).replace(tzinfo=None)


@router.put("/lessons/{lesson_id}", response_model=LessonDetailOut)
async def update_lesson(
    lesson_id: int,
    data: LessonUpdateIn,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Update lesson title and/or plan."""
    import json as _json

    lesson_result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = lesson_result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if user.role != "admin" and lesson.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Not your lesson")

    if data.custom_title is not None:
        lesson.custom_title = data.custom_title if data.custom_title.strip() else None

    if data.lesson_plan is not None:
        # Validate JSON
        try:
            items = _json.loads(data.lesson_plan)
            if not isinstance(items, list):
                raise ValueError("Must be a list")
            lesson.lesson_plan = data.lesson_plan
        except (ValueError, _json.JSONDecodeError):
            raise HTTPException(status_code=422, detail="lesson_plan must be valid JSON array")

    await db.commit()
    await db.refresh(lesson)

    # Return full lesson detail
    from api.courses import get_lesson_detail
    return await get_lesson_detail(lesson_id, user=user, db=db)


@router.post("/lessons/{lesson_id}/status", response_model=LessonStatusOut)
async def mark_lesson_status(
    lesson_id: int,
    data: LessonStatusIn,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Mark a lesson instance as happened or cancelled."""
    # Verify lesson exists
    lesson_result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = lesson_result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Verify teacher owns this lesson (or is admin)
    if user.role != "admin" and lesson.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Not your lesson")

    # Parse date
    try:
        lesson_date = _dt.datetime.strptime(data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Upsert LessonStatus
    existing_result = await db.execute(
        select(LessonStatus).where(
            and_(LessonStatus.lesson_id == lesson_id, LessonStatus.date == lesson_date)
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        existing.status = data.status
        existing.marked_by = user.id
        existing.marked_at = _get_tashkent_now()
    else:
        ls = LessonStatus(
            lesson_id=lesson_id,
            date=lesson_date,
            status=data.status,
            marked_by=user.id,
        )
        db.add(ls)

    # If cancelled, delete attendance records for this lesson+date
    if data.status == "cancelled":
        att_result = await db.execute(
            select(Attendance).where(
                and_(Attendance.lesson_id == lesson_id, Attendance.date == lesson_date)
            )
        )
        for att in att_result.scalars().all():
            await db.delete(att)

    await db.commit()

    return LessonStatusOut(
        lesson_id=lesson_id,
        date=data.date,
        status=data.status,
        marked_by=user.id,
        marked_at=_get_tashkent_now().isoformat(),
    )


@router.post("/lessons/{lesson_id}/attendance", response_model=AttendanceListOut)
async def mark_attendance(
    lesson_id: int,
    data: AttendanceBulkIn,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Bulk mark attendance for a lesson instance."""
    # Verify lesson exists
    lesson_result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = lesson_result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Verify teacher owns this lesson (or is admin)
    if user.role != "admin" and lesson.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Not your lesson")

    # Parse date
    try:
        lesson_date = _dt.datetime.strptime(data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Verify lesson status is "happened"
    status_result = await db.execute(
        select(LessonStatus).where(
            and_(LessonStatus.lesson_id == lesson_id, LessonStatus.date == lesson_date)
        )
    )
    lesson_status = status_result.scalar_one_or_none()
    if not lesson_status or lesson_status.status != "happened":
        raise HTTPException(status_code=400, detail="Mark lesson as happened first")

    # Upsert attendance records
    for record in data.records:
        att_result = await db.execute(
            select(Attendance).where(
                and_(
                    Attendance.lesson_id == lesson_id,
                    Attendance.user_id == record.user_id,
                    Attendance.date == lesson_date,
                )
            )
        )
        att = att_result.scalar_one_or_none()
        if att:
            att.present = record.present
            att.marked_by = user.id
            att.marked_at = _get_tashkent_now()
        else:
            att = Attendance(
                lesson_id=lesson_id,
                user_id=record.user_id,
                date=lesson_date,
                present=record.present,
                marked_by=user.id,
            )
            db.add(att)

    await db.commit()

    # Return full attendance list
    return await _build_attendance_list(lesson_id, data.date, lesson_status.status, db)


@router.get("/lessons/{lesson_id}/attendance", response_model=AttendanceListOut)
async def get_lesson_attendance(
    lesson_id: int,
    date: str = Query(...),
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get attendance for a lesson instance."""
    # Verify lesson exists
    lesson_result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = lesson_result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Verify teacher owns this lesson (or is admin)
    if user.role != "admin" and lesson.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Not your lesson")

    # Get lesson status
    try:
        lesson_date = _dt.datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    status_result = await db.execute(
        select(LessonStatus).where(
            and_(LessonStatus.lesson_id == lesson_id, LessonStatus.date == lesson_date)
        )
    )
    lesson_status = status_result.scalar_one_or_none()
    status_str = lesson_status.status if lesson_status else None

    return await _build_attendance_list(lesson_id, date, status_str, db)


async def _build_attendance_list(lesson_id: int, date: str, status: str | None, db: AsyncSession) -> AttendanceListOut:
    """Build attendance list with all enrolled students."""
    lesson_date = _dt.datetime.strptime(date, "%Y-%m-%d").date()

    # Get all enrolled students
    enrollments_result = await db.execute(
        select(User)
        .join(LessonEnrollment, LessonEnrollment.user_id == User.id)
        .where(LessonEnrollment.lesson_id == lesson_id)
        .order_by(User.first_name)
    )
    students = enrollments_result.scalars().all()

    # Get existing attendance records
    att_result = await db.execute(
        select(Attendance).where(
            and_(Attendance.lesson_id == lesson_id, Attendance.date == lesson_date)
        )
    )
    att_map = {att.user_id: att for att in att_result.scalars().all()}

    records = []
    for student in students:
        att = att_map.get(student.id)
        records.append(AttendanceRecordOut(
            user_id=student.id,
            first_name=student.first_name or (f"@{student.username}" if student.username else "Ученик"),
            username=student.username,
            present=att.present if att else False,
        ))

    return AttendanceListOut(
        lesson_id=lesson_id,
        date=date,
        status=status,
        saved=len(att_map) > 0,
        records=records,
    )


# --- Teacher Availability Endpoints ---

from schemas import TeacherAvailabilityIn, TeacherAvailabilityOut
from models import TeacherAvailability


@router.get("/availability", response_model=list[TeacherAvailabilityOut])
async def get_availability(
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get all availability slots for the current teacher."""
    result = await db.execute(
        select(TeacherAvailability)
        .where(
            and_(
                TeacherAvailability.teacher_id == user.id,
                TeacherAvailability.is_active == True,
            )
        )
        .order_by(TeacherAvailability.day_of_week, TeacherAvailability.start_time)
    )
    slots = result.scalars().all()
    return [
        TeacherAvailabilityOut(
            id=s.id,
            day_of_week=s.day_of_week,
            start_time=s.start_time,
            end_time=s.end_time,
            is_active=s.is_active,
        )
        for s in slots
    ]


@router.post("/availability", response_model=TeacherAvailabilityOut)
async def create_availability(
    data: TeacherAvailabilityIn,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Create a new availability slot."""
    # Validate time range
    if data.start_time >= data.end_time:
        raise HTTPException(status_code=400, detail="start_time must be before end_time")

    # Check for overlapping slots
    existing_result = await db.execute(
        select(TeacherAvailability).where(
            and_(
                TeacherAvailability.teacher_id == user.id,
                TeacherAvailability.day_of_week == data.day_of_week,
                TeacherAvailability.is_active == True,
                TeacherAvailability.start_time < data.end_time,
                TeacherAvailability.end_time > data.start_time,
            )
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Slot overlaps with existing availability")

    slot = TeacherAvailability(
        teacher_id=user.id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
    )
    db.add(slot)
    await db.commit()
    await db.refresh(slot)

    return TeacherAvailabilityOut(
        id=slot.id,
        day_of_week=slot.day_of_week,
        start_time=slot.start_time,
        end_time=slot.end_time,
        is_active=slot.is_active,
    )


@router.delete("/availability/{slot_id}")
async def delete_availability(
    slot_id: int,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Delete an availability slot."""
    result = await db.execute(
        select(TeacherAvailability).where(
            and_(
                TeacherAvailability.id == slot_id,
                TeacherAvailability.teacher_id == user.id,
            )
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    await db.delete(slot)
    await db.commit()

    return {"ok": True}
