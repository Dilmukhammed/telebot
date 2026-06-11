from contextlib import asynccontextmanager
import asyncio
import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text

from database import engine, Base
from config import settings
from api.router import api_router
from bot.bot import bot_router, bot, dp
from scheduler import start_scheduler, stop_scheduler
from seed import seed as seed_db
from migrations import run_migrations, ensure_critical_schema

startup_logger = logging.getLogger("startup")


def _build_cors_origins() -> list[str]:
    """Merge CORS_ORIGINS env with WEBAPP_URL so mini-app can call the API."""
    origins: list[str] = []
    cors_origins_str = os.environ.get("CORS_ORIGINS", "")
    if cors_origins_str:
        origins.extend(
            o.strip().rstrip("/")
            for o in cors_origins_str.split(",")
            if o.strip()
        )
    if settings.WEBAPP_URL:
        webapp = settings.WEBAPP_URL.strip().rstrip("/")
        if webapp and webapp not in origins:
            origins.append(webapp)
    if not origins:
        origins = ["http://localhost:5173", "http://localhost:3000"]
    return origins


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

cors_origins = _build_cors_origins()
debug = os.environ.get("DEBUG", "false").lower() in ("true", "1", "yes")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: optionally wipe DB, create tables, seed admin/teacher
    reset_db = os.environ.get("RESET_DB", "false").lower() in ("true", "1", "yes")

    async with engine.begin() as conn:
        # Wipe FIRST if requested, before creating tables or running migrations
        if reset_db:
            print("[startup] RESET_DB=true — wiping all tables...")
            for table in reversed(Base.metadata.sorted_tables):
                await conn.execute(text(f'DELETE FROM "{table.name}"'))
            print("[startup] All tables cleared.")

        await conn.run_sync(Base.metadata.create_all)

    dialect = engine.dialect.name

    async with engine.begin() as conn:
        await ensure_critical_schema(conn, dialect)

    try:
        async with engine.connect() as conn:
            conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
            await run_migrations(conn, dialect)
    except Exception as exc:
        startup_logger.exception("Schema migration error (non-fatal): %s", exc)

    async with engine.begin() as conn:
        await ensure_critical_schema(conn, dialect)

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
    print(f"[startup] CORS allowed origins: {cors_origins}")
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

# CORS — WEBAPP_URL + CORS_ORIGINS; also allow Vercel preview/production hosts
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://[\w.-]+\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache-Control middleware for browser caching
app.add_middleware(CacheControlMiddleware)

# Include API routes
app.include_router(api_router, prefix="/api")

# Include bot webhook route
app.include_router(bot_router)
