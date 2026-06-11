import logging

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from json import loads

from database import get_db
from models import Admin, User
from auth import decode_access_token
from config import settings
from telegram_auth import validate_init_data, parse_init_data

logger = logging.getLogger("telegram_auth")
security = HTTPBearer()


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """Validate JWT token and return current admin (Admin or User with role=admin)."""
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        username = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Try Admin table first (backward compatibility)
    result = await db.execute(select(Admin).where(Admin.username == username))
    admin = result.scalar_one_or_none()

    if admin:
        return admin

    # Try User table with admin role (telegram_id stored as string in sub)
    try:
        telegram_id = int(username)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Admin not found")

    result = await db.execute(select(User).where(User.telegram_id == telegram_id, User.role == "admin"))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Admin not found")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    return user


async def get_telegram_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate Telegram Mini App initData and return User object.

    Auto-creates user on first login.

    Auth priority:
    1. HMAC validation of initData (production, secure)
    2. DEV_MODE: extract user from initData without hash check
    3. DEV_MODE: mock user fallback
    """
    x_telegram_init_data = request.headers.get("X-Telegram-Init-Data")

    telegram_data = None

    # Step 1: Try HMAC validation (production auth)
    if x_telegram_init_data:
        try:
            telegram_data = validate_init_data(x_telegram_init_data)
            logger.debug("HMAC OK, telegram_id=%s", telegram_data.get("telegram_id"))
        except ValueError as e:
            logger.warning("HMAC validation failed: %s", e)

    # Step 2: X-Telegram-User header — REMOVED for security
    # This header had no cryptographic signature and allowed any attacker to
    # impersonate any user by crafting a Base64 JSON blob.

    # Step 3: DEV_MODE - try to extract user from initData without hash
    if not telegram_data and settings.DEV_MODE and x_telegram_init_data:
        try:
            vals = parse_init_data(x_telegram_init_data)
            from urllib.parse import unquote
            user_json = unquote(vals.get("user", "{}"))
            user_data = loads(user_json)
            if user_data.get("id"):
                telegram_data = {
                    "telegram_id": user_data["id"],
                    "username": user_data.get("username"),
                    "first_name": user_data.get("first_name"),
                    "last_name": user_data.get("last_name"),
                    "language_code": user_data.get("language_code", "ru"),
                    "is_premium": user_data.get("is_premium", False),
                    "photo_url": user_data.get("photo_url"),
                }
                logger.info("DEV_MODE: extracted user from initData")
        except Exception as ex:
            logger.warning("DEV_MODE: parse failed: %s", ex)

    # Step 4: DEV_MODE - mock user
    if not telegram_data and settings.DEV_MODE:
        logger.warning("DEV_MODE: no auth data, using mock user")
        telegram_data = {
            "telegram_id": 123456789,
            "username": "dev_user",
            "first_name": "Dev",
            "last_name": None,
            "language_code": "ru",
            "is_premium": False,
            "photo_url": None,
        }

    if not telegram_data:
        raise HTTPException(status_code=401, detail="Missing init data")

    # Find or create user in database by telegram_id only
    result = await db.execute(select(User).where(User.telegram_id == telegram_data["telegram_id"]))
    user = result.scalar_one_or_none()

    # Username-based account linking removed — it allowed account takeover
    # when two users shared the same Telegram @username.

    if not user:
        user = User(
            telegram_id=telegram_data["telegram_id"],
            username=telegram_data.get("username"),
            first_name=telegram_data.get("first_name"),
            last_name=telegram_data.get("last_name"),
            language_code=telegram_data.get("language_code", "ru"),
            is_premium=telegram_data.get("is_premium", False),
            photo_url=telegram_data.get("photo_url"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update user info from Telegram on each login
        # Don't overwrite first_name/last_name for existing users (they set it themselves or admin set it)
        if telegram_data.get("photo_url"):
            user.photo_url = telegram_data.get("photo_url")
        if telegram_data.get("username"):
            user.username = telegram_data.get("username")
        await db.commit()

    return user


async def require_teacher(
    user: User = Depends(get_telegram_user),
) -> User:
    """Ensure the authenticated user has teacher or admin role."""
    if user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teacher or admin access required")
    return user


async def require_admin(
    user: User = Depends(get_telegram_user),
) -> User:
    """Ensure the authenticated user has admin role and is active."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    return user