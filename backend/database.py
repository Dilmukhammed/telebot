from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from config import settings


# Connection pool config: pool_size, max_overflow, and pool_recycle are only
# effective for PostgreSQL (asyncpg). For SQLite (aiosqlite) they must be omitted.
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

_pool_kwargs = {} if _is_sqlite else {
    "pool_size": 20,
    "max_overflow": 10,
    "pool_recycle": 300,
}

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=False,
    **_pool_kwargs,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


from contextlib import asynccontextmanager

@asynccontextmanager
async def get_dbCtx():
    """Async context manager for getting DB sessions outside FastAPI (e.g. bot handlers)."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()