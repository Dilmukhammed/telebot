import json as _json
import logging
import secrets
import string
from html import escape
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from datetime import datetime, timedelta, date as dt_date

logger = logging.getLogger(__name__)

from database import get_db
from models import (
    User, Lesson, LessonEnrollment, Subject, LessonStatus,
    Notification, NotificationRecipient, NotificationAttachment, TeacherAvailability, Test,
    Attendance, AuditLog, AvailabilityRequest, utcnow,
)
from api.users import user_to_dict
from schemas import (
    AdminStatsOut, DashboardLessonOut, AdminLessonOut, AdminAvailabilitySlot,
    RescheduleIn, AdminAnnouncementCreate, AdminAnnouncementOut,
    SearchResultOut, SearchCourseResult, SearchAvailabilityResult,
    AdminSubjectOut, AdminSubjectDetailOut, LessonStatusMarkIn, UserOut,
    LessonUpdateIn, LessonDetailOut, LessonStatusOut,
    AttendanceBulkIn, AttendanceListOut, AttendanceRecordOut,
    AdminLessonCreate, EnrollStudentIn, AuditLogOut, CancelLessonIn,
    AdminSubjectCreate, AdminSubjectUpdate, ScheduleTimeSlot,
    AdminLessonScheduleUpdate, AvailabilityRequestIn, AvailabilityRequestOut,
)
from api.deps import require_admin
from subject_drive_folder import sync_subject_drive_folder
from utils.time import _get_tashkent_now, _calculate_end_time
from utils.constants import DAY_NAMES_RU, DAY_NAMES_SHORT_RU
from cache import admin_stats_cache, course_list_cache, cache_get, cache_set, invalidate_admin_stats, invalidate_courses
from utils.attendance import build_attendance_list

router = APIRouter(prefix="/admin", tags=["admin-panel"])


async def _sync_subject_drive_folder_after_update(
    db: AsyncSession, subject_id: int,
    old_name: str | None = None,
) -> None:
    """Sync Google Drive folder for a subject. Skips API call if name unchanged."""
    subject = (await db.execute(select(Subject).where(Subject.id == subject_id))).scalar_one_or_none()
    if not subject:
        return
    # Only sync if subject name actually changed (teacher changes are on Lesson, not Subject)
    if old_name is not None and old_name == subject.name:
        return  # No change, skip Google Drive API call
    await sync_subject_drive_folder(db, subject)
    await db.commit()



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


def _normalize_hhmm(t: str) -> str:
    """Parse HH:MM or HH:MM:SS into canonical HH:MM."""
    parts = t.strip().split(":")
    if len(parts) < 2:
        return ""
    try:
        h, m = int(parts[0]), int(parts[1])
    except ValueError:
        return ""
    if not (0 <= h <= 23 and 0 <= m <= 59):
        return ""
    return f"{h:02d}:{m:02d}"




def _time_to_minutes(t: str) -> int:
    norm = _normalize_hhmm(t)
    if not norm:
        return 0
    h, m = map(int, norm.split(":"))
    return h * 60 + m


def _times_overlap(start1: str, end1: str, start2: str, end2: str) -> bool:
    """True if two HH:MM intervals overlap."""
    s1, e1 = _time_to_minutes(start1), _time_to_minutes(end1)
    s2, e2 = _time_to_minutes(start2), _time_to_minutes(end2)
    return s1 < e2 and e1 > s2


async def _load_teachers_map(db: AsyncSession, teacher_ids: set[int]) -> dict[int, str]:
    """Current teacher display names from users table (not denormalized lesson.teacher_name)."""
    if not teacher_ids:
        return {}
    result = await db.execute(
        select(User.id, User.first_name, User.last_name, User.username).where(User.id.in_(teacher_ids))
    )
    teachers_map: dict[int, str] = {}
    for row in result.all():
        full_name = f"{row[1] or ''} {row[2] or ''}".strip() if row[1] or row[2] else (row[3] or "")
        teachers_map[row[0]] = full_name
    return teachers_map


def _lesson_teacher_name(lesson: Lesson, teachers_map: dict[int, str]) -> str:
    if lesson.teacher_id and lesson.teacher_id in teachers_map:
        return teachers_map[lesson.teacher_id]
    return lesson.teacher_name or ""


async def _teacher_course_name_taken(
    db: AsyncSession,
    name: str,
    teacher_id: int | None,
    *,
    exclude_subject_id: int | None = None,
) -> bool:
    """True if this teacher already has a non-deleted course with the same name (incl. archived)."""
    if not teacher_id:
        return False
    query = (
        select(Subject.id)
        .join(Lesson, Lesson.subject_id == Subject.id)
        .where(
            Subject.name == name,
            Subject.is_deleted == False,
            Lesson.teacher_id == teacher_id,
        )
        .limit(1)
    )
    if exclude_subject_id is not None:
        query = query.where(Subject.id != exclude_subject_id)
    return (await db.execute(query)).scalar_one_or_none() is not None


