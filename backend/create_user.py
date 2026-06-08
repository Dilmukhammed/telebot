import asyncio
import argparse

from database import engine, async_session_maker, Base
from models import User
from sqlalchemy import select


async def create_user(telegram_id: int, first_name: str, role: str):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as db:
        result = await db.execute(select(User).where(User.telegram_id == telegram_id))
        user = result.scalar_one_or_none()

        if user:
            user.role = role
            print(f"Updated existing user {telegram_id} to role {role}")
        else:
            user = User(
                telegram_id=telegram_id,
                first_name=first_name,
                role=role,
            )
            db.add(user)
            print(f"Created new user {telegram_id} with role {role}")

        await db.commit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--telegram-id", type=int, required=True)
    parser.add_argument("--name", type=str, required=True)
    parser.add_argument("--role", type=str, choices=["admin", "teacher", "student"], required=True)
    args = parser.parse_args()

    asyncio.run(create_user(args.telegram_id, args.name, args.role))
