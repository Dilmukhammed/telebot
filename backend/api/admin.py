import json as _json
import logging
from html import escape
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from datetime import datetime, timedelta, date as dt_date

logger = logging.getLogger(__name__)

from database import get_db
from models import (
    User, Lesson, LessonEnrollment, Subject, LessonStatus,
    Notification, NotificationRecipient, TeacherAvailability, Test,
    Attendance, AuditLog,
)
from api.users import user_to_dict
from schemas import (
    AdminStatsOut, DashboardLessonOut, AdminLessonOut,
    RescheduleIn, AdminAnnouncementCreate, AdminAnnouncementOut,
    SearchResultOut, SearchCourseResult, SearchAvailabilityResult,
    AdminSubjectOut, AdminSubjectDetailOut, LessonStatusMarkIn, UserOut,
    LessonUpdateIn, LessonDetailOut, LessonStatusOut,
    AttendanceBulkIn, AttendanceListOut, AttendanceRecordOut,
    AdminLessonCreate, EnrollStudentIn, AuditLogOut, CancelLessonIn,
    AdminSubjectCreate, ScheduleTimeSlot,
)
from api.deps import require_admin

router = APIRouter(prefix="/admin", tags=["admin-panel"])

DAY_NAMES_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
DAY_NAMES_SHORT_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


def _get_tashkent_now():
    import datetime as _dt
    tashkent_tz = _dt.timezone(_dt.timedelta(hours=5))
    return _dt.datetime.now(tashkent_tz).replace(tzinfo=None)


async def _log_audit(db: AsyncSession, entity_type: str, entity_id: int, action: str,
                     field_name: str = None, old_value=None, new_value=None,
                     performed_by: int = None, performed_by_type: str = "admin"):
    """Log an audit trail entry."""
    entry = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        field_name=field_name,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        performed_by=performed_by,
        performed_by_type=performed_by_type,
    )
    db.add(entry)


def _calculate_end_time(start_time: str, duration_minutes: int = 90) -> str:
    try:
        h, m = map(int, start_time.split(":"))
        total = h * 60 + m + duration_minutes
        return f"{total // 60:02d}:{total % 60:02d}"
    except Exception:
        return ""


