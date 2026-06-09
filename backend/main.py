from contextlib import asynccontextmanager
import asyncio
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text

from database import engine, Base
from api.router import api_router
from bot.bot import bot_router, bot, dp
from scheduler import start_scheduler, stop_scheduler
from seed import seed as seed_db


class CacheControlMiddleware(BaseHTTPMiddleware):
    """Add Cache-Control headers to GET responses for browser caching."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if request.method == "GET" and response.status_code == 200:
            path = request.url.path

            # Rarely-changing data — cache longer
            if path.startswith("/api/courses") or path.startswith("/api/tests"):
                response.headers["Cache-Control"] = "private, max-age=60"
            # Dashboard — short cache
            elif path.startswith("/api/dashboard"):
                response.headers["Cache-Control"] = "private, max-age=15"
            # Admin data — no caching
            elif path.startswith("/api/admin"):
                response.headers["Cache-Control"] = "private, no-cache"
            # Teacher data — moderate cache
            elif path.startswith("/api/teacher"):
                response.headers["Cache-Control"] = "private, max-age=30"
            # User data — short cache
            elif path.startswith("/api/users"):
                response.headers["Cache-Control"] = "private, max-age=15"
            # Everything else — moderate
            else:
                response.headers["Cache-Control"] = "private, max-age=30"

        return response

cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
debug = os.environ.get("DEBUG", "false").lower() in ("true", "1", "yes")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: optionally wipe DB, create tables, seed admin/teacher
    reset_db = os.environ.get("RESET_DB", "false").lower() in ("true", "1", "yes")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Migrate telegram_id from int32 to int64 (Telegram IDs exceed int32 range)
        if "postgresql" in str(engine.url):
            for table_name in ("users", "registrations", "admins"):
                try:
                    await conn.execute(text(
                        f'ALTER TABLE "{table_name}" ALTER COLUMN telegram_id TYPE BIGINT'
                    ))
                except Exception:
                    pass  # Already BIGINT or table doesn't exist yet

            # Add is_archived column to subjects if missing
            try:
                await conn.execute(text(
                    "ALTER TABLE subjects ADD COLUMN is_archived BOOLEAN DEFAULT FALSE"
                ))
            except Exception:
                pass  # Column already exists

            # Create indexes for frequently filtered columns
            for idx_name, table, col in [
                ("ix_lessons_is_active", "lessons", "is_active"),
                ("ix_tests_is_active", "tests", "is_active"),
                ("ix_subjects_is_archived", "subjects", "is_archived"),
            ]:
                try:
                    await conn.execute(text(
                        f'CREATE INDEX IF NOT EXISTS {idx_name} ON "{table}" ("{col}")'
                    ))
                except Exception:
                    pass

        if reset_db:
            print("[startup] RESET_DB=true — wiping all tables...")
            for table in reversed(Base.metadata.sorted_tables):
                await conn.execute(text(f'DELETE FROM "{table.name}"'))
            print("[startup] All tables cleared.")

    await seed_db()
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

# Cache-Control middleware for browser caching
app.add_middleware(CacheControlMiddleware)

# Include API routes
app.include_router(api_router, prefix="/api")

# Include bot webhook route
app.include_router(bot_router)
