from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import Update
from fastapi import APIRouter

from config import settings
from bot.handlers.start import router as start_router
from bot.handlers.admin import router as admin_router
from bot.handlers.attendance import router as attendance_router

# Direct Telegram API (no proxy)
bot = Bot(
    token=settings.BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML),
)
dp = Dispatcher()
dp.include_router(start_router)
dp.include_router(admin_router)
dp.include_router(attendance_router)

bot_router = APIRouter(prefix="/bot", tags=["bot"])


@bot_router.post("/webhook")
async def bot_webhook(update: dict):
    telegram_update = Update(**update)
    await dp.feed_update(bot, telegram_update)
    return {"status": "ok"}


@bot_router.get("/webhook-info")
async def webhook_info():
    webhook = await bot.get_webhook_info()
    return {"url": webhook.url, "pending_update_count": webhook.pending_update_count}


async def setup_webhook():
    await bot.set_webhook(url=settings.WEBHOOK_URL)