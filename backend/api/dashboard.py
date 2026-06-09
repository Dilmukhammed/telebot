from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import User, Lesson, LessonEnrollment, Registration, Result, Subject, Test, Notification, NotificationRecipient, Attendance, LessonStatus, TeacherAvailability
from schemas import DashboardOut, DashboardProfileOut, DashboardLessonOut, DashboardResultOut, DashboardNotificationOut
from api.deps import get_telegram_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DAY_NAMES_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
DAY_NAMES_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

TASHKENT_OFFSET = timedelta(hours=5)


def _to_tashkent_iso(utc_dt: datetime) -> str:
    """Convert naive UTC datetime to Tashkent time ISO string with timezone."""
    return (utc_dt + TASHKENT_OFFSET).isoformat() + "+05:00"


def _get_day_label(lesson_day: int, today: int) -> str:
    if lesson_day == today:
        return "Сегодня"
    if lesson_day == (today + 1) % 7:
        return "Завтра"
    return DAY_NAMES_RU[lesson_day]


@router.get("", response_model=DashboardOut)
async def get_dashboard(
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    import datetime as _dt
    tashkent_tz = _dt.timezone(_dt.timedelta(hours=5))
    now = _dt.datetime.now(tashkent_tz).replace(tzinfo=None)
    today = now.weekday()  # 0=Mon, 6=Sun
    current_time = now.strftime("%H:%M")

    # Profile
    display_name = user.first_name or (f"@{user.username}" if user.username else "Ученик")
    profile = DashboardProfileOut(
        first_name=display_name,
        grade=user.grade,
        photo_url=user.photo_url,
    )

    # Lessons: get user's enrolled lessons
    enrollments_result = await db.execute(
        select(Lesson, Subject)
        .join(LessonEnrollment, LessonEnrollment.lesson_id == Lesson.id)
        .join(Subject, Subject.id == Lesson.subject_id)
        .where(
            and_(
                LessonEnrollment.user_id == user.id,
                Lesson.is_active == True,
                Subject.is_archived == False,
            )
        )
        .order_by(Lesson.day_of_week, Lesson.time)
    )
    enrolled_lessons = enrollments_result.all()

    student_stats = {
        "lessons_this_week": len(enrolled_lessons),
        "total_courses": len(set(subj.id for les, subj in enrolled_lessons)),
    }

    # Filter and sort upcoming lessons
    upcoming_lessons = []
    for lesson, subject in enrolled_lessons:
        lesson_day = lesson.day_of_week
        lesson_time = lesson.time
        
        # Calculate days until lesson
        days_until = (lesson_day - today) % 7
        if days_until == 0 and lesson_time <= current_time:
            # Lesson already passed today, show it next week
            days_until = 7
        
        upcoming_lessons.append({
            'lesson': lesson,
            'subject': subject,
            'days_until': days_until,
            'sort_key': days_until * 10000 + int(lesson_time.split(':')[0]) * 60 + int(lesson_time.split(':')[1]),
        })
    
    # Sort by nearest upcoming
    upcoming_lessons.sort(key=lambda x: x['sort_key'])
    
    # Take only first 3
    upcoming_lessons = upcoming_lessons[:3]

    lessons = []
    for item in upcoming_lessons:
        lesson = item['lesson']
        subject = item['subject']
        days_until = item['days_until']
        
        # Calculate day label
        if days_until == 0:
            day_label = "Сегодня"
        elif days_until == 1:
            day_label = "Завтра"
        else:
            lesson_day = lesson.day_of_week
            day_label = DAY_NAMES_RU[lesson_day]
        
        instance_date = now.date() + timedelta(days=days_until)
        
        lessons.append(DashboardLessonOut(
            id=lesson.id,
            subject_id=subject.id,
            subject_name=subject.name,
            teacher_name=lesson.teacher_name,
            day_label=day_label,
            time=lesson.time,
            room=lesson.room,
            date=instance_date.strftime("%Y-%m-%d"),
        ))

    # Results: get user's recent results with subject names
    # Join path: Result -> Registration -> Test -> Subject
    results_query = (
        select(Result, Subject)
        .join(Registration, Registration.id == Result.registration_id)
        .join(Test, Test.id == Registration.test_id)
        .join(Subject, Subject.id == Test.subject_id)
        .where(Registration.telegram_id == user.telegram_id)
        .order_by(Result.created_at.desc())
        .limit(5)
    )
    results_result = await db.execute(results_query)
    raw_results = results_result.all()

    dashboard_results = []
    for result, subject in raw_results:
        icon = "emoji_events" if result.score >= 80 else "assignment"
        dashboard_results.append(DashboardResultOut(
            id=result.id,
            subject_name=subject.name,
            score=result.score,
            max_score=result.max_score,
            icon=icon,
        ))

    # Notifications: all, students (only for students), or course-type where user is a recipient
    visible_types = ["all"]
    if user.role == "student":
        visible_types.append("students")
    course_recipient_subq = (
        select(NotificationRecipient.notification_id)
        .where(NotificationRecipient.user_id == user.id)
    )
    notifications_query = (
        select(Notification, User)
        .outerjoin(User, User.id == Notification.sender_id)
        .where(
            or_(
                Notification.target_type.in_(visible_types),
                Notification.id.in_(course_recipient_subq),
            )
        )
        .order_by(Notification.sent_at.desc())
        .limit(3)
    )
    notifications_res = await db.execute(notifications_query)
    raw_notifications = notifications_res.all()

    dashboard_notifications = [
        DashboardNotificationOut(
            id=n.id,
            title=n.title,
            message=n.message,
            sent_at=_to_tashkent_iso(n.sent_at),
            sender_name=u.first_name if u else None,
            sender_role=u.role if u else None,
            sender_id=n.sender_id,
        )
        for n, u in raw_notifications
    ]

    return DashboardOut(
        profile=profile,
        lessons=lessons,
        results=dashboard_results,
        stats=student_stats,
        notifications=dashboard_notifications,
    )


# Announcement schemas
class AnnouncementOut(BaseModel):
    id: int
    title: Optional[str] = None
    message: str
    sent_at: str
    sender_name: Optional[str] = None
    sender_role: Optional[str] = None
    sender_id: Optional[int] = None


class AnnouncementDetailOut(BaseModel):
    id: int
    title: Optional[str] = None
    message: str
    sent_at: str
    sender_name: Optional[str] = None
    sender_role: Optional[str] = None


@router.get("/announcements", response_model=list[AnnouncementOut])
async def get_announcements(
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all announcements for the user."""
    visible_types = ["all"]
    if user.role == "student":
        visible_types.append("students")
    course_recipient_subq = (
        select(NotificationRecipient.notification_id)
        .where(NotificationRecipient.user_id == user.id)
    )
    result = await db.execute(
        select(Notification, User)
        .outerjoin(User, User.id == Notification.sender_id)
        .where(
            or_(
                Notification.target_type.in_(visible_types),
                Notification.id.in_(course_recipient_subq),
            )
        )
        .order_by(Notification.sent_at.desc())
        .limit(50)
    )
    raw = result.all()

    return [
        AnnouncementOut(
            id=n.id,
            title=n.title,
            message=n.message,
            sent_at=_to_tashkent_iso(n.sent_at),
            sender_name=u.first_name if u else None,
            sender_role=u.role if u else None,
            sender_id=n.sender_id,
        )
        for n, u in raw
    ]


@router.get("/announcements/{announcement_id}", response_model=AnnouncementDetailOut)
async def get_announcement_detail(
    announcement_id: int,
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """Get announcement detail."""
    visible_types = ["all"]
    if user.role == "student":
        visible_types.append("students")
    course_recipient_subq = (
        select(NotificationRecipient.notification_id)
        .where(NotificationRecipient.user_id == user.id)
    )
    result = await db.execute(
        select(Notification, User)
        .outerjoin(User, User.id == Notification.sender_id)
        .where(
            Notification.id == announcement_id,
            or_(
                Notification.target_type.in_(visible_types),
                Notification.id.in_(course_recipient_subq),
            ),
        )
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Announcement not found")

    notification, sender = row
    return AnnouncementDetailOut(
        id=notification.id,
        title=notification.title,
        message=notification.message,
        sent_at=_to_tashkent_iso(notification.sent_at),
        sender_name=sender.first_name if sender else None,
        sender_role=sender.role if sender else None,
    )


# Calendar schemas (inline for simplicity)
from pydantic import BaseModel


class CalendarLessonOut(BaseModel):
    id: int
    subject_name: str
    teacher_name: str
    day_of_week: int  # 0=Mon, 6=Sun
    time: str  # "16:00"
    end_time: str  # "17:30"
    room: str
    status: str = "planned"  # "planned", "completed", "today"


class CalendarDayOut(BaseModel):
    date: str  # "2024-10-23"
    day_of_week: int  # 0=Mon
    day_name: str  # "Пн"
    lessons: list[CalendarLessonOut]
    available_slots: list[dict] = []  # [{start_time, end_time}]


class CalendarWeekOut(BaseModel):
    days: list[CalendarDayOut]


def _calculate_end_time(start_time: str, duration_minutes: int | None = 90) -> str:
    """Calculate end time from start time and duration."""
    try:
        dur = duration_minutes or 90
        h, m = map(int, start_time.split(":"))
        total_minutes = h * 60 + m + dur
        end_h = total_minutes // 60
        end_m = total_minutes % 60
        return f"{end_h:02d}:{end_m:02d}"
    except Exception:
        return ""


@router.get("/calendar", response_model=CalendarWeekOut)
async def get_calendar(
    week_offset: int = Query(0, description="Week offset from current week"),
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """Get calendar data for a specific week."""
    import datetime as _dt
    tashkent_tz = _dt.timezone(_dt.timedelta(hours=5))
    today = _dt.datetime.now(tashkent_tz).date()
    # Get Monday of current week
    current_monday = today - timedelta(days=today.weekday())
    # Apply offset
    target_monday = current_monday + timedelta(weeks=week_offset)

    # Get lessons: only teacher's own if teacher, or enrolled if student
    if user.role == "teacher":
        lessons_result = await db.execute(
            select(Lesson, Subject)
            .join(Subject, Subject.id == Lesson.subject_id)
            .where(
                and_(
                    Lesson.is_active == True,
                    Lesson.teacher_id == user.id,
                    Subject.is_archived == False,
                )
            )
            .order_by(Lesson.day_of_week, Lesson.time)
        )
    elif user.role == "admin":
        lessons_result = await db.execute(
            select(Lesson, Subject)
            .join(Subject, Subject.id == Lesson.subject_id)
            .where(Lesson.is_active == True)
            .order_by(Lesson.day_of_week, Lesson.time)
        )
    else:
        # Student: only enrolled lessons
        lessons_result = await db.execute(
            select(Lesson, Subject)
            .join(Subject, Subject.id == Lesson.subject_id)
            .join(LessonEnrollment, LessonEnrollment.lesson_id == Lesson.id)
            .where(
                and_(
                    Lesson.is_active == True,
                    LessonEnrollment.user_id == user.id,
                    Subject.is_archived == False,
                )
            )
            .order_by(Lesson.day_of_week, Lesson.time)
        )
    all_lessons = lessons_result.all()

    # Build 7 days with dates
    week_dates = [target_monday + timedelta(days=i) for i in range(7)]
    date_strings = [d.isoformat() for d in week_dates]

    # Batch-query attendance for all lessons in this week
    lesson_ids = [lesson.id for lesson, _ in all_lessons]
    attended_set: set[tuple[int, str]] = set()
    lesson_statuses: dict[tuple[int, str], str] = {}
    if lesson_ids:
        # Use date objects for PostgreSQL DATE columns
        attendance_result = await db.execute(
            select(Attendance.lesson_id, Attendance.date)
            .where(
                and_(
                    Attendance.lesson_id.in_(lesson_ids),
                    Attendance.date.in_(week_dates),
                )
            )
            .distinct()
        )
        for row in attendance_result.all():
            attended_set.add((row[0], row[1].isoformat() if hasattr(row[1], 'isoformat') else str(row[1])))

        # Batch-query lesson statuses
        status_result = await db.execute(
            select(LessonStatus.lesson_id, LessonStatus.date, LessonStatus.status)
            .where(
                and_(
                    LessonStatus.lesson_id.in_(lesson_ids),
                    LessonStatus.date.in_(week_dates),
                )
            )
        )
        for row in status_result.all():
            lesson_statuses[(row[0], row[1].isoformat() if hasattr(row[1], 'isoformat') else str(row[1]))] = row[2]

    # Group lessons by day_of_week, filtering by start_date and marking status
    lessons_by_day: dict[int, list] = {}
    for lesson, subject in all_lessons:
        day = lesson.day_of_week
        start = subject.start_date.date() if subject.start_date else None
        for i, date in enumerate(week_dates):
            if i != day:
                continue
            # Skip if before course start_date
            if start and date < start:
                continue
            if day not in lessons_by_day:
                lessons_by_day[day] = []

            # Determine status using LessonStatus
            date_str = date.isoformat()
            if date == today:
                status = "today"
            else:
                ls = lesson_statuses.get((lesson.id, date_str))
                if ls == "happened":
                    if user.role in ("teacher", "admin"):
                        status = "completed"
                    else:
                        # Student: completed only if marked present
                        status = "completed" if (lesson.id, date_str) in attended_set else "absent"
                elif ls == "cancelled":
                    status = "cancelled"
                elif date < today:
                    status = "unmarked"
                else:
                    status = "planned"

            duration = subject.duration_minutes or 90
            lessons_by_day[day].append(CalendarLessonOut(
                id=lesson.id,
                subject_name=subject.name,
                teacher_name=lesson.teacher_name,
                day_of_week=day,
                time=lesson.time,
                end_time=_calculate_end_time(lesson.time, duration),
                room=lesson.room,
                status=status,
            ))

    # Build 7 days
    days = []
    for i in range(7):
        date = week_dates[i]
        days.append(CalendarDayOut(
            date=date.isoformat(),
            day_of_week=i,
            day_name=DAY_NAMES_SHORT[i],
            lessons=lessons_by_day.get(i, []),
        ))

    # Add availability slots for teacher/admin
    if user.role in ("teacher", "admin"):
        avail_result = await db.execute(
            select(TeacherAvailability).where(
                and_(
                    TeacherAvailability.teacher_id == user.id,
                    TeacherAvailability.is_active == True,
                )
            )
        )
        avail_slots = avail_result.scalars().all()
        avail_by_day: dict[int, list[dict]] = {}
        for slot in avail_slots:
            avail_by_day.setdefault(slot.day_of_week, []).append(
                {"id": slot.id, "start_time": slot.start_time, "end_time": slot.end_time}
            )
        for day in days:
            day.available_slots = avail_by_day.get(day.day_of_week, [])

    return CalendarWeekOut(days=days)