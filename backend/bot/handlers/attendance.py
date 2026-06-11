import datetime as dt

from aiogram import Router, F
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy import select, and_, func

from database import get_dbCtx
from models import Lesson, LessonEnrollment, User, Attendance, LessonStatus, Subject
from utils.time import _get_tashkent_now

router = Router()


async def _is_lesson_teacher(db, lesson_id: int, telegram_id: int) -> bool:
    """Check if the telegram user is the teacher of this lesson."""
    lesson_result = await db.execute(
        select(Lesson).where(Lesson.id == lesson_id)
    )
    lesson = lesson_result.scalar_one_or_none()
    if not lesson or not lesson.teacher_id:
        return False
    # Get the teacher's telegram_id
    teacher_result = await db.execute(
        select(User.telegram_id).where(User.id == lesson.teacher_id)
    )
    teacher_tg_id = teacher_result.scalar_one_or_none()
    return teacher_tg_id == telegram_id


async def _build_student_keyboard(lesson_id: int, date_str: str, db) -> InlineKeyboardMarkup:
    """Build inline keyboard with student attendance toggles."""
    # Get enrolled students
    enrollments_result = await db.execute(
        select(User)
        .join(LessonEnrollment, LessonEnrollment.user_id == User.id)
        .where(LessonEnrollment.lesson_id == lesson_id)
        .order_by(User.first_name)
    )
    students = enrollments_result.scalars().all()

    # Get attendance records
    lesson_date = dt.datetime.strptime(date_str, "%Y-%m-%d").date()
    att_result = await db.execute(
        select(Attendance).where(
            and_(Attendance.lesson_id == lesson_id, Attendance.date == lesson_date)
        )
    )
    att_map = {att.user_id: att for att in att_result.scalars().all()}

    rows = []
    for student in students:
        att = att_map.get(student.id)
        is_present = att.present if att else False
        icon = "+" if is_present else "-"
        name = student.first_name or (f"@{student.username}" if student.username else f"#{student.id}")
        btn = InlineKeyboardButton(
            text=f"{icon} {name}",
            callback_data=f"att_toggle:{lesson_id}:{student.id}:{date_str}",
        )
        rows.append([btn])

    # Done button
    rows.append([
        InlineKeyboardButton(
            text="Готово",
            callback_data=f"att_done:{lesson_id}:{date_str}",
        )
    ])

    return InlineKeyboardMarkup(inline_keyboard=rows)


@router.callback_query(F.data.startswith("lesson_happened:"))
async def handle_lesson_happened(callback: CallbackQuery):
    """Teacher confirms lesson happened."""
    parts = callback.data.split(":")
    try:
        lesson_id = int(parts[1])
        date_str = parts[2]
    except (IndexError, ValueError):
        await callback.answer("Ошибка данных", show_alert=True)
        return

    try:
        async with get_dbCtx() as db:
            # Authorization check
            if not await _is_lesson_teacher(db, lesson_id, callback.from_user.id):
                await callback.answer("Нет прав", show_alert=True)
                return

            # Verify lesson exists
            lesson_result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
            lesson = lesson_result.scalar_one_or_none()
            if not lesson:
                await callback.answer("Занятие не найдено", show_alert=True)
                return

            # Create or update LessonStatus
            lesson_date = dt.datetime.strptime(date_str, "%Y-%m-%d").date()
            existing_result = await db.execute(
                select(LessonStatus).where(
                    and_(LessonStatus.lesson_id == lesson_id, LessonStatus.date == lesson_date)
                )
            )
            existing = existing_result.scalar_one_or_none()

            if existing:
                existing.status = "happened"
                existing.marked_at = _get_tashkent_now()
            else:
                ls = LessonStatus(
                    lesson_id=lesson_id,
                    date=lesson_date,
                    status="happened",
                    marked_by=callback.from_user.id,
                )
                db.add(ls)

            await db.commit()

            # Get subject name
            subject_result = await db.execute(select(Subject).where(Subject.id == lesson.subject_id))
            subject = subject_result.scalar_one_or_none()
            subject_name = subject.name if subject else "занятие"

            # Build student keyboard
            kb = await _build_student_keyboard(lesson_id, date_str, db)

        await callback.message.edit_text(
            f"Занятие по <b>{subject_name}</b> проведено.\n\n"
            "Отметьте посещаемость (+ присутствует, - отсутствует):",
            reply_markup=kb,
        )
        await callback.answer()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("lesson_happened handler error: %s", e, exc_info=True)
        await callback.answer("Произошла ошибка", show_alert=True)


