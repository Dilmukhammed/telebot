import logging
from html import escape

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timedelta

from database import get_db
from models import Subject, Lesson, User, LessonStatus, LessonEnrollment, EnrollmentRequest, Material
from schemas import CourseOut, CourseDetailOut, CourseLessonOut, LessonDetailOut, MaterialOut, LessonAgendaItemOut, LessonHomeworkOut, JoinCourseIn, EnrollmentRequestOut
from api.deps import get_telegram_user

router = APIRouter(prefix="/courses", tags=["courses"])
logger = logging.getLogger(__name__)

DAY_NAMES_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
DAY_NAMES_SHORT_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


def _calculate_end_time(start_time: str, duration_minutes: int = 90) -> str:
    try:
        h, m = map(int, start_time.split(":"))
        total = h * 60 + m + duration_minutes
        return f"{total // 60:02d}:{total % 60:02d}"
    except Exception:
        return ""


def _get_tashkent_now():
    import datetime as _dt
    tashkent_tz = _dt.timezone(_dt.timedelta(hours=5))
    return _dt.datetime.now(tashkent_tz).replace(tzinfo=None)


def _get_next_date(day_of_week: int) -> datetime:
    """Get next date for a given day of week (0=Mon)."""
    today = _get_tashkent_now()
    days_ahead = day_of_week - today.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return today + timedelta(days=days_ahead)


