"""Production seed — creates admin if they don't exist.

Idempotent: safe to run on every startup.
No demo data, no hardcoded lessons/subjects.
Teachers and students are created through the admin panel / Telegram.
"""

import asyncio
from sqlalchemy import select
from database import engine, Base, async_session_maker
from models import User, Admin


ADMIN_USERNAME = "gi_rocke"
ADMIN_PASSWORD = "admin"
ADMIN_TELEGRAM_ID = -1  # placeholder, updated on first Telegram login


async def seed():
    """Seed admin. Runs on every startup — skips if exists."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        # --- Admin in JWT table (for /admin panel login) ---
        result = await session.execute(
            select(Admin).where(Admin.username == ADMIN_USERNAME)
        )
        admin = result.scalar_one_or_none()

        if not admin:
            from auth import hash_password
            admin = Admin(
                username=ADMIN_USERNAME,
                password_hash=hash_password(ADMIN_PASSWORD),
                telegram_id=ADMIN_TELEGRAM_ID,
            )
            session.add(admin)
            print(f"  [seed] Admin '{ADMIN_USERNAME}' created (admins table)")
        else:
            print(f"  [seed] Admin '{ADMIN_USERNAME}' exists (admins table, id={admin.id})")

        # --- Admin in users table (for Telegram Mini App) ---
        result = await session.execute(
            select(User).where(User.username == ADMIN_USERNAME)
        )
        user = result.scalar_one_or_none()

        if not user:
            user = User(
                telegram_id=ADMIN_TELEGRAM_ID,
                username=ADMIN_USERNAME,
                first_name="Admin",
                role="admin",
                is_active=True,
                onboarded=True,
            )
            session.add(user)
            print(f"  [seed] Admin '{ADMIN_USERNAME}' created (users table)")
        else:
            print(f"  [seed] Admin '{ADMIN_USERNAME}' exists (users table, id={user.id})")

        await session.commit()

    print("  [seed] Done.")


if __name__ == "__main__":
    asyncio.run(seed())
