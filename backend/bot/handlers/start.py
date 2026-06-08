from aiogram import Router
from aiogram.filters import Command
from aiogram.types import (
    Message,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    ReplyKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardRemove,
)
from sqlalchemy import select

from config import settings
from database import get_dbCtx
from models import User

router = Router()


def _get_webapp_keyboard():
    webapp_btn = InlineKeyboardButton(
        text="📱 Открыть приложение",
        web_app=WebAppInfo(url=settings.WEBAPP_URL),
    )
    return InlineKeyboardMarkup(inline_keyboard=[[webapp_btn]])


def _get_phone_keyboard():
    phone_btn = KeyboardButton(
        text="📱 Поделиться номером телефона",
        request_contact=True,
    )
    return ReplyKeyboardMarkup(
        keyboard=[[phone_btn]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


@router.message(Command("start"))
async def cmd_start(message: Message):
    import html
    name = html.escape(message.from_user.first_name) if message.from_user and message.from_user.first_name else "друг"
    kb = _get_webapp_keyboard()
    await message.answer(
        f"👋 Привет, {name}!\n\n"
        "Нажми кнопку ниже, чтобы войти в приложение.",
        reply_markup=kb,
    )


@router.message(lambda m: m.web_app_data is not None)
async def handle_web_app_data(message: Message):
    data = message.web_app_data.data if message.web_app_data else ""

    if data == "request_phone":
        await message.answer(
            "📱 Поделись номером телефона для регистрации:",
            reply_markup=_get_phone_keyboard(),
        )
    else:
        await message.answer("Открой приложение:", reply_markup=_get_webapp_keyboard())


@router.message(lambda m: m.contact is not None)
async def handle_contact(message: Message):
    contact = message.contact
    if not contact:
        return

    telegram_id = contact.user_id
    phone = contact.phone_number
    first_name = contact.first_name
    last_name = contact.last_name

    async with get_dbCtx() as db:
        result = await db.execute(select(User).where(User.telegram_id == telegram_id))
        user = result.scalar_one_or_none()

        if user:
            user.phone = phone
            if first_name:
                user.first_name = first_name
            if last_name:
                user.last_name = last_name
        else:
            user = User(
                telegram_id=telegram_id,
                phone=phone,
                first_name=first_name,
                last_name=last_name,
            )
            db.add(user)

        await db.commit()

    kb = _get_webapp_keyboard()

    await message.answer(
        "✅ Номер сохранён!\n\nНажми кнопку ниже, чтобы вернуться в приложение.",
        reply_markup=ReplyKeyboardRemove(),
    )
    await message.answer("📱 Войти в ZuhraMath", reply_markup=kb)