@router.get("", response_model=list[CourseOut])
async def list_courses(
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """Get courses. Students see only enrolled courses, teachers/admins see all."""
    if user.role == "student":
        # Student: only enrolled, non-archived courses
        result = await db.execute(
            select(Subject)
            .join(Lesson, Lesson.subject_id == Subject.id)
            .join(LessonEnrollment, LessonEnrollment.lesson_id == Lesson.id)
            .where(Lesson.is_active == True, LessonEnrollment.user_id == user.id, Subject.is_archived == False, Subject.is_deleted == False)
            .distinct()
            .order_by(Subject.name)
        )
    else:
        # Teacher/admin: see all active, non-archived courses
        result = await db.execute(
            select(Subject)
            .join(Lesson, Lesson.subject_id == Subject.id)
            .where(Lesson.is_active == True, Subject.is_archived == False, Subject.is_deleted == False)
            .distinct()
            .order_by(Subject.name)
        )

    subjects = result.scalars().all()

    # Batch-load all lessons for all subjects in one query (fixes N+1)
    subject_ids = [s.id for s in subjects]
    all_lessons: dict[int, list] = {}
    if subject_ids:
        lessons_result = await db.execute(
            select(Lesson)
            .where(Lesson.subject_id.in_(subject_ids), Lesson.is_active == True)
            .order_by(Lesson.subject_id, Lesson.day_of_week, Lesson.time)
        )
        for lesson in lessons_result.scalars().all():
            all_lessons.setdefault(lesson.subject_id, []).append(lesson)

    courses = []
    for subject in subjects:
        lessons = all_lessons.get(subject.id, [])
        first_lesson = lessons[0] if lessons else None

        courses.append(CourseOut(
            id=subject.id,
            name=subject.name,
            teacher_name=first_lesson.teacher_name if first_lesson else "",
            lesson_count=len(lessons),
        ))

    return courses


@router.get("/lessons/{lesson_id}", response_model=LessonDetailOut)
async def get_lesson_detail(
    lesson_id: int,
    date: str = None,  # Optional date parameter for recurring lessons
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed lesson information."""
    # Get lesson
    from lesson_schedule import resolve_lesson_for_date

    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Get subject
    subject_result = await db.execute(select(Subject).where(Subject.id == lesson.subject_id, Subject.is_deleted == False))
    subject = subject_result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Get teacher info if available
    teacher_photo_url = None
    teacher_title = None
    teacher_username = None
    if lesson.teacher_id:
        teacher_result = await db.execute(select(User).where(User.id == lesson.teacher_id))
        teacher = teacher_result.scalar_one_or_none()
        if teacher:
            teacher_photo_url = teacher.photo_url
            teacher_username = teacher.username

    # Calculate end time
    end_time = _calculate_end_time(lesson.time, subject.duration_minutes or 90)

    # Calculate date and status
    today = _get_tashkent_now().date()
    if date:
        try:
            lesson_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            lesson_date = _get_next_date(lesson.day_of_week).date()
    else:
        lesson_date = _get_next_date(lesson.day_of_week).date()

    resolved = await resolve_lesson_for_date(db, lesson_id, lesson_date)
    if resolved:
        lesson = resolved

    if lesson_date == today:
        current_time_str = _get_tashkent_now().strftime("%H:%M")
        if current_time_str > end_time:
            status = "past"
        else:
            status = "today"
    elif lesson_date > today:
        status = "upcoming"
    else:
        status = "past"

    # Generate title based on lesson number
    if lesson.custom_title:
        title = lesson.custom_title
    else:
        # Calculate lesson number: count weeks from course start
        if subject.start_date:
            course_start = subject.start_date.date()
            # Find the first occurrence of this weekday on or after course start
            days_until = (lesson.day_of_week - course_start.weekday()) % 7
            first_lesson_date = course_start + timedelta(days=days_until)
            if lesson_date >= first_lesson_date:
                lesson_number = ((lesson_date - first_lesson_date).days // 7) + 1
            else:
                lesson_number = 1
        else:
            lesson_number = 1
        title = f"Занятие {lesson_number}"

    # Fetch real materials for this lesson
    materials_result = await db.execute(
        select(Material).where(Material.lesson_id == lesson_id).order_by(Material.created_at.desc())
    )
    materials = [
        MaterialOut(
            id=m.id, title=m.title, type=m.type, url=m.url,
            content=m.content, file_name=m.file_name, file_size=m.file_size,
            created_by=m.created_by, created_at=m.created_at.isoformat() if m.created_at else "",
        )
        for m in materials_result.scalars().all()
    ]

    # Parse lesson plan from DB (JSON field)
    import json
    agenda = []
    if lesson.lesson_plan:
        try:
            plan_items = json.loads(lesson.lesson_plan)
            agenda = [
                LessonAgendaItemOut(id=i + 1, title=item.get("title", ""), description=item.get("description"))
                for i, item in enumerate(plan_items)
            ]
        except (json.JSONDecodeError, TypeError):
            agenda = []

    # Homework placeholder (no homework system implemented yet)
    homework = None

    # Query lesson status for this instance
    lesson_status_str = None
    ls_result = await db.execute(
        select(LessonStatus).where(
            and_(LessonStatus.lesson_id == lesson_id, LessonStatus.date == lesson_date)
        )
    )
    ls = ls_result.scalar_one_or_none()
    if ls:
        lesson_status_str = ls.status

    is_teacher = user.role in ("teacher", "admin") and (user.id == lesson.teacher_id or user.role == "admin")

    return LessonDetailOut(
        id=lesson.id,
        subject_id=subject.id,
        subject_name=subject.name,
        title=title,
        teacher_name=lesson.teacher_name,
        teacher_username=teacher_username,
        teacher_title=teacher_title,
        teacher_photo_url=teacher_photo_url,
        day_of_week=lesson.day_of_week,
        day_name=DAY_NAMES_SHORT_RU[lesson.day_of_week],
        time=lesson.time,
        end_time=end_time,
        room=lesson.room,
        location=lesson.location,
        date=lesson_date.strftime("%Y-%m-%d"),
        status=status,
        duration_minutes=subject.duration_minutes or 90,
        materials=materials,
        agenda=agenda,
        homework=homework,
        lesson_status=lesson_status_str,
        is_teacher=is_teacher,
        custom_title=lesson.custom_title,
    )


@router.get("/{course_id}", response_model=CourseDetailOut)
async def get_course_detail(
    course_id: int,
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """Get course detail with lessons grouped by status."""
    # Get subject
    result = await db.execute(select(Subject).where(Subject.id == course_id, Subject.is_deleted == False))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Course not found")

    from lesson_schedule import generate_instances_for_course

    # All slot versions (active + historical) for correct past/future display
    lessons_result = await db.execute(
        select(Lesson)
        .where(Lesson.subject_id == course_id)
        .order_by(Lesson.day_of_week, Lesson.time)
    )
    lessons = lessons_result.scalars().all()
    today = _get_tashkent_now().date()
    active_slots = [
        l for l in lessons
        if l.is_active and (l.effective_until is None or l.effective_until >= today)
    ]

    # Determine the range of weeks to generate
    course_start = subject.start_date.date() if subject.start_date else None
    course_end = None
    if course_start and subject.duration_weeks:
        course_end = course_start + timedelta(weeks=subject.duration_weeks)

    # Start from course_start (or today if not set)
    effective_start = course_start if course_start else today
    # Find the Monday of the week containing effective_start
    start_monday = effective_start - timedelta(days=effective_start.weekday())

    # Generate enough weeks to cover up to course_end (or today + 4 weeks if no end)
    if course_end:
        weeks_needed = ((course_end - start_monday).days + 6) // 7
        weeks_needed = max(weeks_needed, 1)
    else:
        # Generate from start_monday up to today + 4 weeks
        weeks_needed = ((today + timedelta(weeks=4) - start_monday).days + 6) // 7
        weeks_needed = max(weeks_needed, 4)

    course_lessons = generate_instances_for_course(
        lessons=lessons,
        start_monday=start_monday,
        weeks_needed=weeks_needed,
        course_start=course_start,
        course_end=course_end,
        today=today,
        duration_minutes=subject.duration_minutes or 90,
        calculate_end_time=_calculate_end_time,
        day_names_short=DAY_NAMES_SHORT_RU,
        course_lesson_out_cls=CourseLessonOut,
    )

    teacher_name = active_slots[0].teacher_name if active_slots else ""
    location = active_slots[0].location if active_slots else None

    return CourseDetailOut(
        id=subject.id,
        name=subject.name,
        teacher_name=teacher_name,
        description=subject.description or "",
        location=location,
        lesson_count=len(active_slots),
        duration_weeks=subject.duration_weeks,
        duration_minutes=subject.duration_minutes or 90,
        start_date=subject.start_date.strftime("%Y-%m-%d") if subject.start_date else None,
        invite_code=subject.invite_code,
        lessons=course_lessons,
    )


@router.post("/join")
async def join_course(
    data: JoinCourseIn,
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """Student joins a course using invite code. Creates pending enrollment request."""
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can join courses")

    # Find subject by invite code
    result = await db.execute(
        select(Subject).where(Subject.invite_code == data.invite_code.upper(), Subject.is_deleted == False)
    )
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    if subject.is_archived:
        raise HTTPException(status_code=400, detail="This course is archived")

    # Check if already enrolled in any lesson of this subject
    lessons_result = await db.execute(
        select(Lesson.id).where(Lesson.subject_id == subject.id, Lesson.is_active == True)
    )
    lesson_ids = [row[0] for row in lessons_result.all()]
    if lesson_ids:
        existing_enrollment = await db.execute(
            select(LessonEnrollment).where(
                and_(
                    LessonEnrollment.lesson_id.in_(lesson_ids),
                    LessonEnrollment.user_id == user.id
                )
            )
        )
        if existing_enrollment.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="You are already enrolled in this course")

    # Check if already has a pending request
    existing_request = await db.execute(
        select(EnrollmentRequest).where(
            and_(
                EnrollmentRequest.subject_id == subject.id,
                EnrollmentRequest.user_id == user.id,
                EnrollmentRequest.status == "pending"
            )
        )
    )
    if existing_request.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a pending request for this course")

    # Create enrollment request
    enrollment_request = EnrollmentRequest(
        subject_id=subject.id,
        user_id=user.id,
        status="pending",
    )
    db.add(enrollment_request)
    await db.commit()

    await _notify_teachers_enrollment_request(db, subject, user)

    return {"message": "Request sent successfully", "subject_name": subject.name}


async def _notify_teachers_enrollment_request(db: AsyncSession, subject: Subject, student: User) -> None:
    """Send Telegram chat notification to teachers of the course."""
    from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
    from bot.bot import bot
    from config import settings

    teachers_result = await db.execute(
        select(User.telegram_id)
        .join(Lesson, Lesson.teacher_id == User.id)
        .where(
            and_(
                Lesson.subject_id == subject.id,
                Lesson.is_active == True,
                Lesson.teacher_id.isnot(None),
                User.telegram_id.isnot(None),
            )
        )
        .distinct()
    )
    telegram_ids = [row[0] for row in teachers_result.all()]
    if not telegram_ids:
        return

    student_name = escape(student.first_name or (f"@{student.username}" if student.username else "Ученик"))
    student_line = student_name
    if student.username:
        student_line += f" (@{escape(student.username)})"
    if student.grade:
        student_line += f", {escape(student.grade)} класс"

    text = (
        "📝 <b>Новая заявка на курс</b>\n\n"
        f"Курс: <b>{escape(subject.name)}</b>\n"
        f"Ученик: {student_line}\n\n"
        "Откройте приложение, чтобы одобрить или отклонить заявку."
    )

    reply_markup = None
    if settings.WEBAPP_URL:
        webapp_url = settings.WEBAPP_URL.strip().rstrip("/") + "/dashboard"
        reply_markup = InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text="Открыть приложение", web_app=WebAppInfo(url=webapp_url))]]
        )

    for tg_id in telegram_ids:
        try:
            await bot.send_message(
                chat_id=tg_id,
                text=text,
                parse_mode="HTML",
                reply_markup=reply_markup,
            )
        except Exception as e:
            logger.warning("Failed to notify teacher %s about enrollment request: %s", tg_id, e)