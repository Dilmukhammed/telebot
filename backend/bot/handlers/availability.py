"""Bot handler for availability request approve/reject callbacks."""

from aiogram import Router, F
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy import select, and_

from database import get_dbCtx
from models import AvailabilityRequest, TeacherAvailability, User, Lesson, Subject
from utils.time import _get_tashkent_now

router = Router()


@router.callback_query(F.data.startswith("avail_approve:"))
async def handle_avail_approve(callback: CallbackQuery):
    """Teacher approves availability request via Telegram."""
    try:
        request_id = int(callback.data.split(":")[1])
    except (IndexError, ValueError):
        await callback.answer("Ошибка", show_alert=True)
        return

    db = get_dbCtx()
    # Verify teacher
    teacher_result = await db.execute(
        select(User).where(User.telegram_id == callback.from_user.id)
    )
    teacher = teacher_result.scalar_one_or_none()
    if not teacher:
        await callback.answer("Не авторизован", show_alert=True)
        return

    req = (await db.execute(
        select(AvailabilityRequest).where(
            and_(
                AvailabilityRequest.id == request_id,
                AvailabilityRequest.teacher_id == teacher.id,
                AvailabilityRequest.status == "pending",
            )
        )
    )).scalar_one_or_none()

    if not req:
        await callback.answer("Запрос не найден или уже обработан", show_alert=True)
        return

    # Create one-off availability slot
    new_slot = TeacherAvailability(
        teacher_id=teacher.id,
        day_of_week=req.date.weekday(),
        start_time=req.start_time,
        end_time=req.end_time,
        specific_date=req.date,
        is_active=True,
    )
    db.add(new_slot)

    req.status = "approved"
    req.resolved_at = _get_tashkent_now()
    await db.commit()

    # Get subject name for confirmation
    lesson = (await db.execute(
        select(Lesson).where(Lesson.id == req.lesson_id)
    )).scalar_one_or_none()
    subject_name = ""
    if lesson:
        subject = (await db.execute(
            select(Subject).where(Subject.id == lesson.subject_id)
        )).scalar_one_or_none()
        subject_name = subject.name if subject else ""

    # Update message
    await callback.message.edit_text(
        f"✅ <b>Слот открыт</b>\n\n"
        f"Предмет: <b>{subject_name}</b>\n"
        f"Дата: <b>{req.date.strftime('%Y-%m-%d')}</b>\n"
        f"Время: <b>{req.start_time} — {req.end_time}</b>\n\n"
        f"Админ может перенести урок на это время.",
        parse_mode="HTML",
    )
    await callback.answer("Слот открыт ✅")


@router.callback_query(F.data.startswith("avail_reject:"))
async def handle_avail_reject(callback: CallbackQuery):
    """Teacher rejects availability request via Telegram."""
    try:
        request_id = int(callback.data.split(":")[1])
    except (IndexError, ValueError):
        await callback.answer("Ошибка", show_alert=True)
        return

    db = get_dbCtx()
    teacher_result = await db.execute(
        select(User).where(User.telegram_id == callback.from_user.id)
    )
    teacher = teacher_result.scalar_one_or_none()
    if not teacher:
        await callback.answer("Не авторизован", show_alert=True)
        return

    req = (await db.execute(
        select(AvailabilityRequest).where(
            and_(
                AvailabilityRequest.id == request_id,
                AvailabilityRequest.teacher_id == teacher.id,
                AvailabilityRequest.status == "pending",
            )
        )
    )).scalar_one_or_none()

    if not req:
        await callback.answer("Запрос не найден или уже обработан", show_alert=True)
        return

    req.status = "rejected"
    req.resolved_at = _get_tashkent_now()
    await db.commit()

    lesson = (await db.execute(
        select(Lesson).where(Lesson.id == req.lesson_id)
    )).scalar_one_or_none()
    subject_name = ""
    if lesson:
        subject = (await db.execute(
            select(Subject).where(Subject.id == lesson.subject_id)
        )).scalar_one_or_none()
        subject_name = subject.name if subject else ""

    await callback.message.edit_text(
        f"❌ <b>Запрос отклонён</b>\n\n"
        f"Предмет: <b>{subject_name}</b>\n"
        f"Дата: <b>{req.date.strftime('%Y-%m-%d')}</b>\n"
        f"Время: <b>{req.start_time} — {req.end_time}</b>",
        parse_mode="HTML",
    )
    await callback.answer("Запрос отклонён")
