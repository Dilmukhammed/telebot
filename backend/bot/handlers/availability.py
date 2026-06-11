"""Bot handler for availability request approve/reject callbacks."""

import logging

from aiogram import Router, F
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy import select, and_

from database import get_dbCtx
from models import AvailabilityRequest, TeacherAvailability, User, Lesson, Subject, LessonStatus, LessonEnrollment, Notification, NotificationRecipient
from utils.time import _get_tashkent_now

logger = logging.getLogger(__name__)

router = Router()


@router.callback_query(F.data.startswith("avail_approve:"))
async def handle_avail_approve(callback: CallbackQuery):
    """Teacher approves availability request via Telegram — creates slot and reschedules lesson."""
    try:
        request_id = int(callback.data.split(":")[1])
    except (IndexError, ValueError):
        await callback.answer("Ошибка", show_alert=True)
        return

    try:
        async with get_dbCtx() as db:
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

            # Reschedule the lesson: mark original date as rescheduled → new date
            original_date = req.original_date
            existing_status = (await db.execute(
                select(LessonStatus).where(
                    and_(LessonStatus.lesson_id == req.lesson_id, LessonStatus.date == original_date)
                )
            )).scalar_one_or_none()

            if existing_status:
                existing_status.status = "rescheduled"
                existing_status.override_date = req.date
                existing_status.override_time = req.start_time
                existing_status.note = f"Перенесено на {req.date.strftime('%d.%m.%Y')}"
                existing_status.marked_by = teacher.id
                existing_status.marked_at = _get_tashkent_now()
            else:
                ls = LessonStatus(
                    lesson_id=req.lesson_id,
                    date=original_date,
                    status="rescheduled",
                    override_date=req.date,
                    override_time=req.start_time,
                    note=f"Перенесено на {req.date.strftime('%d.%m.%Y')}",
                    marked_by=teacher.id,
                )
                db.add(ls)

            req.status = "approved"
            req.resolved_at = _get_tashkent_now()
            await db.commit()

            # Get subject and lesson for notifications
            lesson = (await db.execute(
                select(Lesson).where(Lesson.id == req.lesson_id)
            )).scalar_one_or_none()
            subject_name = ""
            if lesson:
                subject = (await db.execute(
                    select(Subject).where(Subject.id == lesson.subject_id)
                )).scalar_one_or_none()
                subject_name = subject.name if subject else ""

            # Build notification message
            from utils.constants import DAY_NAMES_RU
            orig_day = DAY_NAMES_RU[original_date.weekday()]
            new_day = DAY_NAMES_RU[req.date.weekday()]
            msg_text = (
                f"📅 <b>Перенос занятия</b>\n\n"
                f"Предмет: <b>{subject_name}</b>\n"
                f"Было: <b>{original_date.strftime('%d.%m.%Y')}</b> ({orig_day}) в <b>{lesson.time if lesson else ''}</b>\n"
                f"Стало: <b>{req.date.strftime('%d.%m.%Y')}</b> ({new_day}) в <b>{req.start_time}</b>"
            )

            # Create announcement for enrolled students
            if lesson:
                enrolled = (await db.execute(
                    select(LessonEnrollment.user_id).where(LessonEnrollment.lesson_id == req.lesson_id)
                )).scalars().all()
                if enrolled:
                    notification = Notification(
                        sender_id=None,
                        title=f"Перенос: {subject_name}",
                        message=msg_text,
                        target_type="course",
                    )
                    db.add(notification)
                    await db.flush()
                    for uid in enrolled:
                        db.add(NotificationRecipient(notification_id=notification.id, user_id=uid))
                    await db.commit()

                    # Telegram to enrolled students
                    for uid in enrolled:
                        student = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
                        if student and student.telegram_id:
                            try:
                                await callback.bot.send_message(chat_id=student.telegram_id, text=msg_text, parse_mode="HTML")
                            except Exception as e:
                                logger.warning("Failed to send reschedule notification to student %s: %s", uid, e)

        # Update message after context manager closes (session committed)
        await callback.message.edit_text(
            f"✅ <b>Слот открыт, урок перенесён</b>\n\n"
            f"Предмет: <b>{subject_name}</b>\n"
            f"Было: <b>{original_date.strftime('%d.%m.%Y')}</b>\n"
            f"Стало: <b>{req.date.strftime('%d.%m.%Y')}</b> в <b>{req.start_time}</b>\n\n"
            f"Урок автоматически перенесён на новое время.",
            parse_mode="HTML",
        )
        await callback.answer("Слот открыт, урок перенесён ✅")
    except Exception as e:
        logger.error("avail_approve handler error: %s", e, exc_info=True)
        await callback.answer("Произошла ошибка", show_alert=True)


@router.callback_query(F.data.startswith("avail_reject:"))
async def handle_avail_reject(callback: CallbackQuery):
    """Teacher rejects availability request via Telegram."""
    try:
        request_id = int(callback.data.split(":")[1])
    except (IndexError, ValueError):
        await callback.answer("Ошибка", show_alert=True)
        return

    try:
        async with get_dbCtx() as db:
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
            f"Дата: <b>{req.date.strftime('%d.%m.%Y')}</b>\n"
            f"Время: <b>{req.start_time} — {req.end_time}</b>",
            parse_mode="HTML",
        )
        await callback.answer("Запрос отклонён")
    except Exception as e:
        logger.error("avail_reject handler error: %s", e, exc_info=True)
        await callback.answer("Произошла ошибка", show_alert=True)
