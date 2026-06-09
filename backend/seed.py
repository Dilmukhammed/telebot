"""Production seed — creates admin and teacher if they don't exist.

Idempotent: safe to run on every startup.
No demo data, no hardcoded lessons/subjects.
"""

import asyncio
from sqlalchemy import select
from database import engine, Base, async_session_maker
from models import User, Admin


ADMIN_USERNAME = "gi_rocke"
ADMIN_PASSWORD = "admin"

TEACHER_USERNAME = "tdima01"
TEACHER_FIRST_NAME = "Dilmukhammed"
TEACHER_LAST_NAME = "Turdimuratov"


async def seed():
    """Seed admin + teacher. Runs on every startup — skips if exists."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        # --- Admin (JWT auth table) ---
        result = await session.execute(
            select(Admin).where(Admin.username == ADMIN_USERNAME)
        )
        admin = result.scalar_one_or_none()

        if not admin:
            from auth import hash_password
            admin = Admin(
                username=ADMIN_USERNAME,
                password_hash=hash_password(ADMIN_PASSWORD),
                telegram_id=-1,
            )
            session.add(admin)
            print(f"  [seed] Admin '{ADMIN_USERNAME}' created")
        else:
            print(f"  [seed] Admin '{ADMIN_USERNAME}' exists (id={admin.id})")

        # --- Teacher ---
        result = await session.execute(
            select(User).where(User.username == TEACHER_USERNAME)
        )
        teacher = result.scalar_one_or_none()

        if not teacher:
            teacher = User(
                telegram_id=-2,
                username=TEACHER_USERNAME,
                first_name=TEACHER_FIRST_NAME,
                last_name=TEACHER_LAST_NAME,
                role="teacher",
                is_active=True,
                onboarded=True,
            )
            session.add(teacher)
            print(f"  [seed] Teacher '@{TEACHER_USERNAME}' created")
        else:
            print(f"  [seed] Teacher '@{TEACHER_USERNAME}' exists (id={teacher.id})")

        await session.commit()

    print("  [seed] Done.")


if __name__ == "__main__":
    asyncio.run(seed())
