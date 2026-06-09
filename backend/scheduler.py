import datetime as dt

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import and_, select

from bot.bot import bot
from database import async_session_maker
from models import Registration, Subject, Test, Lesson, LessonEnrollment, User, LessonStatus


scheduler = AsyncIOScheduler()


def get_now():
    """Get current time in Tashkent (UTC+5) as a naive datetime."""
    tashkent_tz = dt.timezone(dt.timedelta(hours=5))
    return dt.datetime.now(tashkent_tz).replace(tzinfo=None)


async def send_reminders():
    """Find tests starting in ~1 hour and send reminders to registered students."""
    now = get_now()
    window_start = now + dt.timedelta(minutes=45)
    window_end = now + dt.timedelta(minutes=75)

    async with async_session_maker() as session:
        # Find tests starting between 45-75 minutes from now (pending tests)
        tests_stmt = select(Test).where(
            and_(
                Test.datetime >= window_start,
                Test.datetime <= window_end,
                Test.is_active == True,
            )
        )
        tests_result = await session.execute(tests_stmt)
        tests = tests_result.scalars().all()

        for test in tests:
            # Get active registrations where reminder hasn't been sent
            reg_stmt = select(Registration).where(
                and_(
                    Registration.test_id == test.id,
                    Registration.reminder_sent == False,
                    Registration.status == "registered",
                )
            )
            reg_result = await session.execute(reg_stmt)
            registrations = reg_result.scalars().all()

            if not registrations:
                continue

            # Get subject name
            subject_result = await session.execute(
                select(Subject).where(Subject.id == test.subject_id)
            )
            subject = subject_result.scalar_one_or_none()
            import html
            subject_name = html.escape(subject.name) if subject else "предмет"

            # Format time for message
            test_time = test.datetime.strftime("%H:%M")

            for reg in registrations:
                # Send reminder message
                message = f"🔔 Напоминание: тест по {subject_name} начнётся через 1 час ({test_time})"
                try:
                     await bot.send_message(chat_id=reg.telegram_id, text=message)
                except Exception:
                     pass  # Skip failed sends (user blocked bot, etc.)

                # Mark reminder as sent
                reg.reminder_sent = True

            await session.commit()


async def send_lesson_reminders():
    """Find lessons starting in ~1 hour and send reminders to enrolled students."""
    now = get_now()
    current_weekday = now.weekday()  # 0=Mon, 6=Sun
    current_time = now.time()

    # Window: lessons starting in 45-75 minutes
    window_start = (now + dt.timedelta(minutes=45)).time()
    window_end = (now + dt.timedelta(minutes=75)).time()

    print(f"[Scheduler] send_lesson_reminders called at {now.strftime('%H:%M')}, weekday={current_weekday}, window={window_start}-{window_end}")

    async with async_session_maker() as session:
        # Get all active lessons
        lessons_stmt = select(Lesson).where(Lesson.is_active == True)
        lessons_result = await session.execute(lessons_stmt)
        lessons = lessons_result.scalars().all()

        for lesson in lessons:
            # Check if lesson is today
            if lesson.day_of_week != current_weekday:
                continue

            # Parse lesson time
            try:
                lesson_hour, lesson_minute = map(int, lesson.time.split(":"))
                lesson_time = dt.time(lesson_hour, lesson_minute)
            except (ValueError, AttributeError):
                continue

            # Check if lesson is within the reminder window
            if not (window_start <= lesson_time <= window_end):
                continue

            # Get enrollments where reminder hasn't been sent
            enrollments_stmt = (
                select(LessonEnrollment)
                .join(User, User.id == LessonEnrollment.user_id)
                .where(
                    and_(
                        LessonEnrollment.lesson_id == lesson.id,
                        LessonEnrollment.reminder_sent == False,
                    )
                )
            )
            enrollments_result = await session.execute(enrollments_stmt)
            enrollments = enrollments_result.scalars().all()

            if not enrollments:
                continue

            # Get subject name
            subject_result = await session.execute(
                select(Subject).where(Subject.id == lesson.subject_id)
            )
            subject = subject_result.scalar_one_or_none()
            import html
            subject_name = html.escape(subject.name) if subject else "занятие"

            # Get teacher name
            teacher_name = "Преподаватель"
            if lesson.teacher_id:
                teacher_result = await session.execute(
                    select(User).where(User.id == lesson.teacher_id)
                )
                teacher = teacher_result.scalar_one_or_none()
                if teacher:
                    teacher_name = teacher.first_name or (f"@{teacher.username}" if teacher.username else "Преподаватель")

            for enrollment in enrollments:
                # Get user
                user_result = await session.execute(
                    select(User).where(User.id == enrollment.user_id)
                )
                user = user_result.scalar_one_or_none()
                if not user:
                    continue

                # Greeting based on time of day
                hour = int(lesson.time.split(":")[0])
                if hour < 12:
                    greeting = "Доброе утро"
                elif hour < 17:
                    greeting = "Добрый день"
                else:
                    greeting = "Добрый вечер"

                # Send reminder
                message = (
                    f"{greeting}, {user.first_name or 'друг'}! 👋\n\n"
                    f"Через 1 час занятие:\n\n"
                    f"📖 {subject_name}\n"
                    f"👨‍🏫 {teacher_name}\n"
                    f"🕐 {lesson.time}\n"
                    f"🚪 {lesson.room}\n\n"
                    f"Увидимся на занятии! 💪"
                )
                try:
                    await bot.send_message(chat_id=user.telegram_id, text=message)
                except Exception:
                    pass  # Skip failed sends

                # Mark reminder as sent
                enrollment.reminder_sent = True

            await session.commit()