@router.callback_query(F.data.startswith("lesson_cancelled:"))
async def handle_lesson_cancelled(callback: CallbackQuery):
    """Teacher marks lesson as cancelled."""
    parts = callback.data.split(":")
    try:
        lesson_id = int(parts[1])
        date_str = parts[2]
    except (IndexError, ValueError):
        await callback.answer("Ошибка данных", show_alert=True)
        return

    try:
        async with get_dbCtx() as db:
            # Authorization check
            if not await _is_lesson_teacher(db, lesson_id, callback.from_user.id):
                await callback.answer("Нет прав", show_alert=True)
                return

            # Verify lesson exists
            lesson_result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
            lesson = lesson_result.scalar_one_or_none()
            if not lesson:
                await callback.answer("Занятие не найдено", show_alert=True)
                return

            lesson_date = dt.datetime.strptime(date_str, "%Y-%m-%d").date()

            # Create or update LessonStatus
            existing_result = await db.execute(
                select(LessonStatus).where(
                    and_(LessonStatus.lesson_id == lesson_id, LessonStatus.date == lesson_date)
                )
            )
            existing = existing_result.scalar_one_or_none()

            if existing:
                existing.status = "cancelled"
                existing.marked_at = _get_tashkent_now()
            else:
                ls = LessonStatus(
                    lesson_id=lesson_id,
                    date=lesson_date,
                    status="cancelled",
                    marked_by=callback.from_user.id,
                )
                db.add(ls)

            # Delete attendance records
            att_result = await db.execute(
                select(Attendance).where(
                    and_(Attendance.lesson_id == lesson_id, Attendance.date == lesson_date)
                )
            )
            for att in att_result.scalars().all():
                await db.delete(att)

            await db.commit()

        await callback.message.edit_text("Занятие отменено.")
        await callback.answer()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("lesson_cancelled handler error: %s", e, exc_info=True)
        await callback.answer("Произошла ошибка", show_alert=True)


@router.callback_query(F.data.startswith("att_toggle:"))
async def handle_att_toggle(callback: CallbackQuery):
    """Toggle a student's attendance."""
    parts = callback.data.split(":")
    lesson_id = int(parts[1])
    user_id = int(parts[2])
    date_str = parts[3]

    async with get_dbCtx() as db:
        # Authorization check
        if not await _is_lesson_teacher(db, lesson_id, callback.from_user.id):
            await callback.answer("Нет прав", show_alert=True)
            return

        lesson_date = dt.datetime.strptime(date_str, "%Y-%m-%d").date()

        # Upsert attendance
        att_result = await db.execute(
            select(Attendance).where(
                and_(
                    Attendance.lesson_id == lesson_id,
                    Attendance.user_id == user_id,
                    Attendance.date == lesson_date,
                )
            )
        )
        att = att_result.scalar_one_or_none()

        if att:
            att.present = not att.present
            att.marked_at = _get_tashkent_now()
        else:
            att = Attendance(
                lesson_id=lesson_id,
                user_id=user_id,
                date=lesson_date,
                present=True,
                marked_by=callback.from_user.id,
            )
            db.add(att)

        await db.commit()

        # Rebuild keyboard
        kb = await _build_student_keyboard(lesson_id, date_str, db)

    await callback.message.edit_reply_markup(reply_markup=kb)
    await callback.answer()


@router.callback_query(F.data.startswith("att_done:"))
async def handle_att_done(callback: CallbackQuery):
    """Teacher finishes attendance marking."""
    parts = callback.data.split(":")
    lesson_id = int(parts[1])
    date_str = parts[2]

    async with get_dbCtx() as db:
        # Authorization check
        if not await _is_lesson_teacher(db, lesson_id, callback.from_user.id):
            await callback.answer("Нет прав", show_alert=True)
            return

        lesson_date = dt.datetime.strptime(date_str, "%Y-%m-%d").date()

        # Count present/total
        enrollments_result = await db.execute(
            select(func.count(LessonEnrollment.id))
            .where(LessonEnrollment.lesson_id == lesson_id)
        )
        total = enrollments_result.scalar() or 0

        att_result = await db.execute(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.lesson_id == lesson_id,
                    Attendance.date == lesson_date,
                    Attendance.present == True,
                )
            )
        )
        present_count = att_result.scalar() or 0

    await callback.message.edit_text(
        f"Посещаемость отмечена.\n"
        f"Присутствовали: <b>{present_count}</b> из <b>{total}</b>"
    )
    await callback.answer()
