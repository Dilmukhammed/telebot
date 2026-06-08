from contextlib import asynccontextmanager
import asyncio
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from api.router import api_router
from bot.bot import bot_router, bot, dp
from scheduler import start_scheduler, stop_scheduler

cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
debug = os.environ.get("DEBUG", "false").lower() in ("true", "1", "yes")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Start reminder scheduler
    start_scheduler()
    # Start bot polling in background (non-blocking)
    async def start_bot():
        try:
            await bot.delete_webhook(drop_pending_updates=True)
            await dp.start_polling(bot)
        except Exception as e:
            print(f"Bot polling error: {e}")

    bot_task = asyncio.create_task(start_bot())
    print("Backend started, bot connecting in background...")
    yield
    # Shutdown
    bot_task.cancel()
    try:
        await bot_task
    except asyncio.CancelledError:
        pass
    stop_scheduler()
    await engine.dispose()


app = FastAPI(title="EduCenter API", version="1.0.0", lifespan=lifespan, debug=debug)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")

# Include bot webhook route
app.include_router(bot_router)
