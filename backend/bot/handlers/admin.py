from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy import func, select
from datetime import datetime, timezone

from database import get_dbCtx
from models import Admin, Registration, Test, Subject

router = Router()


async def is_admin(telegram_id: int) -> bool:
    """Check if telegram_id is in Admin model (async)."""
    async with get_dbCtx() as db:
        result = await db.execute(select(Admin).where(Admin.telegram_id == telegram_id))
        return result.scalar_one_or_none() is not None


@router.message(Command("admin"))
async def cmd_admin(message: Message):
    """Check if user is admin."""
    if not message.from_user:
        await message.answer("Не удалось определить пользователя")
        return

    if await is_admin(message.from_user.id):
        await message.answer("✅ Вы являетесь администратором")
    else:
        await message.answer("У вас нет прав администратора")


@router.message(Command("list"))
async def cmd_list(message: Message):
    """Show active tests (upcoming, is_active=True)."""
    if not message.from_user:
        await message.answer("Не удалось определить пользователя")
        return

    if not await is_admin(message.from_user.id):
        await message.answer("У вас нет прав администратора")
        return

    async with get_dbCtx() as db:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        result = await db.execute(
            select(Test)
            .where(Test.is_active == True)
            .where(Test.datetime >= now)
            .order_by(Test.datetime)
        )
        tests = result.scalars().all()

        if not tests:
            await message.answer("Нет активных тестов")
            return

        lines = ["📋 Активные тесты:\n"]
        for t in tests:
            subject_result = await db.execute(select(Subject).where(Subject.id == t.subject_id))
            subject = subject_result.scalar_one_or_none()
            subject_name = subject.name if subject else "Неизвестно"
            lines.append(
                f"• {subject_name} | {t.datetime.strftime('%d.%m.%Y %H:%M')} | "
                f"{t.format} | Вместимость: {t.max_capacity}"
            )

        await message.answer("\n".join(lines))


@router.message(Command("stats"))
async def cmd_stats(message: Message):
    """Show stats: total tests, total registrations, unique students."""
    if not message.from_user:
        await message.answer("Не удалось определить пользователя")
        return

    if not await is_admin(message.from_user.id):
        await message.answer("У вас нет прав администратора")
        return

    async with get_dbCtx() as db:
        total_tests_result = await db.execute(select(func.count(Test.id)))
        total_tests = total_tests_result.scalar()

        total_regs_result = await db.execute(select(func.count(Registration.id)))
        total_regs = total_regs_result.scalar()

        unique_students_result = await db.execute(select(func.count(func.distinct(Registration.telegram_id))))
        unique_students = unique_students_result.scalar()

        await message.answer(
            "📊 Статистика:\n"
            f"• Всего тестов: {total_tests}\n"
            f"• Всего регистраций: {total_regs}\n"
            f"• Уникальных студентов: {unique_students}"
        )