# ── Stats ─────────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStatsOut)
async def get_stats(
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Check cache
    cached = cache_get(admin_stats_cache, "admin_stats")
    if cached is not None:
        return cached

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

    teacher_ids = {lesson.teacher_id for lesson, _, _ in lessons if lesson.teacher_id}
    teachers_map = await _load_teachers_map(db, teacher_ids)

    today_lessons = []
    for lesson, subject, ls in lessons:
        today_lessons.append(DashboardLessonOut(
            id=lesson.id,
            subject_id=subject.id,
            subject_name=subject.name,
            teacher_name=_lesson_teacher_name(lesson, teachers_map),
            day_label="Сегодня",
            time=lesson.time,
            room=lesson.room,
            date=today.strftime("%Y-%m-%d"),
        ))

    result = AdminStatsOut(
        student_count=student_count,
        teacher_count=teacher_count,
        course_count=course_count,
        active_tests=active_tests,
        today_lessons=today_lessons,
    )

    cache_set(admin_stats_cache, "admin_stats", result)
    return result


# ── Lessons (Schedule View) ───────────────────────────────────────────

@router.get("/lessons", response_model=list[AdminLessonOut])
async def get_admin_lessons(
    week_offset: int = Query(0, ge=-52, le=52),
    teacher_id: int | None = None,
    subject_id: int | None = None,
    student_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
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
    if student_id:
        # Subquery: lesson IDs where this student is enrolled
        enrolled_lesson_ids = select(LessonEnrollment.lesson_id).where(
            LessonEnrollment.user_id == student_id
        )
        query = query.where(Lesson.id.in_(enrolled_lesson_ids))
    query = query.order_by(Lesson.day_of_week, Lesson.time)

    # Subquery for enrollment count
    enrollment_count_sq = (
        select(func.count())
        .select_from(LessonEnrollment)
        .where(LessonEnrollment.lesson_id == Lesson.id)
        .correlate(Lesson)
        .scalar_subquery()
    )

    # Build date filter: for each day_of_week (0-6), compute the instance date
    # Cast to Date so PostgreSQL can compare with lesson_statuses.date (date type)
    from sqlalchemy import case, cast, Date
    day_date_pairs = [(d, (start_monday + timedelta(days=d)).strftime("%Y-%m-%d")) for d in range(7)]
    date_case = cast(
        case({d: date_str for d, date_str in day_date_pairs}, value=Lesson.day_of_week),
        Date,
    )

    # Join with LessonStatus and enrollment count in single query
    query = query.add_columns(LessonStatus, enrollment_count_sq.label("student_count"))
    query = query.outerjoin(LessonStatus, and_(
        LessonStatus.lesson_id == Lesson.id,
        LessonStatus.date == date_case,
    ))

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    teacher_ids = {lesson.teacher_id for lesson, _, _, _ in rows if lesson.teacher_id}
    teachers_map = await _load_teachers_map(db, teacher_ids)

    # If teacher_id filter, load availability slots
    # Recurring slots (no specific_date) → show on matching day_of_week
    # One-off slots (specific_date set) → show only on that exact date
    week_dates_list = [start_monday + timedelta(days=d) for d in range(7)]
    avail_by_day: dict[int, list] = {}
    avail_by_date: dict[str, list] = {}
    if teacher_id:
        avail_result = await db.execute(
            select(TeacherAvailability).where(
                and_(
                    TeacherAvailability.teacher_id == teacher_id,
                    TeacherAvailability.is_active == True,
                )
            )
        )
        for slot in avail_result.scalars().all():
            if slot.specific_date:
                date_str = slot.specific_date.strftime("%Y-%m-%d")
                avail_by_date.setdefault(date_str, []).append(
                    AdminAvailabilitySlot(id=slot.id, start_time=slot.start_time, end_time=slot.end_time)
                )
            else:
                avail_by_day.setdefault(slot.day_of_week, []).append(
                    AdminAvailabilitySlot(id=slot.id, start_time=slot.start_time, end_time=slot.end_time)
                )

    out = []
    for lesson, subject, ls, student_count in rows:
        # One-time lessons: only show on their specific_date
        if lesson.specific_date:
            instance_date = lesson.specific_date
            # Skip if not in current week
            if instance_date < start_monday or instance_date >= start_monday + timedelta(days=7):
                continue
        else:
            instance_date = start_monday + timedelta(days=lesson.day_of_week)

        # Skip lessons before course start_date (same logic as teacher calendar)
        course_start = subject.start_date.date() if subject.start_date else None
        if course_start and instance_date < course_start:
            continue

        status = ls.status if ls else None
        end_time = _calculate_end_time(lesson.time, subject.duration_minutes or 90)

        # If rescheduled to a different date, show on override date as normal lesson
        if status == "rescheduled" and ls and ls.override_date:
            override_date = ls.override_date
            override_time = ls.override_time or lesson.time
            override_end = _calculate_end_time(override_time, subject.duration_minutes or 90)
            override_dow = override_date.weekday()
            override_date_str = override_date.strftime("%Y-%m-%d")
            slots = avail_by_day.get(override_dow, []) + avail_by_date.get(override_date_str, [])
            # Determine normal status based on the override date
            if override_date == today:
                override_status = "today"
            elif override_date < today:
                override_status = "unmarked"
            else:
                override_status = "planned"
            out.append(AdminLessonOut(
                id=lesson.id,
                subject_id=subject.id,
                subject_name=subject.name,
                teacher_name=_lesson_teacher_name(lesson, teachers_map),
                teacher_id=lesson.teacher_id,
                day_of_week=override_dow,
                day_name=DAY_NAMES_SHORT_RU[override_dow],
                time=override_time,
                end_time=override_end,
                room=lesson.room,
                student_count=student_count or 0,
                lesson_status=override_status,
                date=override_date_str,
                available_slots=slots,
            ))
            continue  # Skip original date

        instance_date_str = instance_date.strftime("%Y-%m-%d")
        slots = avail_by_day.get(lesson.day_of_week, []) + avail_by_date.get(instance_date_str, [])
        out.append(AdminLessonOut(
            id=lesson.id,
            subject_id=subject.id,
            subject_name=subject.name,
            teacher_name=_lesson_teacher_name(lesson, teachers_map),
            teacher_id=lesson.teacher_id,
            day_of_week=lesson.day_of_week,
            day_name=DAY_NAMES_SHORT_RU[lesson.day_of_week],
            time=lesson.time,
            end_time=end_time,
            room=lesson.room,
            student_count=student_count or 0,
            lesson_status=status,
            date=instance_date_str,
            available_slots=slots,
        ))

    out.sort(key=lambda x: (x.date, x.time))
    return out


# ── Smart Search ──────────────────────────────────────────────────────

@router.get("/search", response_model=SearchResultOut)
async def search_courses(
    days: list[int] = Query(...),
    time_from: str = Query(..., pattern=r"^\d{2}:\d{2}(:\d{2})?$"),
    time_to: str = Query(..., pattern=r"^\d{2}:\d{2}(:\d{2})?$"),
    teacher_id: int | None = None,
    subject_id: int | None = None,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Validate days range (ge/le doesn't work on list[int] in Pydantic v2)
    for d in days:
        if d < 0 or d > 6:
            raise HTTPException(status_code=400, detail="days values must be 0-6")
    time_from = _normalize_hhmm(time_from)
    time_to = _normalize_hhmm(time_to)
    if not time_from or not time_to:
        raise HTTPException(status_code=400, detail="Invalid time format")
    if _time_to_minutes(time_from) >= _time_to_minutes(time_to):
        raise HTTPException(status_code=400, detail="time_from must be before time_to")

    # Lessons on selected days in non-archived courses
    query = (
        select(Lesson, Subject)
        .join(Subject, Lesson.subject_id == Subject.id)
        .where(
            and_(
                Lesson.is_active == True,
                Subject.is_archived == False,
                Subject.is_deleted == False,
                Lesson.day_of_week.in_(days),
            )
        )
    )
    if teacher_id:
        query = query.where(Lesson.teacher_id == teacher_id)
    if subject_id:
        query = query.where(Lesson.subject_id == subject_id)

    result = await db.execute(query)
    lessons = result.all()

    lesson_ids = [lesson.id for lesson, _ in lessons]
    teacher_ids = {lesson.teacher_id for lesson, _ in lessons if lesson.teacher_id}
    teachers_map = await _load_teachers_map(db, teacher_ids)
    enrollment_counts: dict[int, int] = {}
    if lesson_ids:
        counts_result = await db.execute(
            select(LessonEnrollment.lesson_id, func.count(LessonEnrollment.id))
            .where(LessonEnrollment.lesson_id.in_(lesson_ids))
            .group_by(LessonEnrollment.lesson_id)
        )
        enrollment_counts = dict(counts_result.all())

    courses = []
    for lesson, subject in lessons:
        duration = subject.duration_minutes or 90
        end_time = _calculate_end_time(lesson.time, duration)
        if not end_time or not _times_overlap(lesson.time, end_time, time_from, time_to):
            continue

        student_count = enrollment_counts.get(lesson.id, 0)
        spots_left = lesson.max_capacity - student_count
        if spots_left <= 0:
            continue

        courses.append(SearchCourseResult(
            id=subject.id,
            lesson_id=lesson.id,
            name=subject.name,
            teacher_name=_lesson_teacher_name(lesson, teachers_map),
            day_of_week=lesson.day_of_week,
            day_name=DAY_NAMES_SHORT_RU[lesson.day_of_week],
            time=lesson.time,
            end_time=end_time,
            room=lesson.room,
            student_count=student_count,
            max_capacity=lesson.max_capacity,
            spots_left=spots_left,
            has_open_slots=True,
        ))

    courses.sort(key=lambda x: (x.day_of_week, x.time, x.name))

    # Teacher availability windows overlapping the search range
    avail_query = (
        select(TeacherAvailability, User)
        .join(User, TeacherAvailability.teacher_id == User.id)
        .where(
            and_(
                TeacherAvailability.is_active == True,
                TeacherAvailability.day_of_week.in_(days),
                User.role == "teacher",
                User.is_active == True,
            )
        )
    )
    if teacher_id:
        avail_query = avail_query.where(TeacherAvailability.teacher_id == teacher_id)

    avail_result = await db.execute(avail_query)
    avail_slots = avail_result.all()

    open_slots = []
    for slot, user in avail_slots:
        if not _times_overlap(slot.start_time, slot.end_time, time_from, time_to):
            continue
        open_slots.append(SearchAvailabilityResult(
            teacher_id=user.id,
            teacher_name=user.first_name or user.username or "Преподаватель",
            day_of_week=slot.day_of_week,
            day_name=DAY_NAMES_SHORT_RU[slot.day_of_week],
            start_time=slot.start_time,
            end_time=slot.end_time,
        ))

    open_slots.sort(key=lambda x: (x.day_of_week, x.start_time, x.teacher_name))

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

    # Find existing status for this lesson — either on the displayed date or
    # the original date (if already rescheduled, status is stored on the original date)
    existing = (await db.execute(
        select(LessonStatus).where(
            and_(LessonStatus.lesson_id == lesson_id, LessonStatus.date == original_date)
        )
    )).scalar_one_or_none()

    # If not found on displayed date, check if the lesson was previously rescheduled
    # (status is stored on the original day_of_week date)
    if not existing:
        existing = (await db.execute(
            select(LessonStatus).where(
                and_(
                    LessonStatus.lesson_id == lesson_id,
                    LessonStatus.status == "rescheduled",
                    LessonStatus.override_date == original_date,
                )
            )
        )).scalar_one_or_none()

    if existing and existing.status == "happened":
        raise HTTPException(status_code=400, detail="Cannot reschedule a completed lesson")

    # Check teacher availability at new date/time
    if lesson.teacher_id:
        new_day_of_week = new_date.weekday()  # 0=Monday
        avail_q = select(TeacherAvailability).where(
            and_(
                TeacherAvailability.teacher_id == lesson.teacher_id,
                TeacherAvailability.is_active == True,
                or_(
                    and_(TeacherAvailability.specific_date == None, TeacherAvailability.day_of_week == new_day_of_week),
                    TeacherAvailability.specific_date == new_date,
                ),
            )
        )
        avail_slots = (await db.execute(avail_q)).scalars().all()

        if not avail_slots:
            raise HTTPException(status_code=400, detail="У репетитора нет открытых слотов на этот день")
        elif data.new_time:
            new_time_str = data.new_time[:5]  # "HH:MM"
            in_slot = any(
                slot.start_time <= new_time_str < slot.end_time
                for slot in avail_slots
            )
            if not in_slot:
                raise HTTPException(status_code=400, detail="Время не попадает в открытый слот репетитора")

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

    # Clean up orphaned status at target date (e.g. previously rescheduled FROM that date)
    target_existing = (await db.execute(
        select(LessonStatus).where(
            and_(LessonStatus.lesson_id == lesson_id, LessonStatus.date == new_date)
        )
    )).scalar_one_or_none()
    if target_existing and target_existing.status == "rescheduled":
        await db.delete(target_existing)

    admin_id = admin.id if hasattr(admin, 'id') else None
    await _log_audit(db, "lesson", lesson_id, "reschedule", "lesson_status", None, f"to {data.new_date}", admin_id)
    await db.commit()

    # ── Notifications ──
    from utils.constants import DAY_NAMES_RU
    from bot.bot import bot

    subject = (await db.execute(select(Subject).where(Subject.id == lesson.subject_id))).scalar_one_or_none()
    subject_name = subject.name if subject else "занятие"
    orig_day = DAY_NAMES_RU[original_date.weekday()]
    new_day = DAY_NAMES_RU[new_date.weekday()]
    new_time_str = data.new_time or lesson.time
    msg_text = (
        f"📅 <b>Перенос занятия</b>\n\n"
        f"Предмет: <b>{subject_name}</b>\n"
        f"Было: <b>{original_date.strftime('%d.%m.%Y')}</b> ({orig_day}) в <b>{lesson.time}</b>\n"
        f"Стало: <b>{new_date.strftime('%d.%m.%Y')}</b> ({new_day}) в <b>{new_time_str}</b>"
    )

    # Telegram to teacher
    if lesson.teacher_id:
        teacher = (await db.execute(select(User).where(User.id == lesson.teacher_id))).scalar_one_or_none()
        if teacher and teacher.telegram_id:
            try:
                await bot.send_message(chat_id=teacher.telegram_id, text=msg_text + "\n\nАдмин перенёс занятие. Проверьте расписание.", parse_mode="HTML")
            except Exception as e:
                logger.warning("Failed to send reschedule notification to teacher %s: %s", lesson.teacher_id, e)

    # Announcement + Telegram to enrolled students + teacher
    enrolled = (await db.execute(select(LessonEnrollment.user_id).where(LessonEnrollment.lesson_id == lesson_id))).scalars().all()
    recipient_ids = list(enrolled)
    if lesson.teacher_id and lesson.teacher_id not in recipient_ids:
        recipient_ids.append(lesson.teacher_id)
    if recipient_ids:
        notification = Notification(
            sender_id=admin_id,
            title=f"Перенос: {subject_name}",
            message=msg_text,
            target_type="course",
        )
        db.add(notification)
        await db.flush()
        for uid in recipient_ids:
            db.add(NotificationRecipient(notification_id=notification.id, user_id=uid))
        await db.commit()

        for uid in enrolled:
            student = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
            if student and student.telegram_id:
                try:
                    await bot.send_message(chat_id=student.telegram_id, text=msg_text, parse_mode="HTML")
                except Exception as e:
                    logger.warning("Failed to send reschedule notification to student %s: %s", uid, e)

    return {"ok": True, "original_date": original_date.strftime("%Y-%m-%d"), "new_date": data.new_date}


# ── Availability Requests ─────────────────────────────────────────────

@router.post("/availability-requests", response_model=AvailabilityRequestOut)
async def create_availability_request(
    data: AvailabilityRequestIn,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin requests teacher to open a slot for rescheduling."""
    # Verify lesson exists
    lesson = (await db.execute(
        select(Lesson).where(and_(Lesson.id == data.lesson_id, Lesson.is_active == True))
    )).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if not lesson.teacher_id:
        raise HTTPException(status_code=400, detail="Lesson has no teacher assigned")

    # Check for existing pending request
    req_date = datetime.strptime(data.date, "%Y-%m-%d").date()
    orig_date = datetime.strptime(data.original_date, "%Y-%m-%d").date()
    existing = (await db.execute(
        select(AvailabilityRequest).where(
            and_(
                AvailabilityRequest.lesson_id == data.lesson_id,
                AvailabilityRequest.date == req_date,
                AvailabilityRequest.start_time == data.start_time,
                AvailabilityRequest.status == "pending",
            )
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Запрос уже отправлен и ожидает ответа")

    admin_id = admin.id if hasattr(admin, 'id') else None
    req = AvailabilityRequest(
        lesson_id=data.lesson_id,
        teacher_id=lesson.teacher_id,
        requested_by=admin_id,
        original_date=orig_date,
        date=req_date,
        start_time=data.start_time,
        end_time=data.end_time,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    # Get subject name for notification
    subject = (await db.execute(
        select(Subject).where(Subject.id == lesson.subject_id)
    )).scalar_one_or_none()
    subject_name = subject.name if subject else "занятие"

    # Send Telegram notification to teacher
    teacher = (await db.execute(
        select(User).where(User.id == lesson.teacher_id)
    )).scalar_one_or_none()
    if teacher and teacher.telegram_id:
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
        from bot.bot import bot
        from config import settings
        from utils.constants import DAY_NAMES_RU
        day_name = DAY_NAMES_RU[datetime.strptime(data.date, "%Y-%m-%d").weekday()]
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Согласовать", callback_data=f"avail_approve:{req.id}"),
                InlineKeyboardButton(text="❌ Отклонить", callback_data=f"avail_reject:{req.id}"),
            ],
            [
                InlineKeyboardButton(
                    text="📅 Открыть календарь",
                    web_app=WebAppInfo(url=f"{settings.WEBAPP_URL}/dashboard"),
                ),
            ],
        ])
        try:
            await bot.send_message(
                chat_id=teacher.telegram_id,
                text=(
                    f"📅 <b>Запрос на открытие слота</b>\n\n"
                    f"Предмет: <b>{subject_name}</b>\n"
                    f"Дата: <b>{req_date.strftime('%d.%m.%Y')}</b> ({day_name})\n"
                    f"Время: <b>{data.start_time} — {data.end_time}</b>\n\n"
                    f"Админ просит открыть слот для переноса урока.\n"
                    f"Нажмите «Согласовать», чтобы открыть слот на это время."
                ),
                reply_markup=kb,
                parse_mode="HTML",
            )
        except Exception as e:
            logger.warning("Failed to send availability request to teacher %s: %s", lesson.teacher_id, e)

    return AvailabilityRequestOut(
        id=req.id,
        lesson_id=req.lesson_id,
        teacher_id=req.teacher_id,
        original_date=req.original_date.strftime("%Y-%m-%d"),
        date=req.date.strftime("%Y-%m-%d"),
        start_time=req.start_time,
        end_time=req.end_time,
        status=req.status,
        created_at=req.created_at.isoformat() if req.created_at else "",
    )


@router.get("/availability-requests", response_model=list[AvailabilityRequestOut])
async def list_availability_requests(
    status: str | None = None,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin views availability requests."""
    query = select(AvailabilityRequest, Lesson, User).join(
        Lesson, AvailabilityRequest.lesson_id == Lesson.id
    ).join(
        User, AvailabilityRequest.teacher_id == User.id
    ).order_by(AvailabilityRequest.created_at.desc())
    if status:
        query = query.where(AvailabilityRequest.status == status)

    rows = (await db.execute(query)).all()
    out = []
    for req, lesson, teacher in rows:
        subject = (await db.execute(
            select(Subject).where(Subject.id == lesson.subject_id)
        )).scalar_one_or_none()
        out.append(AvailabilityRequestOut(
            id=req.id,
            lesson_id=req.lesson_id,
            teacher_id=req.teacher_id,
            original_date=req.original_date.strftime("%Y-%m-%d") if req.original_date else req.date.strftime("%Y-%m-%d"),
            date=req.date.strftime("%Y-%m-%d"),
            start_time=req.start_time,
            end_time=req.end_time,
            status=req.status,
            created_at=req.created_at.isoformat() if req.created_at else "",
            subject_name=subject.name if subject else None,
            teacher_name=teacher.first_name,
        ))
    return out


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

    # ── Notifications ──
    from utils.constants import DAY_NAMES_RU
    from bot.bot import bot

    subject = (await db.execute(select(Subject).where(Subject.id == lesson.subject_id))).scalar_one_or_none()
    subject_name = subject.name if subject else "занятие"
    day_name = DAY_NAMES_RU[target_date.weekday()]
    msg_text = (
        f"❌ <b>Отмена занятия</b>\n\n"
        f"Предмет: <b>{subject_name}</b>\n"
        f"Дата: <b>{target_date.strftime('%d.%m.%Y')}</b> ({day_name}) в <b>{lesson.time}</b>\n\n"
        f"Занятие отменено администратором."
    )

    # Telegram to teacher
    if lesson.teacher_id:
        teacher = (await db.execute(select(User).where(User.id == lesson.teacher_id))).scalar_one_or_none()
        if teacher and teacher.telegram_id:
            try:
                await bot.send_message(chat_id=teacher.telegram_id, text=msg_text, parse_mode="HTML")
            except Exception as e:
                logger.warning("Failed to send cancel notification to teacher %s: %s", lesson.teacher_id, e)

    # Announcement + Telegram to enrolled students + teacher
    enrolled = (await db.execute(select(LessonEnrollment.user_id).where(LessonEnrollment.lesson_id == lesson_id))).scalars().all()
    recipient_ids = list(enrolled)
    if lesson.teacher_id and lesson.teacher_id not in recipient_ids:
        recipient_ids.append(lesson.teacher_id)
    if recipient_ids:
        notification = Notification(sender_id=admin_id, title=f"Отмена: {subject_name}", message=msg_text, target_type="course")
        db.add(notification)
        await db.flush()
        for uid in recipient_ids:
            db.add(NotificationRecipient(notification_id=notification.id, user_id=uid))
        await db.commit()

        for uid in enrolled:
            student = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
            if student and student.telegram_id:
                try:
                    await bot.send_message(chat_id=student.telegram_id, text=msg_text, parse_mode="HTML")
                except Exception as e:
                    logger.warning("Failed to send cancel notification to student %s: %s", uid, e)

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
            subj = (await db.execute(select(Subject).where(Subject.id == cid, Subject.is_deleted == False))).scalar_one_or_none()
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

    # Link pre-uploaded attachments to this notification
    if data.attachment_ids:
        att_result = await db.execute(
            select(NotificationAttachment)
            .where(
                NotificationAttachment.id.in_(data.attachment_ids),
                NotificationAttachment.notification_id == 0,  # Only unlinked attachments
            )
        )
        for att in att_result.scalars().all():
            att.notification_id = notification.id
        await db.commit()

    # Load actual attachment objects for sending
    if data.attachment_ids:
        att_result = await db.execute(
            select(NotificationAttachment).where(
                NotificationAttachment.id.in_(data.attachment_ids),
                NotificationAttachment.notification_id == notification.id
            )
        )
        attachments = att_result.scalars().all()
    else:
        attachments = []

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
        caption = "\n".join(parts)

        # Collect media attachments
        media_attachments = [a for a in attachments if a.type in ('image', 'video')]
        other_attachments = [a for a in attachments if a.type not in ('image', 'video')]

        for tg_id in telegram_ids:
            try:
                if media_attachments:
                    # Send first media with caption
                    first = media_attachments[0]
                    if first.type == 'image':
                        await bot.send_photo(chat_id=tg_id, photo=first.url, caption=caption, parse_mode="HTML")
                    elif first.type == 'video':
                        await bot.send_video(chat_id=tg_id, video=first.url, caption=caption, parse_mode="HTML")

                    # Send remaining media without caption
                    for att in media_attachments[1:]:
                        try:
                            if att.type == 'image':
                                await bot.send_photo(chat_id=tg_id, photo=att.url)
                            elif att.type == 'video':
                                await bot.send_video(chat_id=tg_id, video=att.url)
                        except Exception as e:
                            logger.warning("Failed to send media to %s: %s", tg_id, e)
                else:
                    # No media — send text only
                    await bot.send_message(chat_id=tg_id, text=caption, parse_mode="HTML")

                # Send other file attachments as documents
                for att in other_attachments:
                    try:
                        await bot.send_document(chat_id=tg_id, document=att.url, caption=att.title)
                    except Exception as e:
                        logger.warning("Failed to send attachment to %s: %s", tg_id, e)

            except Exception as e:
                logger.warning("Failed to send announcement to %s: %s", tg_id, e)

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

    # Batch-load recipient counts for all notifications (fixes N+1)
    notif_ids = [n.id for n, _ in rows]
    recipient_counts: dict[int, int] = {}
    if notif_ids:
        counts_result = await db.execute(
            select(NotificationRecipient.notification_id, func.count())
            .where(NotificationRecipient.notification_id.in_(notif_ids))
            .group_by(NotificationRecipient.notification_id)
        )
        recipient_counts = dict(counts_result.all())

    # Batch-load referenced subjects and teachers (fixes N+1)
    subject_ids = {n.target_id for n, _ in rows if n.target_type == "course" and n.target_id}
    teacher_ids = {n.target_id for n, _ in rows if n.target_type == "teacher_courses" and n.target_id}
    subjects_map: dict[int, str] = {}
    teachers_map: dict[int, str] = {}
    if subject_ids:
        subj_result = await db.execute(select(Subject.id, Subject.name).where(Subject.id.in_(subject_ids), Subject.is_deleted == False))
        subjects_map = dict(subj_result.all())
    if teacher_ids:
        teacher_result = await db.execute(select(User.id, User.first_name).where(User.id.in_(teacher_ids)))
        teachers_map = dict(teacher_result.all())

    out = []
    for notif, sender in rows:
        recipient_count = recipient_counts.get(notif.id, 0)

        # Build detailed target_summary
        target_summary = TARGET_SUMMARY.get(notif.target_type, notif.target_type)
        if notif.target_type == "course" and notif.target_id:
            subj_name = subjects_map.get(notif.target_id)
            if subj_name:
                target_summary = f"Курс: {subj_name}"
        elif notif.target_type == "teacher_courses" and notif.target_id:
            teacher_name = teachers_map.get(notif.target_id)
            if teacher_name:
                target_summary = f"Курсы преподавателя: {teacher_name}"
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
        subj = (await db.execute(select(Subject).where(Subject.id == n.target_id, Subject.is_deleted == False))).scalar_one_or_none()
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
        select(Subject).where(Subject.is_archived == archived, Subject.is_deleted == False).order_by(Subject.name)
    )
    subjects = result.scalars().all()

    # Batch-load all lessons for all subjects in one query (fixes N+1)
    subject_ids = [s.id for s in subjects]
    lessons_by_subject: dict[int, list] = {}
    all_lesson_ids: list[int] = []
    if subject_ids:
        lesson_filters = [Lesson.subject_id.in_(subject_ids)]
        if not archived:
            lesson_filters.append(Lesson.is_active == True)
        lessons_result = await db.execute(
            select(Lesson).where(and_(*lesson_filters))
        )
        for lesson in lessons_result.scalars().all():
            lessons_by_subject.setdefault(lesson.subject_id, []).append(lesson)
            all_lesson_ids.append(lesson.id)

    # Batch-count unique students per subject in one query (fixes N+1)
    student_counts: dict[int, int] = {}
    if all_lesson_ids:
        counts_result = await db.execute(
            select(Lesson.subject_id, func.count(func.distinct(LessonEnrollment.user_id)))
            .join(LessonEnrollment, LessonEnrollment.lesson_id == Lesson.id)
            .where(Lesson.id.in_(all_lesson_ids))
            .group_by(Lesson.subject_id)
        )
        student_counts = dict(counts_result.all())

    teacher_ids = {
        lesson.teacher_id
        for lessons in lessons_by_subject.values()
        for lesson in lessons
        if lesson.teacher_id
    }
    teachers_map = await _load_teachers_map(db, teacher_ids)

    out = []
    for subj in subjects:
        lessons = lessons_by_subject.get(subj.id, [])
        teacher_names = list({
            _lesson_teacher_name(l, teachers_map)
            for l in lessons
            if _lesson_teacher_name(l, teachers_map)
        })

        out.append(AdminSubjectOut(
            id=subj.id,
            name=subj.name,
            description=subj.description,
            duration_minutes=subj.duration_minutes or 90,
            lesson_count=len(lessons),
            student_count=student_counts.get(subj.id, 0),
            teacher_names=teacher_names,
            is_archived=subj.is_archived or False,
            invite_code=subj.invite_code,
        ))

    return out


@router.post("/subjects", response_model=AdminSubjectDetailOut)
async def create_admin_subject(
    data: AdminSubjectCreate,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a course with lessons, teacher, and enrolled students."""
    if await _teacher_course_name_taken(db, data.name, data.teacher_id):
        raise HTTPException(status_code=400, detail="This teacher already has a course with this name")

    # Get teacher name if teacher_id provided
    teacher_name = ""
    if data.teacher_id:
        teacher = await db.execute(select(User).where(User.id == data.teacher_id))
        teacher = teacher.scalar_one_or_none()
        if not teacher:
            raise HTTPException(status_code=400, detail="Teacher not found")
        teacher_name = f"{teacher.first_name or ''} {teacher.last_name or ''}".strip()

    # Generate unique invite code
    alphabet = string.ascii_uppercase + string.digits
    invite_code = None
    for _ in range(10):  # Try 10 times max
        code = ''.join(secrets.choice(alphabet) for _ in range(6))
        exists = await db.execute(select(Subject).where(Subject.invite_code == code, Subject.is_deleted == False))
        if not exists.scalar_one_or_none():
            invite_code = code
            break
    if not invite_code:
        raise HTTPException(status_code=500, detail="Failed to generate unique invite code")

    # Create subject
    subject = Subject(
        name=data.name,
        description=data.description,
        duration_weeks=data.duration_weeks,
        duration_minutes=data.duration_minutes,
        invite_code=invite_code,
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
        # Batch verify all student IDs exist
        users_result = await db.execute(
            select(User).where(User.id.in_(data.student_ids))
        )
        valid_user_ids = {u.id for u in users_result.scalars().all()}

        for lesson in lessons:
            for user_id in data.student_ids:
                if user_id not in valid_user_ids:
                    continue
                enrollment = LessonEnrollment(
                    lesson_id=lesson.id,
                    user_id=user_id,
                )
                db.add(enrollment)
    await db.commit()

    invalidate_courses()
    invalidate_admin_stats()

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

    # Batch fetch all teacher availability to avoid N+1 queries
    teacher_ids = [t.id for t in all_teachers]
    if teacher_ids:
        avail_result = await db.execute(
            select(TeacherAvailability).where(
                TeacherAvailability.teacher_id.in_(teacher_ids),
                TeacherAvailability.is_active == True,
            )
        )
        avail_map: dict[int, list] = {}
        for a in avail_result.scalars().all():
            avail_map.setdefault(a.teacher_id, []).append(a)
    else:
        avail_map = {}

    matching = []
    for teacher in all_teachers:
        avail_slots = avail_map.get(teacher.id, [])

        # Check if teacher has availability for ALL schedule slots
        # Lesson must fit entirely: avail.start <= lesson.start AND avail.end >= lesson.end
        covers_all = True
        for slot in schedule:
            lesson_start = _normalize_hhmm(slot.time)
            if not lesson_start:
                covers_all = False
                break
            lesson_start_min = _time_to_minutes(lesson_start)
            lesson_end_min = lesson_start_min + slot.duration_minutes

            has_slot = any(
                a.day_of_week == slot.day_of_week
                and _time_to_minutes(a.start_time) <= lesson_start_min
                and _time_to_minutes(a.end_time) >= lesson_end_min
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
        select(Subject).where(Subject.id == subject_id, Subject.is_deleted == False)
    )).scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    lesson_filters = [Lesson.subject_id == subject_id]
    if not subject.is_archived:
        lesson_filters.append(Lesson.is_active == True)
    lessons_result = await db.execute(
        select(Lesson, Subject)
        .join(Subject, Lesson.subject_id == Subject.id)
        .where(and_(*lesson_filters))
        .order_by(Lesson.day_of_week, Lesson.time)
    )
    lessons = lessons_result.all()

    now = _get_tashkent_now()
    today = now.date()
    start_monday = today - timedelta(days=today.weekday())

    # Batch fetch lesson statuses and enrollment counts to avoid N+1 queries
    lesson_ids = [lesson.id for lesson, _ in lessons]

    if lesson_ids:
        # Batch fetch all lesson statuses
        status_result = await db.execute(
            select(LessonStatus).where(LessonStatus.lesson_id.in_(lesson_ids))
        )
        statuses_map = {s.lesson_id: s for s in status_result.scalars().all()}

        # Batch fetch all enrollment counts
        count_result = await db.execute(
            select(LessonEnrollment.lesson_id, func.count(LessonEnrollment.id))
            .where(LessonEnrollment.lesson_id.in_(lesson_ids))
            .group_by(LessonEnrollment.lesson_id)
        )
        enrollment_counts = {row[0]: row[1] for row in count_result.all()}
    else:
        statuses_map = {}
        enrollment_counts = {}

    teacher_ids = {lesson.teacher_id for lesson, _ in lessons if lesson.teacher_id}
    teachers_map = await _load_teachers_map(db, teacher_ids)

    admin_lessons = []
    for lesson, subj in lessons:
        instance_date = start_monday + timedelta(days=lesson.day_of_week)
        ls = statuses_map.get(lesson.id)
        status = ls.status if ls and ls.date == instance_date else None

        student_count = enrollment_counts.get(lesson.id, 0)

        end_time = _calculate_end_time(lesson.time, subj.duration_minutes or 90)

        admin_lessons.append(AdminLessonOut(
            id=lesson.id,
            subject_id=subj.id,
            subject_name=subj.name,
            teacher_name=_lesson_teacher_name(lesson, teachers_map),
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
        archived_at=subject.archived_at.strftime("%Y-%m-%d %H:%M:%S") if subject.archived_at else None,
        invite_code=subject.invite_code,
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


# ── Update Subject ────────────────────────────────────────────────────

@router.patch("/subjects/{subject_id}", response_model=AdminSubjectDetailOut)
async def update_admin_subject(
    subject_id: int,
    data: AdminSubjectUpdate,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update subject details (name, description, duration_weeks, etc.)."""
    result = await db.execute(select(Subject).where(Subject.id == subject_id, Subject.is_deleted == False))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Capture old name before update for Drive sync optimization
    old_name = subject.name

    update_data = data.model_dump(exclude_unset=True)
    new_name = update_data.get("name")
    if new_name is not None and new_name != subject.name:
        teacher_ids_result = await db.execute(
            select(Lesson.teacher_id)
            .where(
                Lesson.subject_id == subject_id,
                Lesson.is_active == True,
                Lesson.teacher_id.isnot(None),
            )
            .distinct()
        )
        for (teacher_id,) in teacher_ids_result.all():
            if await _teacher_course_name_taken(db, new_name, teacher_id, exclude_subject_id=subject_id):
                raise HTTPException(status_code=400, detail="This teacher already has a course with this name")

    for field, value in update_data.items():
        setattr(subject, field, value)

    admin_id = admin.id if hasattr(admin, "id") else None
    await _log_audit(db, "subject", subject_id, "update",
                     None, None, str(update_data), admin_id)
    await db.commit()
    await db.refresh(subject)
    await _sync_subject_drive_folder_after_update(db, subject_id, old_name=old_name)

    invalidate_courses()
    invalidate_admin_stats()

    # Return full subject detail (reuse get logic)
    lesson_filters = [Lesson.subject_id == subject_id]
    if not subject.is_archived:
        lesson_filters.append(Lesson.is_active == True)
    lessons_result = await db.execute(
        select(Lesson, Subject)
        .join(Subject, Lesson.subject_id == Subject.id)
        .where(and_(*lesson_filters))
        .order_by(Lesson.day_of_week, Lesson.time)
    )
    lessons = lessons_result.all()
    teacher_ids = {lesson.teacher_id for lesson, _ in lessons if lesson.teacher_id}
    teachers_map = await _load_teachers_map(db, teacher_ids)
    now = _get_tashkent_now()
    today = now.date()
    start_monday = today - timedelta(days=today.weekday())
    admin_lessons = []
    for lesson, subj in lessons:
        end_time = _calculate_end_time(lesson.time, subj.duration_minutes or 90)
        admin_lessons.append(AdminLessonOut(
            id=lesson.id,
            subject_id=subj.id,
            subject_name=subj.name,
            day_of_week=lesson.day_of_week,
            day_name=DAY_NAMES_SHORT_RU[lesson.day_of_week],
            time=lesson.time,
            end_time=end_time,
            room=lesson.room,
            location=lesson.location,
            teacher_name=_lesson_teacher_name(lesson, teachers_map),
            teacher_id=lesson.teacher_id,
            max_capacity=lesson.max_capacity,
            is_active=lesson.is_active,
            student_count=0,
            status=None,
        ))

    return AdminSubjectDetailOut(
        id=subject.id,
        name=subject.name,
        description=subject.description,
        duration_weeks=subject.duration_weeks,
        duration_minutes=subject.duration_minutes,
        start_date=subject.start_date.isoformat() if subject.start_date else None,
        is_archived=subject.is_archived,
        lessons=admin_lessons,
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
    subject.archived_at = _get_tashkent_now().replace(tzinfo=None)

    admin_id = admin.id if hasattr(admin, "id") else None
    await _log_audit(db, "subject", subject_id, "archive",
                     "is_archived", "false", "true", admin_id)
    await db.commit()

    invalidate_courses()
    invalidate_admin_stats()

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
    subject.archived_at = None

    admin_id = admin.id if hasattr(admin, "id") else None
    await _log_audit(db, "subject", subject_id, "unarchive",
                     "is_archived", "true", "false", admin_id)
    await db.commit()

    invalidate_courses()
    invalidate_admin_stats()

    return {"ok": True, "archived": False}


@router.delete("/subjects/{subject_id}")
async def delete_subject(
    subject_id: int,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete an archived course. Must be archived first."""
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    if subject.is_deleted:
        raise HTTPException(status_code=400, detail="Already deleted")
    if not subject.is_archived:
        raise HTTPException(status_code=400, detail="Archive the course before deleting")

    subject.is_deleted = True
    subject.deleted_at = utcnow()

    # Ensure all lessons are deactivated
    lessons_result = await db.execute(
        select(Lesson).where(Lesson.subject_id == subject_id)
    )
    for lesson in lessons_result.scalars().all():
        lesson.is_active = False

    admin_id = admin.id if hasattr(admin, "id") else None
    await _log_audit(db, "subject", subject_id, "delete",
                     "is_deleted", "false", "true", admin_id)
    await db.commit()

    invalidate_courses()
    invalidate_admin_stats()

    return {"ok": True}


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

    return await build_attendance_list(lesson_id, date, status_str, db)


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

    return await build_attendance_list(lesson_id, data.date, lesson_status.status, db)


# ── Create Lesson ────────────────────────────────────────────────────

@router.post("/subjects/{subject_id}/lessons", response_model=AdminLessonOut)
async def admin_create_lesson(
    subject_id: int,
    data: AdminLessonCreate,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: create a new lesson slot for a subject.

    If specific_date is provided, creates a one-time lesson for that date.
    If teacher_id is set and teacher has no open slot for that date/time,
    creates an availability request instead (teacher must approve).
    """
    subject = (await db.execute(select(Subject).where(Subject.id == subject_id, Subject.is_deleted == False))).scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    today = _get_tashkent_now().date()
    effective_from = subject.start_date.date() if subject.start_date else today

    # Compute day_of_week from specific_date if provided
    specific_date_obj = None
    computed_dow = data.day_of_week
    if data.specific_date:
        specific_date_obj = datetime.strptime(data.specific_date, "%Y-%m-%d").date()
        computed_dow = specific_date_obj.weekday()
    elif data.day_of_week is None:
        raise HTTPException(status_code=400, detail="Either specific_date or day_of_week is required")
    end_time = _calculate_end_time(data.time, subject.duration_minutes or 90)

    # For one-time lessons with a teacher, check if teacher has an open slot
    if specific_date_obj and data.teacher_id:
        from models import TeacherAvailability
        avail_result = await db.execute(
            select(TeacherAvailability).where(
                and_(
                    TeacherAvailability.teacher_id == data.teacher_id,
                    TeacherAvailability.is_active == True,
                    or_(
                        # Recurring slot matching day_of_week
                        and_(TeacherAvailability.specific_date.is_(None), TeacherAvailability.day_of_week == computed_dow),
                        # One-off slot matching exact date
                        TeacherAvailability.specific_date == specific_date_obj,
                    ),
                )
            )
        )
        slots = avail_result.scalars().all()
        has_slot = False
        for slot in slots:
            if _times_overlap(slot.start_time, slot.end_time, data.time, end_time):
                has_slot = True
                break

        if not has_slot:
            # No open slot → create availability request (teacher must approve)
            existing = (await db.execute(
                select(AvailabilityRequest).where(
                    and_(
                        AvailabilityRequest.teacher_id == data.teacher_id,
                        AvailabilityRequest.date == specific_date_obj,
                        AvailabilityRequest.start_time == data.time,
                        AvailabilityRequest.status == "pending",
                    )
                )
            )).scalar_one_or_none()
            if existing:
                raise HTTPException(status_code=400, detail="Запрос уже отправлен и ожидает ответа")

            admin_id = admin.id if hasattr(admin, 'id') else None
            # For availability request we need a lesson_id — create a temporary inactive lesson first
            temp_lesson = Lesson(
                subject_id=subject_id,
                teacher_id=data.teacher_id,
                teacher_name=data.teacher_name,
                day_of_week=computed_dow,
                specific_date=specific_date_obj,
                time=data.time,
                room=data.room,
                location=data.location,
                max_capacity=data.max_capacity,
                effective_from=effective_from,
                is_active=False,  # Inactive until teacher approves
            )
            db.add(temp_lesson)
            await db.flush()
            temp_lesson.slot_group_id = temp_lesson.id

            req = AvailabilityRequest(
                lesson_id=temp_lesson.id,
                teacher_id=data.teacher_id,
                requested_by=admin_id,
                original_date=specific_date_obj,
                date=specific_date_obj,
                start_time=data.time,
                end_time=end_time,
            )
            db.add(req)
            await db.commit()
            await db.refresh(req)

            # Send Telegram notification to teacher
            from bot.bot import bot
            from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
            from config import settings
            teacher = (await db.execute(select(User).where(User.id == data.teacher_id))).scalar_one_or_none()
            if teacher and teacher.telegram_id:
                day_name = DAY_NAMES_RU[specific_date_obj.weekday()]
                kb = InlineKeyboardMarkup(inline_keyboard=[
                    [
                        InlineKeyboardButton(text="✅ Согласовать", callback_data=f"avail_approve:{req.id}"),
                        InlineKeyboardButton(text="❌ Отклонить", callback_data=f"avail_reject:{req.id}"),
                    ],
                    [
                        InlineKeyboardButton(
                            text="📅 Открыть календарь",
                            web_app=WebAppInfo(url=f"{settings.WEBAPP_URL}/dashboard"),
                        ),
                    ],
                ])
                try:
                    await bot.send_message(
                        chat_id=teacher.telegram_id,
                        text=(
                            f"📅 <b>Запрос на открытие слота</b>\n\n"
                            f"Предмет: <b>{subject.name}</b>\n"
                            f"Дата: <b>{specific_date_obj.strftime('%d.%m.%Y')}</b> ({day_name})\n"
                            f"Время: <b>{data.time} — {end_time}</b>\n\n"
                            f"Админ просит открыть слот для нового занятия.\n"
                            f"Нажмите «Согласовать», чтобы открыть слот на это время."
                        ),
                        reply_markup=kb,
                        parse_mode="HTML",
                    )
                except Exception as e:
                    logger.warning("Failed to send availability request to teacher %s: %s", data.teacher_id, e)

            raise HTTPException(
                status_code=409,
                detail="У учителя нет открытого слота на это время. Запрос отправлен учителю."
            )

    # Create the lesson (either recurring or one-time)
    lesson = Lesson(
        subject_id=subject_id,
        teacher_id=data.teacher_id,
        teacher_name=data.teacher_name,
        day_of_week=computed_dow,
        specific_date=specific_date_obj,
        time=data.time,
        room=data.room,
        location=data.location,
        max_capacity=data.max_capacity,
        effective_from=effective_from,
    )
    db.add(lesson)
    await db.flush()
    lesson.slot_group_id = lesson.id

    admin_id = admin.id if hasattr(admin, 'id') else None
    date_label = specific_date_obj.strftime("%d.%m.%Y") if specific_date_obj else DAY_NAMES_SHORT_RU[computed_dow]
    await _log_audit(db, "lesson", lesson.id, "create", None, None,
                     f"{data.teacher_name} {date_label} {data.time}", admin_id)
    await db.commit()
    await db.refresh(lesson)
    await _sync_subject_drive_folder_after_update(db, subject_id)

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
        date=specific_date_obj.strftime("%Y-%m-%d") if specific_date_obj else "",
    )


# ── Update Lesson Schedule (future-only) ─────────────────────────────

@router.patch("/lessons/{lesson_id}/schedule", response_model=AdminLessonOut)
async def admin_update_lesson_schedule(
    lesson_id: int,
    data: AdminLessonScheduleUpdate,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update slot schedule/teacher; closes current version and opens a new one from effective_from."""
    lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id))).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    subject = (await db.execute(select(Subject).where(Subject.id == lesson.subject_id, Subject.is_deleted == False))).scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    today = _get_tashkent_now().date()
    if data.effective_from:
        try:
            effective_from = datetime.strptime(data.effective_from, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid effective_from date")
    else:
        effective_from = today

    if effective_from < today:
        raise HTTPException(status_code=400, detail="effective_from cannot be in the past")

    new_day = data.day_of_week if data.day_of_week is not None else lesson.day_of_week
    new_time = data.time if data.time is not None else lesson.time
    new_room = data.room if data.room is not None else lesson.room
    new_teacher_id = data.teacher_id if data.teacher_id is not None else lesson.teacher_id

    if data.teacher_name is not None:
        new_teacher_name = data.teacher_name.strip()
    elif data.teacher_id is not None:
        teacher = (await db.execute(select(User).where(User.id == data.teacher_id))).scalar_one_or_none()
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")
        new_teacher_name = f"{teacher.first_name or ''} {teacher.last_name or ''}".strip() or (teacher.username or "")
    else:
        new_teacher_name = lesson.teacher_name

    unchanged = (
        new_day == lesson.day_of_week
        and new_time == lesson.time
        and new_room == lesson.room
        and new_teacher_id == lesson.teacher_id
        and new_teacher_name == lesson.teacher_name
    )
    if unchanged:
        raise HTTPException(status_code=400, detail="No schedule changes provided")

    group_id = lesson.slot_group_id or lesson.id
    until = effective_from - timedelta(days=1)
    if lesson.effective_until is None or lesson.effective_until > until:
        lesson.effective_until = until
    lesson.is_active = False

    new_lesson = Lesson(
        subject_id=lesson.subject_id,
        teacher_id=new_teacher_id,
        teacher_name=new_teacher_name,
        day_of_week=new_day,
        time=new_time,
        room=new_room,
        location=lesson.location,
        max_capacity=lesson.max_capacity,
        lesson_plan=lesson.lesson_plan,
        custom_title=lesson.custom_title,
        is_active=True,
        effective_from=effective_from,
        slot_group_id=group_id,
    )
    db.add(new_lesson)
    await db.flush()

    enrollments = (await db.execute(
        select(LessonEnrollment).where(LessonEnrollment.lesson_id == lesson_id)
    )).scalars().all()
    for enr in enrollments:
        exists = await db.execute(
            select(LessonEnrollment).where(
                and_(LessonEnrollment.lesson_id == new_lesson.id, LessonEnrollment.user_id == enr.user_id)
            )
        )
        if not exists.scalar_one_or_none():
            db.add(LessonEnrollment(lesson_id=new_lesson.id, user_id=enr.user_id))

    admin_id = admin.id if hasattr(admin, "id") else None
    await _log_audit(
        db, "lesson", new_lesson.id, "schedule_update", None, None,
        f"{new_teacher_name} {DAY_NAMES_SHORT_RU[new_day]} {new_time} from {effective_from}", admin_id,
    )
    await db.commit()
    await db.refresh(new_lesson)
    await _sync_subject_drive_folder_after_update(db, subject.id)

    end_time = _calculate_end_time(new_lesson.time, subject.duration_minutes or 90)
    return AdminLessonOut(
        id=new_lesson.id,
        subject_id=subject.id,
        subject_name=subject.name,
        teacher_name=new_lesson.teacher_name,
        teacher_id=new_lesson.teacher_id,
        day_of_week=new_lesson.day_of_week,
        day_name=DAY_NAMES_SHORT_RU[new_lesson.day_of_week],
        time=new_lesson.time,
        end_time=end_time,
        room=new_lesson.room,
        student_count=len(enrollments),
        lesson_status=None,
        date=effective_from.strftime("%Y-%m-%d"),
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
    skip: int = Query(0, ge=0),
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
    query = query.order_by(AuditLog.performed_at.desc()).offset(skip).limit(limit)

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
