from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional
import logging

from database import get_db
from models import User, Lesson, LessonEnrollment, Registration, Result, Subject, Test, Notification, NotificationRecipient, NotificationRead, NotificationAttachment, Attendance, LessonStatus, TeacherAvailability
from schemas import DashboardOut, DashboardProfileOut, DashboardLessonOut, DashboardResultOut, DashboardNotificationOut
from api.deps import get_telegram_user
from utils.time import _get_tashkent_now, _to_tashkent_iso, _calculate_end_time
from utils.constants import DAY_NAMES_RU, DAY_NAMES_SHORT_RU

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


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
    now = _get_tashkent_now()
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

    # Get read status for dashboard notifications
    notif_ids = [n.id for n, _ in raw_notifications]
    read_set: set[int] = set()
    if notif_ids:
        read_res = await db.execute(
            select(NotificationRead.notification_id)
            .where(NotificationRead.user_id == user.id, NotificationRead.notification_id.in_(notif_ids))
        )
        read_set = {row[0] for row in read_res.all()}

    dashboard_notifications = [
        DashboardNotificationOut(
            id=n.id,
            title=n.title,
            message=n.message,
            sent_at=_to_tashkent_iso(n.sent_at),
            sender_name=u.first_name if u else None,
            sender_role=u.role if u else None,
            sender_id=n.sender_id,
            is_read=n.id in read_set,
        )
        for n, u in raw_notifications
    ]

    # Count ALL unread announcements (not just top 3) for the badge
    # Single count query with outerjoin instead of fetching all IDs then checking reads
    unread_count_result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .outerjoin(
            NotificationRead,
            and_(
                NotificationRead.notification_id == Notification.id,
                NotificationRead.user_id == user.id,
            ),
        )
        .where(
            or_(
                Notification.target_type.in_(visible_types),
                Notification.id.in_(course_recipient_subq),
            ),
            Notification.sender_id != user.id,
            NotificationRead.id.is_(None),
        )
    )
    unread_count = unread_count_result.scalar() or 0

    return DashboardOut(
        profile=profile,
        lessons=lessons,
        results=dashboard_results,
        stats=student_stats,
        notifications=dashboard_notifications,
        unread_count=unread_count,
    )


# Announcement schemas
class AnnouncementAttachmentOut(BaseModel):
    id: int
    title: str
    type: str  # "file" or "link"
    url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None


class AnnouncementOut(BaseModel):
    id: int
    title: Optional[str] = None
    message: str
    sent_at: str
    sender_name: Optional[str] = None
    sender_role: Optional[str] = None
    sender_id: Optional[int] = None
    is_read: bool = False
    attachments: list[AnnouncementAttachmentOut] = []


