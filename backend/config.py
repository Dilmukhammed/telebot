from pydantic_settings import BaseSettings
import os
import logging

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    BOT_TOKEN: str
    DATABASE_URL: str = "postgresql+asyncpg://localhost:5432/app"
    ADMIN_JWT_SECRET: str = "change-me"
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

if settings.ADMIN_JWT_SECRET == "change-me":
    logger.warning("ADMIN_JWT_SECRET is using default value! Set a strong secret in .env")