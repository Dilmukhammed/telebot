import hashlib
import sys

from pydantic_settings import BaseSettings
import logging

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    BOT_TOKEN: str
    DATABASE_URL: str = "postgresql+asyncpg://localhost:5432/app"
    ADMIN_JWT_SECRET: str = ""
    WEBHOOK_URL: str = ""
    WEBAPP_URL: str = ""
    DEV_MODE: bool = False
    PORT: int = 8000
    GOOGLE_SERVICE_ACCOUNT_KEY_PATH: str = ""  # Path to service account JSON key (local dev)
    GOOGLE_SERVICE_ACCOUNT_JSON: str = ""  # Service account JSON as string (Railway/production)
    GOOGLE_DRIVE_FOLDER_ID: str = ""  # Google Drive folder ID for uploads
    GOOGLE_OAUTH_CLIENT_ID: str = ""  # OAuth2 client ID (for personal Drive)
    GOOGLE_OAUTH_CLIENT_SECRET: str = ""  # OAuth2 client secret
    GOOGLE_OAUTH_REFRESH_TOKEN: str = ""  # OAuth2 refresh token (one-time via get_refresh_token.py)

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()

if len(settings.ADMIN_JWT_SECRET) < 32 and not settings.DEV_MODE:
    if settings.BOT_TOKEN:
        # Railway/deploy convenience: BOT_TOKEN is always required and long enough
        secret_len = len(settings.ADMIN_JWT_SECRET)
        settings.ADMIN_JWT_SECRET = hashlib.sha256(
            f"admin-jwt-v1:{settings.BOT_TOKEN}".encode()
        ).hexdigest()
        logger.warning(
            "ADMIN_JWT_SECRET not set or too short (%d chars); using value derived from BOT_TOKEN. "
            "Set ADMIN_JWT_SECRET explicitly (min 32 chars) for independent rotation.",
            secret_len,
        )
    else:
        logger.error(
            "ADMIN_JWT_SECRET is not set or too short (< 32 chars) and BOT_TOKEN is missing. "
            "Set ADMIN_JWT_SECRET in Railway Variables (min 32 chars)."
        )
        sys.exit(1)