async def reset_lesson_reminders():
    """Reset reminder_sent flags for lessons that have passed."""
    now = get_now()
    current_weekday = now.weekday()
    current_time = now.time()

    async with async_session_maker() as session:
        # Get all active lessons
        lessons_stmt = select(Lesson).where(Lesson.is_active == True)
        lessons_result = await session.execute(lessons_stmt)
        lessons = lessons_result.scalars().all()

        for lesson in lessons:
            # Only reset for lessons that happened today and have passed
            if lesson.day_of_week != current_weekday:
                continue

            try:
                lesson_hour, lesson_minute = map(int, lesson.time.split(":"))
                lesson_time = dt.time(lesson_hour, lesson_minute)
            except (ValueError, AttributeError):
                continue

            # If lesson time has passed, reset reminders
            if lesson_time < current_time:
                enrollments_stmt = select(LessonEnrollment).where(
                    and_(
                        LessonEnrollment.lesson_id == lesson.id,
                        LessonEnrollment.reminder_sent == True,
                    )
                )
                enrollments_result = await session.execute(enrollments_stmt)
                enrollments = enrollments_result.scalars().all()

                for enrollment in enrollments:
                    enrollment.reminder_sent = False

        await session.commit()


# In-memory set to avoid re-sending prompts within same server run
_sent_prompts: set[tuple[int, str]] = set()

def _cleanup_sent_prompts():
    """Remove entries older than 2 days to prevent memory leak."""
    now = get_now()
    cutoff = (now - dt.timedelta(days=2)).strftime("%Y-%m-%d")
    stale = {k for k in _sent_prompts if k[1] < cutoff}
    _sent_prompts.difference_update(stale)


async def send_lesson_status_prompt():
    """After a lesson ends, prompt the teacher to mark status (happened/cancelled)."""
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

    _cleanup_sent_prompts()
    now = get_now()
    current_weekday = now.weekday()
    today_str = now.strftime("%Y-%m-%d")

    async with async_session_maker() as session:
        # Get all active lessons with subjects
        lessons_result = await session.execute(
            select(Lesson, Subject)
            .join(Subject, Subject.id == Lesson.subject_id)
            .where(Lesson.is_active == True)
        )
        lessons = lessons_result.all()

        for lesson, subject in lessons:
            if lesson.day_of_week != current_weekday:
                continue

            # Parse lesson start time
            try:
                lh, lm = map(int, lesson.time.split(":"))
                lesson_start = now.replace(hour=lh, minute=lm, second=0, microsecond=0)
            except (ValueError, AttributeError):
                continue

            duration = subject.duration_minutes or 90
            lesson_end = lesson_start + dt.timedelta(minutes=duration)

            # Check if lesson ended 15-45 minutes ago
            time_since_end = now - lesson_end
            if not (dt.timedelta(minutes=15) <= time_since_end <= dt.timedelta(minutes=45)):
                continue

            # Check if already prompted this session
            if (lesson.id, today_str) in _sent_prompts:
                continue

            # Check if status already marked
            today_date = now.date()
            status_result = await session.execute(
                select(LessonStatus).where(
                    and_(LessonStatus.lesson_id == lesson.id, LessonStatus.date == today_date)
                )
            )
            if status_result.scalar_one_or_none():
                continue

            # Get teacher
            if not lesson.teacher_id:
                continue
            teacher_result = await session.execute(
                select(User).where(User.id == lesson.teacher_id)
            )
            teacher = teacher_result.scalar_one_or_none()
            if not teacher:
                continue

            subject_name = subject.name or "занятие"
            kb = InlineKeyboardMarkup(inline_keyboard=[
                [
                    InlineKeyboardButton(text="Проведено", callback_data=f"lesson_happened:{lesson.id}:{today_str}"),
                    InlineKeyboardButton(text="Отменено", callback_data=f"lesson_cancelled:{lesson.id}:{today_str}"),
                ]
            ])
            try:
                await bot.send_message(
                    chat_id=teacher.telegram_id,
                    text=f"Занятие по <b>{subject_name}</b> завершено.\nПроведено или отменено?",
                    reply_markup=kb,
                )
                _sent_prompts.add((lesson.id, today_str))
            except Exception:
                pass


def start_scheduler():
    """Start the APScheduler."""
    scheduler.add_job(send_reminders, "interval", minutes=15, id="send_reminders")
    scheduler.add_job(send_lesson_reminders, "interval", minutes=15, id="send_lesson_reminders")
    scheduler.add_job(reset_lesson_reminders, "interval", hours=1, id="reset_lesson_reminders")
    scheduler.add_job(send_lesson_status_prompt, "interval", minutes=10, id="send_lesson_status_prompt")
    scheduler.start()
    jobs = scheduler.get_jobs()
    for j in jobs:
        print(f"[Scheduler] Job registered: {j.id}, next_run={j.next_run_time}")


def stop_scheduler():
    """Shutdown the APScheduler."""
    scheduler.shutdown()
