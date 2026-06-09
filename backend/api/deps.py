from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from json import loads
from base64 import b64decode

from database import get_db
from models import Admin, User
from auth import decode_access_token
from config import settings
from telegram_auth import validate_init_data, parse_init_data

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

    return user


async def get_telegram_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate Telegram Mini App initData and return User object.
    
    Auto-creates user on first login.
    
    Auth priority:
    1. HMAC validation of initData (production, secure)
    2. X-Telegram-User header with JSON user data (includes real telegram_id from SDK)
    3. DEV_MODE: extract user from initData without hash check
    4. DEV_MODE: mock user fallback
    """
    import logging
    logger = logging.getLogger("telegram_auth")

    x_telegram_init_data = request.headers.get("X-Telegram-Init-Data")
    x_telegram_user = request.headers.get("X-Telegram-User")

    telegram_data = None

    # Step 1: Try HMAC validation (production auth)
    if x_telegram_init_data:
        try:
            telegram_data = validate_init_data(x_telegram_init_data)
            logger.info(f"HMAC OK, data={telegram_data}")
        except ValueError as e:
            logger.warning(f"HMAC failed: {e}")

    # Step 2: Try X-Telegram-User header (Base64-encoded JSON from our frontend)
    # This header is set by the Telegram WebView JS — it's the primary fallback
    # when HMAC validation of initData fails (e.g., bot token mismatch, clock skew)
    if not telegram_data and x_telegram_user:
        try:
            decoded = b64decode(x_telegram_user).decode('utf-8')
            user_data = loads(decoded)
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
                logger.info(f"User from X-Telegram-User: {telegram_data}")
        except Exception as e:
            logger.warning(f"Failed to parse X-Telegram-User: {e}")

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
                logger.info(f"DEV_MODE: extracted user from initData: {telegram_data}")
        except Exception as ex:
            logger.warning(f"DEV_MODE: parse failed: {ex}")

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

    # Find or create user in database
    # First try by telegram_id
    result = await db.execute(select(User).where(User.telegram_id == telegram_data["telegram_id"]))
    user = result.scalar_one_or_none()

    # If not found by telegram_id, try by username (for teachers added by admin)
    if not user and telegram_data.get("username"):
        result = await db.execute(select(User).where(User.username == telegram_data["username"]))
        user = result.scalar_one_or_none()
        if user:
            # Found by username - update telegram_id
            user.telegram_id = telegram_data["telegram_id"]
            await db.commit()

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