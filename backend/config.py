from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    BOT_TOKEN: str
    DATABASE_URL: str = "sqlite+aiosqlite:///./app.db"
    ADMIN_JWT_SECRET: str = "change-me"
    WEBHOOK_URL: str = ""
    WEBAPP_URL: str = ""
    DEV_MODE: bool = False
    PORT: int = 8000

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()