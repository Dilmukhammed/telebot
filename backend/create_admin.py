import asyncio

from database import engine, Base, async_session_maker
from models import Admin
from auth import hash_password


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        from sqlalchemy import select
        result = await session.execute(select(Admin).where(Admin.username == "admin"))
        existing_admin = result.scalar_one_or_none()

        if existing_admin:
            print("Admin 'admin' already exists")
            return

        admin = Admin(
            username="admin",
            password_hash=hash_password("admin123"),
        )
        session.add(admin)
        await session.commit()
        print("Admin 'admin' created successfully")


if __name__ == "__main__":
    asyncio.run(main())
