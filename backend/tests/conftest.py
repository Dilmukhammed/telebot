import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from pathlib import Path
import sys
import os

# Ensure backend directory is on path for relative imports (database, models, config, etc.)
BACKEND_DIR = str(Path(__file__).parent.parent)
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

# Set env vars BEFORE any imports to avoid pydantic validation errors
os.environ.setdefault("BOT_TOKEN", "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890")
os.environ.setdefault("ADMIN_JWT_SECRET", "test-secret-for-pytest")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

# Now import using relative-style (matching how main.py imports)
from database import Base, engine, async_session_maker
from models import Subject, Test, Admin, Registration, Result  # noqa: F401 - ensure models are registered


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Reset database before each test: drop all tables, recreate."""
    # Clear existing metadata to avoid "table already defined" errors
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def test_client():
    """Async test client for FastAPI app."""
    # Import main AFTER env vars and db setup
    from main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def admin_token():
    """Create an admin and return a valid JWT token."""
    from auth import hash_password, create_access_token
    async with async_session_maker() as session:
        admin = Admin(username="testadmin", password_hash=hash_password("admin123"))
        session.add(admin)
        await session.commit()
    return create_access_token({"sub": "testadmin"})


@pytest_asyncio.fixture
async def test_subject():
    """Create a test subject and return it."""
    async with async_session_maker() as session:
        subject = Subject(name="Математика")
        session.add(subject)
        await session.commit()
        await session.refresh(subject)
        return subject


@pytest_asyncio.fixture
async def test_test(test_subject):
    """Create an active test with capacity and return it."""
    from datetime import datetime, timedelta, timezone
    async with async_session_maker() as session:
        test = Test(
            subject_id=test_subject.id,
            datetime=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7),
            max_capacity=20,
            format="offline",
            duration_minutes=90,
            is_active=True,
        )
        session.add(test)
        await session.commit()
        await session.refresh(test)
        return test


@pytest.fixture
def test_db():
    """Dummy fixture for tests that request test_db."""
    return None