class AnnouncementDetailOut(BaseModel):
    id: int
    title: Optional[str] = None
    message: str
    sent_at: str
    sender_name: Optional[str] = None
    sender_role: Optional[str] = None
    sender_id: Optional[int] = None
    is_read: bool = False
    attachments: list[AnnouncementAttachmentOut] = []


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

    # Get read status for all announcements
    notification_ids = [n.id for n, _ in raw]
    read_set: set[int] = set()
    if notification_ids:
        read_result = await db.execute(
            select(NotificationRead.notification_id)
            .where(
                NotificationRead.user_id == user.id,
                NotificationRead.notification_id.in_(notification_ids),
            )
        )
        read_set = {row[0] for row in read_result.all()}

    # Load attachments for all announcements
    attachments_by_notif: dict[int, list] = {}
    if notification_ids:
        att_result = await db.execute(
            select(NotificationAttachment)
            .where(NotificationAttachment.notification_id.in_(notification_ids))
        )
        for att in att_result.scalars().all():
            attachments_by_notif.setdefault(att.notification_id, []).append(att)

    return [
        AnnouncementOut(
            id=n.id,
            title=n.title,
            message=n.message,
            sent_at=_to_tashkent_iso(n.sent_at),
            sender_name=u.first_name if u else None,
            sender_role=u.role if u else None,
            sender_id=n.sender_id,
            is_read=n.id in read_set,
            attachments=[
                AnnouncementAttachmentOut(
                    id=a.id, title=a.title, type=a.type, url=a.url,
                    file_name=a.file_name, file_size=a.file_size,
                )
                for a in attachments_by_notif.get(n.id, [])
            ],
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

    # Check read status for current user
    read_result = await db.execute(
        select(NotificationRead.id)
        .where(
            NotificationRead.notification_id == notification.id,
            NotificationRead.user_id == user.id,
        )
        .limit(1)
    )
    is_read = read_result.scalar_one_or_none() is not None

    # Load attachments
    att_result = await db.execute(
        select(NotificationAttachment)
        .where(NotificationAttachment.notification_id == notification.id)
    )
    attachments = [
        AnnouncementAttachmentOut(
            id=a.id, title=a.title, type=a.type, url=a.url,
            file_name=a.file_name, file_size=a.file_size,
        )
        for a in att_result.scalars().all()
    ]

    return AnnouncementDetailOut(
        id=notification.id,
        title=notification.title,
        message=notification.message,
        sent_at=_to_tashkent_iso(notification.sent_at),
        sender_name=sender.first_name if sender else None,
        sender_role=sender.role if sender else None,
        sender_id=notification.sender_id,
        is_read=is_read,
        attachments=attachments,
    )


@router.post("/announcements/{announcement_id}/read")
async def mark_announcement_read(
    announcement_id: int,
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark an announcement as read for the current user."""
    # Check announcement exists
    notif = await db.execute(select(Notification).where(Notification.id == announcement_id))
    if not notif.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Announcement not found")

    # Upsert: skip if already read
    existing = await db.execute(
        select(NotificationRead).where(
            NotificationRead.notification_id == announcement_id,
            NotificationRead.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none():
        return {"ok": True, "already_read": True}

    read_entry = NotificationRead(notification_id=announcement_id, user_id=user.id)
    db.add(read_entry)
    await db.commit()
    return {"ok": True}


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


@router.get("/calendar", response_model=CalendarWeekOut)
async def get_calendar(
    week_offset: int = Query(0, description="Week offset from current week"),
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """Get calendar data for a specific week."""
    today = _get_tashkent_now().date()
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

    # Pre-fetch teacher names from users table (current name, not denormalized lesson.teacher_name)
    teacher_ids = {l.teacher_id for l, _ in all_lessons if l.teacher_id}
    teachers_map: dict[int, str] = {}
    if teacher_ids:
        teachers_result = await db.execute(select(User.id, User.first_name, User.last_name, User.username).where(User.id.in_(teacher_ids)))
        for row in teachers_result.all():
            full_name = f"{row[1] or ''} {row[2] or ''}".strip() if row[1] or row[2] else (row[3] or "")
            teachers_map[row[0]] = full_name

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

            # Determine status: check stored status FIRST, then fall back to date-based logic
            date_str = date.isoformat()
            ls = lesson_statuses.get((lesson.id, date_str))
            if ls == "happened":
                if user.role in ("teacher", "admin"):
                    status = "completed"
                else:
                    # Student: completed only if marked present
                    status = "completed" if (lesson.id, date_str) in attended_set else "absent"
            elif ls == "cancelled":
                status = "cancelled"
            elif date == today:
                status = "today"
            elif date < today:
                status = "unmarked"
            else:
                status = "planned"

            duration = subject.duration_minutes or 90
            t_name = teachers_map.get(lesson.teacher_id, lesson.teacher_name) if lesson.teacher_id else lesson.teacher_name
            lessons_by_day[day].append(CalendarLessonOut(
                id=lesson.id,
                subject_name=subject.name,
                teacher_name=t_name,
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
            day_name=DAY_NAMES_SHORT_RU[i],
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


# ── Announcement Attachment Endpoints ──────────────────────────────

@router.post("/announcements/attachments/upload")
async def upload_announcement_attachment(
    file: UploadFile = File(...),
    title: str = Form(...),
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file for an announcement attachment. Returns attachment ID.

    The attachment is NOT linked to any notification yet — the caller should
    pass the returned ID in `attachment_ids` when creating the announcement.
    """
    if user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Only teachers and admins can upload attachments")

    import google_drive

    # Read file with size limit (50 MB)
    MAX_FILE_SIZE = 50 * 1024 * 1024
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is 50 MB")

    file_name = file.filename or "upload"

    # Upload to Google Drive
    try:
        google_file_id, download_url = await google_drive.upload_file(
            file_bytes=file_bytes,
            file_name=file_name,
            mime_type=file.content_type or "application/octet-stream",
        )
    except Exception as exc:
        logging.getLogger(__name__).error("Google Drive upload failed: %s", exc)
        raise HTTPException(status_code=500, detail="File upload failed")

    # Create attachment record (notification_id will be set later when announcement is created)
    # Use a temporary notification_id of 0 — we'll update it during announcement creation
    attachment = NotificationAttachment(
        notification_id=0,  # Placeholder — updated during announcement creation
        title=title,
        type="file",
        url=download_url,
        file_name=file_name,
        file_size=len(file_bytes),
        google_file_id=google_file_id,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    return {"id": attachment.id, "title": title, "type": "file", "url": download_url, "file_name": file_name, "file_size": len(file_bytes)}


class LinkAttachmentIn(BaseModel):
    title: str
    url: str


@router.post("/announcements/attachments/link")
async def create_link_attachment(
    data: LinkAttachmentIn,
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a link attachment for an announcement. Returns attachment ID."""
    if user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Only teachers and admins can create attachments")

    attachment = NotificationAttachment(
        notification_id=0,  # Placeholder — updated during announcement creation
        title=data.title,
        type="link",
        url=data.url,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    return {"id": attachment.id, "title": data.title, "type": "link", "url": data.url}


@router.delete("/announcements/attachments/{attachment_id}")
async def delete_announcement_attachment(
    attachment_id: int,
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an announcement attachment."""
    attachment = await db.get(NotificationAttachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Only allow deletion if notification_id is 0 (not yet linked) or user is the sender
    if attachment.notification_id != 0:
        notif = await db.get(Notification, attachment.notification_id)
        if notif and notif.sender_id != user.id and user.role != "admin":
            raise HTTPException(status_code=403, detail="Not allowed")

    # Delete from Google Drive if applicable
    if attachment.google_file_id:
        import google_drive
        await google_drive.delete_file(attachment.google_file_id)

    await db.delete(attachment)
    await db.commit()

    return {"ok": True}