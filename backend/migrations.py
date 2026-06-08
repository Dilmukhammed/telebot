import asyncio

from database import engine
from database import Base
import models  # Import models to register them with Base.metadata


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


if __name__ == "__main__":
    asyncio.run(init_db())
    print("Database tables created")