# ── Stats ─────────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStatsOut)
async def get_stats(
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = _get_tashkent_now()
    today = now.date()
    today_weekday = today.weekday()

    # Counts
    student_count = (await db.execute(
        select(func.count()).select_from(User).where(User.role == "student")
    )).scalar() or 0

    teacher_count = (await db.execute(
        select(func.count()).select_from(User).where(User.role == "teacher")
    )).scalar() or 0

    course_count = (await db.execute(
        select(func.count(func.distinct(Lesson.subject_id)))
        .where(Lesson.is_active == True)
    )).scalar() or 0

    active_tests = (await db.execute(
        select(func.count()).select_from(Test).where(Test.is_active == True)
    )).scalar() or 0

    # Today's lessons with status in a single query
    lessons_result = await db.execute(
        select(Lesson, Subject, LessonStatus)
        .join(Subject, Lesson.subject_id == Subject.id)
        .outerjoin(LessonStatus, and_(
            LessonStatus.lesson_id == Lesson.id,
            LessonStatus.date == today
        ))
        .where(and_(Lesson.is_active == True, Lesson.day_of_week == today_weekday))
        .order_by(Lesson.time)
    )
    lessons = lessons_result.all()

    today_lessons = []
    for lesson, subject, ls in lessons:
        today_lessons.append(DashboardLessonOut(
            id=lesson.id,
            subject_id=subject.id,
            subject_name=subject.name,
            teacher_name=lesson.teacher_name,
            day_label="Сегодня",
            time=lesson.time,
            room=lesson.room,
            date=today.strftime("%Y-%m-%d"),
        ))

    return AdminStatsOut(
        student_count=student_count,
        teacher_count=teacher_count,
        course_count=course_count,
        active_tests=active_tests,
        today_lessons=today_lessons,
    )


# ── Lessons (Schedule View) ───────────────────────────────────────────

@router.get("/lessons", response_model=list[AdminLessonOut])
async def get_admin_lessons(
    week_offset: int = Query(0, ge=-52, le=52),
    teacher_id: int | None = None,
    subject_id: int | None = None,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = _get_tashkent_now()
    today = now.date()
    # Calculate target week Monday
    start_monday = today - timedelta(days=today.weekday()) + timedelta(weeks=week_offset)

    # Query lessons with filters
    query = (
        select(Lesson, Subject)
        .join(Subject, Lesson.subject_id == Subject.id)
        .where(Lesson.is_active == True)
    )
    if teacher_id:
        query = query.where(Lesson.teacher_id == teacher_id)
    if subject_id:
        query = query.where(Lesson.subject_id == subject_id)
    query = query.order_by(Lesson.day_of_week, Lesson.time)

    # Subquery for enrollment count
    enrollment_count_sq = (
        select(func.count())
        .select_from(LessonEnrollment)
        .where(LessonEnrollment.lesson_id == Lesson.id)
        .correlate(Lesson)
        .scalar_subquery()
    )

    # Join with LessonStatus and enrollment count in single query
    query = query.add_columns(LessonStatus, enrollment_count_sq.label("student_count"))
    query = query.outerjoin(LessonStatus, and_(
        LessonStatus.lesson_id == Lesson.id,
        LessonStatus.date == start_monday + timedelta(days=Lesson.day_of_week)
    ))

    result = await db.execute(query)
    rows = result.all()

    out = []
    for lesson, subject, ls, student_count in rows:
        instance_date = start_monday + timedelta(days=lesson.day_of_week)
        status = ls.status if ls else None
        end_time = _calculate_end_time(lesson.time, subject.duration_minutes or 90)

        out.append(AdminLessonOut(
            id=lesson.id,
            subject_id=subject.id,
            subject_name=subject.name,
            teacher_name=lesson.teacher_name,
            teacher_id=lesson.teacher_id,
            day_of_week=lesson.day_of_week,
            day_name=DAY_NAMES_SHORT_RU[lesson.day_of_week],
            time=lesson.time,
            end_time=end_time,
            room=lesson.room,
            student_count=student_count or 0,
            lesson_status=status,
            date=instance_date.strftime("%Y-%m-%d"),
        ))

    out.sort(key=lambda x: (x.date, x.time))
    return out


# ── Smart Search ──────────────────────────────────────────────────────

@router.get("/search", response_model=SearchResultOut)
async def search_courses(
    days: list[int] = Query(..., ge=0, le=6),
    time_from: str = Query(..., pattern=r"^\d{2}:\d{2}$"),
    time_to: str = Query(..., pattern=r"^\d{2}:\d{2}$"),
    teacher_id: int | None = None,
    subject_id: int | None = None,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Search courses matching day/time
    query = (
        select(Lesson, Subject)
        .join(Subject, Lesson.subject_id == Subject.id)
        .where(
            and_(
                Lesson.is_active == True,
                Lesson.day_of_week.in_(days),
                Lesson.time >= time_from,
                Lesson.time <= time_to,
            )
        )
    )
    if teacher_id:
        query = query.where(Lesson.teacher_id == teacher_id)
    if subject_id:
        query = query.where(Lesson.subject_id == subject_id)

    result = await db.execute(query)
    lessons = result.all()

    courses = []
    seen_subjects = set()
    for lesson, subject in lessons:
        if subject.id in seen_subjects:
            continue
        seen_subjects.add(subject.id)

        # Count enrollments
        count_result = await db.execute(
            select(func.count()).select_from(LessonEnrollment)
            .where(LessonEnrollment.lesson_id == lesson.id)
        )
        student_count = count_result.scalar() or 0

        end_time = _calculate_end_time(lesson.time, subject.duration_minutes or 90)

        courses.append(SearchCourseResult(
            id=subject.id,
            name=subject.name,
            teacher_name=lesson.teacher_name,
            day_of_week=lesson.day_of_week,
            day_name=DAY_NAMES_SHORT_RU[lesson.day_of_week],
            time=lesson.time,
            end_time=end_time,
            room=lesson.room,
            student_count=student_count,
            has_open_slots=student_count < lesson.max_capacity,
        ))

    # Search teacher availability slots
    avail_query = (
        select(TeacherAvailability, User)
        .join(User, TeacherAvailability.teacher_id == User.id)
        .where(
            and_(
                TeacherAvailability.is_active == True,
                TeacherAvailability.day_of_week.in_(days),
                TeacherAvailability.start_time >= time_from,
                TeacherAvailability.start_time <= time_to,
            )
        )
    )
    if teacher_id:
        avail_query = avail_query.where(TeacherAvailability.teacher_id == teacher_id)

    avail_result = await db.execute(avail_query)
    avail_slots = avail_result.all()

    open_slots = []
    for slot, user in avail_slots:
        open_slots.append(SearchAvailabilityResult(
            teacher_id=user.id,
            teacher_name=user.first_name or user.username or "Преподаватель",
            day_of_week=slot.day_of_week,
            day_name=DAY_NAMES_SHORT_RU[slot.day_of_week],
            start_time=slot.start_time,
            end_time=slot.end_time,
        ))

    return SearchResultOut(courses=courses, open_slots=open_slots)


# ── Reschedule Lesson ─────────────────────────────────────────────────

@router.post("/lessons/{lesson_id}/reschedule")
async def reschedule_lesson(
    lesson_id: int,
    data: RescheduleIn,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Verify lesson exists
    lesson = (await db.execute(
        select(Lesson).where(and_(Lesson.id == lesson_id, Lesson.is_active == True))
    )).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Parse dates
    try:
        new_date = datetime.strptime(data.new_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    try:
        original_date = datetime.strptime(data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    # Check if already happened
    existing = (await db.execute(
        select(LessonStatus).where(
            and_(LessonStatus.lesson_id == lesson_id, LessonStatus.date == original_date)
        )
    )).scalar_one_or_none()

    if existing and existing.status == "happened":
        raise HTTPException(status_code=400, detail="Cannot reschedule a completed lesson")

    # Cancel the original date
    if existing:
        existing.status = "rescheduled"
        existing.override_date = new_date
        existing.override_time = data.new_time
        existing.note = f"Перенесено на {data.new_date}"
        existing.marked_by = admin.id if hasattr(admin, 'id') else None
        existing.marked_at = _get_tashkent_now()
    else:
        ls = LessonStatus(
            lesson_id=lesson_id,
            date=original_date,
            status="rescheduled",
            override_date=new_date,
            override_time=data.new_time,
            note=f"Перенесено на {data.new_date}",
            marked_by=admin.id if hasattr(admin, 'id') else None,
        )
        db.add(ls)

    admin_id = admin.id if hasattr(admin, 'id') else None
    await _log_audit(db, "lesson", lesson_id, "reschedule", "lesson_status", None, f"to {data.new_date}", admin_id)
    await db.commit()
    return {"ok": True, "original_date": original_date.strftime("%Y-%m-%d"), "new_date": data.new_date}


# ── Cancel Lesson ─────────────────────────────────────────────────────

@router.post("/lessons/{lesson_id}/cancel")
async def cancel_lesson(
    lesson_id: int,
    data: CancelLessonIn,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    lesson = (await db.execute(
        select(Lesson).where(and_(Lesson.id == lesson_id, Lesson.is_active == True))
    )).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    try:
        target_date = datetime.strptime(data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    existing = (await db.execute(
        select(LessonStatus).where(
            and_(LessonStatus.lesson_id == lesson_id, LessonStatus.date == target_date)
        )
    )).scalar_one_or_none()

    if existing:
        existing.status = "cancelled"
        existing.marked_by = admin.id if hasattr(admin, 'id') else None
        existing.marked_at = _get_tashkent_now()
    else:
        ls = LessonStatus(
            lesson_id=lesson_id,
            date=target_date,
            status="cancelled",
            marked_by=admin.id if hasattr(admin, 'id') else None,
        )
        db.add(ls)

    admin_id = admin.id if hasattr(admin, 'id') else None
    await _log_audit(db, "lesson", lesson_id, "cancel", "lesson_status", None, "cancelled", admin_id)
    await db.commit()
    return {"ok": True}


# ── Announcements ─────────────────────────────────────────────────────

TARGET_SUMMARY = {
    "all": "Всем",
    "teachers": "Преподавателям",
    "students": "Ученикам",
}


@router.post("/announcements", response_model=AdminAnnouncementOut)
async def create_announcement(
    data: AdminAnnouncementCreate,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    recipient_ids: list[int] = []
    target_summary = TARGET_SUMMARY.get(data.target_type, data.target_type)

    if data.target_type == "all":
        users_result = await db.execute(select(User.id))
        recipient_ids = [row[0] for row in users_result.fetchall()]

    elif data.target_type == "teachers":
        users_result = await db.execute(select(User.id).where(User.role == "teacher"))
        recipient_ids = [row[0] for row in users_result.fetchall()]

    elif data.target_type == "students":
        users_result = await db.execute(select(User.id).where(User.role == "student"))
        recipient_ids = [row[0] for row in users_result.fetchall()]

    elif data.target_type == "course":
        if not data.course_ids:
            raise HTTPException(status_code=400, detail="course_ids required")
        lesson_ids_result = await db.execute(
            select(Lesson.id).where(
                and_(Lesson.subject_id.in_(data.course_ids), Lesson.is_active == True)
            )
        )
        lesson_ids = [row[0] for row in lesson_ids_result.fetchall()]
        if lesson_ids:
            students_result = await db.execute(
                select(func.distinct(LessonEnrollment.user_id))
                .where(LessonEnrollment.lesson_id.in_(lesson_ids))
            )
            recipient_ids = [row[0] for row in students_result.fetchall()]
        # Build summary
        course_names = []
        for cid in data.course_ids:
            subj = (await db.execute(select(Subject).where(Subject.id == cid))).scalar_one_or_none()
            if subj:
                course_names.append(subj.name)
        target_summary = f"Курс: {', '.join(course_names)}" if course_names else "Курс"

    elif data.target_type == "teacher_courses":
        if not data.target_id:
            raise HTTPException(status_code=400, detail="target_id (teacher_id) required")
        lesson_ids_result = await db.execute(
            select(Lesson.id).where(
                and_(Lesson.teacher_id == data.target_id, Lesson.is_active == True)
            )
        )
        lesson_ids = [row[0] for row in lesson_ids_result.fetchall()]
        if lesson_ids:
            students_result = await db.execute(
                select(func.distinct(LessonEnrollment.user_id))
                .where(LessonEnrollment.lesson_id.in_(lesson_ids))
            )
            recipient_ids = [row[0] for row in students_result.fetchall()]
        teacher = (await db.execute(select(User).where(User.id == data.target_id))).scalar_one_or_none()
        target_summary = f"Курсы преподавателя: {teacher.first_name if teacher else '?'}"

    elif data.target_type == "specific_students":
        if not data.student_ids:
            raise HTTPException(status_code=400, detail="student_ids required")
        # Validate student IDs exist
        existing = (await db.execute(
            select(User.id).where(User.id.in_(data.student_ids))
        )).scalars().all()
        recipient_ids = list(existing)
        if not recipient_ids:
            raise HTTPException(status_code=400, detail="No valid student IDs found")
        target_summary = f"Выбранным ученикам ({len(recipient_ids)})"

    # Create notification
    notification = Notification(
        sender_id=admin.id if hasattr(admin, 'id') else None,
        title=data.title,
        message=data.message,
        target_type=data.target_type,
        target_id=data.target_id or (data.course_ids[0] if data.course_ids else None),
    )
    db.add(notification)
    await db.flush()  # Get notification.id without committing

    # Store recipients
    for uid in recipient_ids:
        db.add(NotificationRecipient(notification_id=notification.id, user_id=uid))

    # Audit log
    admin_id = admin.id if hasattr(admin, 'id') else None
    await _log_audit(db, "announcement", notification.id, "create", None, None, f"{data.target_type}: {len(recipient_ids)} recipients", admin_id)

    # Single commit for all changes
    await db.commit()
    await db.refresh(notification)

    # Send Telegram messages
    if recipient_ids:
        from bot.bot import bot
        users_result = await db.execute(
            select(User.telegram_id).where(User.id.in_(recipient_ids))
        )
        telegram_ids = [row[0] for row in users_result.fetchall()]

        sender_name = admin.first_name if hasattr(admin, 'first_name') and admin.first_name else "Админ"
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

    return AdminAnnouncementOut(
        id=notification.id,
        title=notification.title,
        message=notification.message,
        target_type=data.target_type,
        target_summary=target_summary,
        recipient_count=len(recipient_ids),
        sent_at=notification.sent_at.strftime("%Y-%m-%d %H:%M") if notification.sent_at else "",
        sender_name=admin.first_name if hasattr(admin, 'first_name') else None,
    )


@router.get("/announcements", response_model=list[AdminAnnouncementOut])
async def get_announcements(
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification, User)
        .outerjoin(User, Notification.sender_id == User.id)
        .order_by(Notification.sent_at.desc())
        .limit(100)
    )
    rows = result.all()

    out = []
    for notif, sender in rows:
        # Count recipients
        count_result = await db.execute(
            select(func.count()).select_from(NotificationRecipient)
            .where(NotificationRecipient.notification_id == notif.id)
        )
        recipient_count = count_result.scalar() or 0

        # Build detailed target_summary
        target_summary = TARGET_SUMMARY.get(notif.target_type, notif.target_type)
        if notif.target_type == "course" and notif.target_id:
            subj = (await db.execute(select(Subject).where(Subject.id == notif.target_id))).scalar_one_or_none()
            if subj:
                target_summary = f"Курс: {subj.name}"
        elif notif.target_type == "teacher_courses" and notif.target_id:
            teacher = (await db.execute(select(User).where(User.id == notif.target_id))).scalar_one_or_none()
            if teacher:
                target_summary = f"Курсы преподавателя: {teacher.first_name}"
        elif notif.target_type == "specific_students":
            target_summary = f"Выбранным ученикам ({recipient_count})"

        out.append(AdminAnnouncementOut(
            id=notif.id,
            title=notif.title,
            message=notif.message,
            target_type=notif.target_type,
            target_summary=target_summary,
            target_id=notif.target_id,
            recipient_count=recipient_count,
            sent_at=notif.sent_at.strftime("%Y-%m-%d %H:%M") if notif.sent_at else "",
            sender_name=sender.first_name if sender else None,
        ))

    return out


@router.get("/announcements/{announcement_id}", response_model=AdminAnnouncementOut)
async def get_announcement_detail(
    announcement_id: int,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification, User)
        .outerjoin(User, Notification.sender_id == User.id)
        .where(Notification.id == announcement_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Announcement not found")

    n, u = row

    count_result = await db.execute(
        select(func.count()).select_from(NotificationRecipient)
        .where(NotificationRecipient.notification_id == n.id)
    )
    recipient_count = count_result.scalar() or 0

    # Build detailed target_summary
    target_summary = TARGET_SUMMARY.get(n.target_type, n.target_type)
    if n.target_type == "course" and n.target_id:
        subj = (await db.execute(select(Subject).where(Subject.id == n.target_id))).scalar_one_or_none()
        if subj:
            target_summary = f"Курс: {subj.name}"
    elif n.target_type == "teacher_courses" and n.target_id:
        teacher = (await db.execute(select(User).where(User.id == n.target_id))).scalar_one_or_none()
        if teacher:
            target_summary = f"Курсы преподавателя: {teacher.first_name}"
    elif n.target_type == "specific_students":
        target_summary = f"Выбранным ученикам ({recipient_count})"

    return AdminAnnouncementOut(
        id=n.id,
        title=n.title,
        message=n.message,
        target_type=n.target_type,
        target_summary=target_summary,
        target_id=n.target_id,
        recipient_count=recipient_count,
        sent_at=n.sent_at.strftime("%Y-%m-%d %H:%M") if n.sent_at else "",
        sender_name=u.first_name if u else None,
    )


class AdminAnnouncementRecipientOut(UserOut):
    pass


@router.get("/announcements/{announcement_id}/recipients", response_model=list[AdminAnnouncementRecipientOut])
async def get_announcement_recipients(
    announcement_id: int,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(Notification.id == announcement_id)
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Announcement not found")

    recipients_result = await db.execute(
        select(User)
        .join(NotificationRecipient, NotificationRecipient.user_id == User.id)
        .where(NotificationRecipient.notification_id == announcement_id)
        .order_by(User.first_name)
    )
    return recipients_result.scalars().all()


# ── Subjects (Courses) ───────────────────────────────────────────────

@router.get("/subjects", response_model=list[AdminSubjectOut])
async def get_admin_subjects(
    archived: bool = False,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Subject).where(Subject.is_archived == archived).order_by(Subject.name)
    )
    subjects = result.scalars().all()

    out = []
    for subj in subjects:
        lessons_result = await db.execute(
            select(Lesson).where(and_(Lesson.subject_id == subj.id, Lesson.is_active == True))
        )
        lessons = lessons_result.scalars().all()

        lesson_ids = [l.id for l in lessons]
        student_count = 0
        if lesson_ids:
            count_result = await db.execute(
                select(func.count(func.distinct(LessonEnrollment.user_id)))
                .where(LessonEnrollment.lesson_id.in_(lesson_ids))
            )
            student_count = count_result.scalar() or 0

        teacher_names = list({l.teacher_name for l in lessons if l.teacher_name})

        out.append(AdminSubjectOut(
            id=subj.id,
            name=subj.name,
            description=subj.description,
            duration_minutes=subj.duration_minutes or 90,
            lesson_count=len(lessons),
            student_count=student_count,
            teacher_names=teacher_names,
            is_archived=subj.is_archived or False,
        ))

    return out


@router.post("/subjects", response_model=AdminSubjectDetailOut)
async def create_admin_subject(
    data: AdminSubjectCreate,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a course with lessons, teacher, and enrolled students."""
    # Check name uniqueness
    existing = await db.execute(select(Subject).where(Subject.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Course name already exists")

    # Get teacher name if teacher_id provided
    teacher_name = ""
    if data.teacher_id:
        teacher = await db.execute(select(User).where(User.id == data.teacher_id))
        teacher = teacher.scalar_one_or_none()
        if not teacher:
            raise HTTPException(status_code=400, detail="Teacher not found")
        teacher_name = f"{teacher.first_name or ''} {teacher.last_name or ''}".strip()

    # Create subject
    subject = Subject(
        name=data.name,
        description=data.description,
        duration_weeks=data.duration_weeks,
        duration_minutes=data.duration_minutes,
    )
    db.add(subject)
    await db.flush()

    # Create lessons from schedule
    lessons = []
    for slot in data.schedule:
        lesson = Lesson(
            subject_id=subject.id,
            teacher_id=data.teacher_id,
            teacher_name=teacher_name,
            day_of_week=slot.day_of_week,
            time=slot.time,
            room=slot.room,
            max_capacity=data.max_capacity,
            is_active=True,
        )
        db.add(lesson)
        lessons.append(lesson)
    await db.flush()

    # Enroll students in all lessons
    if data.student_ids:
        for lesson in lessons:
            for user_id in data.student_ids:
                # Verify student exists
                student = await db.execute(select(User).where(User.id == user_id))
                student = student.scalar_one_or_none()
                if not student:
                    continue
                enrollment = LessonEnrollment(
                    lesson_id=lesson.id,
                    user_id=user_id,
                )
                db.add(enrollment)
    await db.commit()

    # Return the created subject detail
    return await get_admin_subject_detail(subject.id, admin, db)


@router.post("/teachers-for-schedule", response_model=list[UserOut])
async def get_teachers_for_schedule(
    schedule: list[ScheduleTimeSlot],
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Find teachers whose availability covers ALL schedule slots."""
    if not schedule:
        return []

    # Get all active teachers
    teachers_result = await db.execute(
        select(User).where(User.role == "teacher", User.is_active == True)
    )
    all_teachers = teachers_result.scalars().all()

    matching = []
    for teacher in all_teachers:
        # Get teacher's availability slots
        avail_result = await db.execute(
            select(TeacherAvailability).where(
                TeacherAvailability.teacher_id == teacher.id,
                TeacherAvailability.is_active == True,
            )
        )
        avail_slots = avail_result.scalars().all()

        # Check if teacher has availability for ALL schedule slots
        # Lesson must fit entirely: avail.start <= lesson.start AND avail.end >= lesson.end
        covers_all = True
        for slot in schedule:
            # Calculate lesson end time
            h, m = map(int, slot.time.split(":"))
            end_minutes = h * 60 + m + slot.duration_minutes
            end_h, end_m = divmod(end_minutes, 60)
            lesson_end = f"{end_h:02d}:{end_m:02d}"

            has_slot = any(
                a.day_of_week == slot.day_of_week
                and a.start_time <= slot.time
                and a.end_time >= lesson_end
                for a in avail_slots
            )
            if not has_slot:
                covers_all = False
                break

        if covers_all:
            matching.append(teacher)

    # Return matching teachers first, then others
    matching_ids = {t.id for t in matching}
    others = [t for t in all_teachers if t.id not in matching_ids]

    return [
        *[user_to_dict(t) for t in matching],
        *[user_to_dict(t) for t in others],
    ]


@router.get("/subjects/{subject_id}", response_model=AdminSubjectDetailOut)
async def get_admin_subject_detail(
    subject_id: int,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    subject = (await db.execute(
        select(Subject).where(Subject.id == subject_id)
    )).scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    lessons_result = await db.execute(
        select(Lesson, Subject)
        .join(Subject, Lesson.subject_id == Subject.id)
        .where(and_(Lesson.subject_id == subject_id, Lesson.is_active == True))
        .order_by(Lesson.day_of_week, Lesson.time)
    )
    lessons = lessons_result.all()

    now = _get_tashkent_now()
    today = now.date()
    start_monday = today - timedelta(days=today.weekday())

    admin_lessons = []
    for lesson, subj in lessons:
        instance_date = start_monday + timedelta(days=lesson.day_of_week)
        ls_result = await db.execute(
            select(LessonStatus).where(
                and_(LessonStatus.lesson_id == lesson.id, LessonStatus.date == instance_date)
            )
        )
        ls = ls_result.scalar_one_or_none()
        status = ls.status if ls else None

        count_result = await db.execute(
            select(func.count()).select_from(LessonEnrollment)
            .where(LessonEnrollment.lesson_id == lesson.id)
        )
        student_count = count_result.scalar() or 0

        end_time = _calculate_end_time(lesson.time, subj.duration_minutes or 90)

        admin_lessons.append(AdminLessonOut(
            id=lesson.id,
            subject_id=subj.id,
            subject_name=subj.name,
            teacher_name=lesson.teacher_name,
            teacher_id=lesson.teacher_id,
            day_of_week=lesson.day_of_week,
            day_name=DAY_NAMES_SHORT_RU[lesson.day_of_week],
            time=lesson.time,
            end_time=end_time,
            room=lesson.room,
            student_count=student_count,
            lesson_status=status,
            date=instance_date.strftime("%Y-%m-%d"),
        ))

    lesson_ids = [l.id for l, _ in lessons]
    students = []
    if lesson_ids:
        enroll_result = await db.execute(
            select(User)
            .join(LessonEnrollment, LessonEnrollment.user_id == User.id)
            .where(LessonEnrollment.lesson_id.in_(lesson_ids))
            .distinct()
            .order_by(User.first_name)
        )
        students = enroll_result.scalars().all()

    return AdminSubjectDetailOut(
        id=subject.id,
        name=subject.name,
        description=subject.description,
        duration_minutes=subject.duration_minutes or 90,
        duration_weeks=subject.duration_weeks,
        start_date=subject.start_date.strftime("%Y-%m-%d") if subject.start_date else None,
        is_archived=subject.is_archived or False,
        lessons=admin_lessons,
        students=[
            UserOut(
                id=s.id,
                telegram_id=s.telegram_id,
                username=s.username,
                first_name=s.first_name,
                last_name=s.last_name,
                language_code=s.language_code,
                is_premium=s.is_premium,
                photo_url=s.photo_url,
                phone=s.phone,
                grade=s.grade,
                role=s.role,
                is_active=s.is_active,
                onboarded=s.onboarded,
                created_at=s.created_at.strftime("%Y-%m-%d %H:%M:%S") if s.created_at else "",
            ) for s in students
        ],
    )


# ── Archive / Unarchive Subject ──────────────────────────────────────

@router.patch("/subjects/{subject_id}/archive")
async def archive_subject(
    subject_id: int,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Archive a course: hide from students/teachers, keep data for admin."""
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    if subject.is_archived:
        raise HTTPException(status_code=400, detail="Already archived")

    subject.is_archived = True

    # Deactivate all lessons in this subject
    lessons_result = await db.execute(
        select(Lesson).where(Lesson.subject_id == subject_id)
    )
    for lesson in lessons_result.scalars().all():
        lesson.is_active = False

    admin_id = admin.id if hasattr(admin, "id") else None
    await _log_audit(db, "subject", subject_id, "archive",
                     "is_archived", "false", "true", admin_id)
    await db.commit()
    return {"ok": True, "archived": True}


@router.patch("/subjects/{subject_id}/unarchive")
async def unarchive_subject(
    subject_id: int,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Unarchive a course: restore visibility for students/teachers."""
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    if not subject.is_archived:
        raise HTTPException(status_code=400, detail="Not archived")

    subject.is_archived = False

    # Reactivate all lessons in this subject
    lessons_result = await db.execute(
        select(Lesson).where(Lesson.subject_id == subject_id)
    )
    for lesson in lessons_result.scalars().all():
        lesson.is_active = True

    admin_id = admin.id if hasattr(admin, "id") else None
    await _log_audit(db, "subject", subject_id, "unarchive",
                     "is_archived", "true", "false", admin_id)
    await db.commit()
    return {"ok": True, "archived": False}


# ── Mark Lesson Status ───────────────────────────────────────────────

@router.post("/lessons/{lesson_id}/status")
async def mark_lesson_status(
    lesson_id: int,
    data: LessonStatusMarkIn,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    lesson = (await db.execute(
        select(Lesson).where(and_(Lesson.id == lesson_id, Lesson.is_active == True))
    )).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    try:
        target_date = datetime.strptime(data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    existing = (await db.execute(
        select(LessonStatus).where(
            and_(LessonStatus.lesson_id == lesson_id, LessonStatus.date == target_date)
        )
    )).scalar_one_or_none()

    if existing:
        existing.status = data.status
        existing.marked_by = admin.id if hasattr(admin, 'id') else None
        existing.marked_at = _get_tashkent_now()
    else:
        ls = LessonStatus(
            lesson_id=lesson_id,
            date=target_date,
            status=data.status,
            marked_by=admin.id if hasattr(admin, 'id') else None,
        )
        db.add(ls)

    admin_id = admin.id if hasattr(admin, 'id') else None
    await _log_audit(db, "lesson", lesson_id, "mark_status", "lesson_status", None, data.status, admin_id)
    await db.commit()
    return {"ok": True}


# ── Edit Lesson (title / plan) ───────────────────────────────────────

@router.put("/lessons/{lesson_id}", response_model=LessonDetailOut)
async def admin_update_lesson(
    lesson_id: int,
    data: LessonUpdateIn,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: update lesson custom_title and/or lesson_plan."""
    lesson_result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = lesson_result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    admin_id = admin.id if hasattr(admin, 'id') else None

    if data.custom_title is not None:
        old = lesson.custom_title
        lesson.custom_title = data.custom_title if data.custom_title.strip() else None
        await _log_audit(db, "lesson", lesson_id, "update", "custom_title", old, lesson.custom_title, admin_id)

    if data.lesson_plan is not None:
        old = lesson.lesson_plan
        try:
            items = _json.loads(data.lesson_plan)
            if not isinstance(items, list):
                raise ValueError("Must be a list")
            lesson.lesson_plan = data.lesson_plan
        except (ValueError, _json.JSONDecodeError):
            raise HTTPException(status_code=422, detail="lesson_plan must be valid JSON array")
        await _log_audit(db, "lesson", lesson_id, "update", "lesson_plan", old, lesson.lesson_plan, admin_id)

    await db.commit()
    await db.refresh(lesson)

    # Return full lesson detail via courses helper
    from api.courses import get_lesson_detail
    return await get_lesson_detail(lesson_id, user=admin, db=db)


# ── Attendance (Admin) ───────────────────────────────────────────────

@router.get("/lessons/{lesson_id}/attendance", response_model=AttendanceListOut)
async def admin_get_lesson_attendance(
    lesson_id: int,
    date: str = Query(...),
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: get attendance for a lesson instance."""
    lesson_result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = lesson_result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    try:
        lesson_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    status_result = await db.execute(
        select(LessonStatus).where(
            and_(LessonStatus.lesson_id == lesson_id, LessonStatus.date == lesson_date)
        )
    )
    lesson_status = status_result.scalar_one_or_none()
    status_str = lesson_status.status if lesson_status else None

    return await _build_attendance_list_admin(lesson_id, date, status_str, db)


@router.post("/lessons/{lesson_id}/attendance", response_model=AttendanceListOut)
async def admin_mark_attendance(
    lesson_id: int,
    data: AttendanceBulkIn,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: bulk mark attendance for a lesson instance."""
    lesson_result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = lesson_result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    try:
        lesson_date = datetime.strptime(data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    # Verify lesson status is "happened"
    status_result = await db.execute(
        select(LessonStatus).where(
            and_(LessonStatus.lesson_id == lesson_id, LessonStatus.date == lesson_date)
        )
    )
    lesson_status = status_result.scalar_one_or_none()
    if not lesson_status or lesson_status.status != "happened":
        raise HTTPException(status_code=400, detail="Mark lesson as happened first")

    admin_id = admin.id if hasattr(admin, 'id') else None

    # Get enrolled user IDs for validation
    enrolled_result = await db.execute(
        select(LessonEnrollment.user_id).where(LessonEnrollment.lesson_id == lesson_id)
    )
    enrolled_ids = {row[0] for row in enrolled_result.all()}

    # Upsert attendance records (only for enrolled students)
    for record in data.records:
        if record.user_id not in enrolled_ids:
            raise HTTPException(status_code=400, detail=f"User {record.user_id} is not enrolled in this lesson")
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
            att.marked_by = admin_id
            att.marked_at = _get_tashkent_now()
        else:
            att = Attendance(
                lesson_id=lesson_id,
                user_id=record.user_id,
                date=lesson_date,
                present=record.present,
                marked_by=admin_id,
            )
            db.add(att)

    await _log_audit(db, "attendance", lesson_id, "update", "attendance",
                     None, f"{len(data.records)} records for {data.date}", admin_id)
    await db.commit()

    return await _build_attendance_list_admin(lesson_id, data.date, lesson_status.status, db)


async def _build_attendance_list_admin(lesson_id: int, date: str, status: str | None, db: AsyncSession) -> AttendanceListOut:
    """Build attendance list with all enrolled students."""
    lesson_date = datetime.strptime(date, "%Y-%m-%d").date()

    enrollments_result = await db.execute(
        select(User)
        .join(LessonEnrollment, LessonEnrollment.user_id == User.id)
        .where(LessonEnrollment.lesson_id == lesson_id)
        .order_by(User.first_name)
    )
    students = enrollments_result.scalars().all()

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


# ── Create Lesson ────────────────────────────────────────────────────

@router.post("/subjects/{subject_id}/lessons", response_model=AdminLessonOut)
async def admin_create_lesson(
    subject_id: int,
    data: AdminLessonCreate,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: create a new lesson slot for a subject."""
    subject = (await db.execute(select(Subject).where(Subject.id == subject_id))).scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    lesson = Lesson(
        subject_id=subject_id,
        teacher_id=data.teacher_id,
        teacher_name=data.teacher_name,
        day_of_week=data.day_of_week,
        time=data.time,
        room=data.room,
        location=data.location,
        max_capacity=data.max_capacity,
    )
    db.add(lesson)
    await db.flush()  # flush to get lesson.id without committing

    admin_id = admin.id if hasattr(admin, 'id') else None
    await _log_audit(db, "lesson", lesson.id, "create", None, None,
                     f"{data.teacher_name} {DAY_NAMES_SHORT_RU[data.day_of_week]} {data.time}", admin_id)
    await db.commit()
    await db.refresh(lesson)

    end_time = _calculate_end_time(lesson.time, subject.duration_minutes or 90)

    return AdminLessonOut(
        id=lesson.id,
        subject_id=subject.id,
        subject_name=subject.name,
        teacher_name=lesson.teacher_name,
        teacher_id=lesson.teacher_id,
        day_of_week=lesson.day_of_week,
        day_name=DAY_NAMES_SHORT_RU[lesson.day_of_week],
        time=lesson.time,
        end_time=end_time,
        room=lesson.room,
        student_count=0,
        lesson_status=None,
        date="",
    )


# ── Toggle Lesson Active ─────────────────────────────────────────────

@router.patch("/lessons/{lesson_id}/toggle-active")
async def admin_toggle_lesson_active(
    lesson_id: int,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: activate/deactivate a lesson slot."""
    lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id))).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    old = lesson.is_active
    lesson.is_active = not lesson.is_active

    admin_id = admin.id if hasattr(admin, 'id') else None
    await _log_audit(db, "lesson", lesson_id, "toggle_active", "is_active", old, lesson.is_active, admin_id)
    await db.commit()

    return {"ok": True, "is_active": lesson.is_active}


# ── Enroll / Unenroll Student ────────────────────────────────────────

@router.post("/lessons/{lesson_id}/enroll")
async def admin_enroll_student(
    lesson_id: int,
    data: EnrollStudentIn,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: enroll a student in a lesson."""
    lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id))).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    user = (await db.execute(select(User).where(User.id == data.user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check duplicate
    existing = (await db.execute(
        select(LessonEnrollment).where(
            and_(LessonEnrollment.lesson_id == lesson_id, LessonEnrollment.user_id == data.user_id)
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Already enrolled")

    enrollment = LessonEnrollment(lesson_id=lesson_id, user_id=data.user_id)
    db.add(enrollment)

    admin_id = admin.id if hasattr(admin, 'id') else None
    await _log_audit(db, "enrollment", lesson_id, "enroll", None, None,
                     f"user_id={data.user_id}", admin_id)
    await db.commit()

    return {"ok": True}


@router.delete("/lessons/{lesson_id}/enroll/{user_id}")
async def admin_unenroll_student(
    lesson_id: int,
    user_id: int,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: unenroll a student from a lesson."""
    enrollment = (await db.execute(
        select(LessonEnrollment).where(
            and_(LessonEnrollment.lesson_id == lesson_id, LessonEnrollment.user_id == user_id)
        )
    )).scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    await db.delete(enrollment)

    admin_id = admin.id if hasattr(admin, 'id') else None
    await _log_audit(db, "enrollment", lesson_id, "unenroll", None, f"user_id={user_id}", None, admin_id)
    await db.commit()

    return {"ok": True}


# ── Audit Log ────────────────────────────────────────────────────────

@router.get("/audit-log", response_model=list[AuditLogOut])
async def get_audit_log(
    entity_type: str | None = None,
    entity_id: int | None = None,
    limit: int = Query(50, ge=1, le=200),
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: query audit log entries."""
    query = select(AuditLog, User).outerjoin(User, AuditLog.performed_by == User.id)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    query = query.order_by(AuditLog.performed_at.desc()).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    out = []
    for entry, user in rows:
        out.append(AuditLogOut(
            id=entry.id,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            action=entry.action,
            field_name=entry.field_name,
            old_value=entry.old_value,
            new_value=entry.new_value,
            performed_by=entry.performed_by,
            performed_by_name=user.first_name if user else None,
            performed_by_type=entry.performed_by_type,
            performed_at=entry.performed_at.strftime("%Y-%m-%d %H:%M:%S") if entry.performed_at else "",
        ))

    return out
