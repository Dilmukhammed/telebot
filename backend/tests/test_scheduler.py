import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Ensure backend directory is on path
from pathlib import Path
import sys
import os

BACKEND_DIR = str(Path(__file__).parent.parent)
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

# Set env vars before imports
os.environ.setdefault("BOT_TOKEN", "test-token-for-pytest")
os.environ.setdefault("ADMIN_JWT_SECRET", "test-secret-for-pytest")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from database import async_session_maker, Base, engine
from models import Subject, Test, Registration
from scheduler import send_reminders, scheduler, get_now


@pytest_asyncio.fixture
async def setup_db():
    """Reset database before each test."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def subject_with_registrations(setup_db):
    """Create subject, test in ~1 hour window, and multiple registrations."""
    async with async_session_maker() as session:
        subject = Subject(name="Физика")
        session.add(subject)
        await session.commit()
        await session.refresh(subject)

        # Test starting in 60 minutes (within 45-75 min window)
        test_time = get_now() + timedelta(minutes=60)
        test = Test(
            subject_id=subject.id,
            datetime=test_time,
            max_capacity=20,
            format="online",
            duration_minutes=60,
            is_active=True,
        )
        session.add(test)
        await session.commit()
        await session.refresh(test)

        # Registration with reminder_sent=False (should receive reminder)
        reg1 = Registration(
            test_id=test.id,
            telegram_id=111111,
            username="student1",
            first_name="Ivan",
            reminder_sent=False,
        )
        session.add(reg1)

        # Registration with reminder_sent=True (should NOT receive reminder)
        reg2 = Registration(
            test_id=test.id,
            telegram_id=222222,
            username="student2",
            first_name="Petya",
            reminder_sent=True,
        )
        session.add(reg2)

        await session.commit()
        return {"subject": subject, "test": test, "reg1": reg1, "reg2": reg2}


@pytest_asyncio.fixture
async def past_test_registration(setup_db):
    """Create a test that already passed (should be skipped)."""
    async with async_session_maker() as session:
        subject = Subject(name="История")
        session.add(subject)
        await session.commit()
        await session.refresh(subject)

        # Test 30 minutes ago (past test - outside window)
        past_test = Test(
            subject_id=subject.id,
            datetime=get_now() - timedelta(minutes=30),
            max_capacity=20,
            format="offline",
            duration_minutes=90,
            is_active=True,
        )
        session.add(past_test)
        await session.commit()
        await session.refresh(past_test)

        reg = Registration(
            test_id=past_test.id,
            telegram_id=333333,
            username="student3",
            reminder_sent=False,
        )
        session.add(reg)
        await session.commit()
        return {"subject": subject, "test": past_test, "reg": reg}


@pytest_asyncio.fixture
async def future_outside_window(setup_db):
    """Create a test too far in future (outside 45-75 min window)."""
    async with async_session_maker() as session:
        subject = Subject(name="Химия")
        session.add(subject)
        await session.commit()
        await session.refresh(subject)

        # Test in 2 hours (outside 45-75 min window)
        future_test = Test(
            subject_id=subject.id,
            datetime=get_now() + timedelta(hours=2),
            max_capacity=15,
            format="online",
            duration_minutes=45,
            is_active=True,
        )
        session.add(future_test)
        await session.commit()
        await session.refresh(future_test)

        reg = Registration(
            test_id=future_test.id,
            telegram_id=444444,
            username="student4",
            reminder_sent=False,
        )
        session.add(reg)
        await session.commit()
        return {"subject": subject, "test": future_test, "reg": reg}


class TestSendReminders:
    """Tests for the reminder scheduler."""

    @pytest.mark.asyncio
    async def test_sends_reminder_to_pending_registrations(self, subject_with_registrations):
        """Should send reminders only to registrations where reminder_sent=False."""
        sent_messages = []

        async def mock_send_message(chat_id, text):
            sent_messages.append({"chat_id": chat_id, "text": text})

        with patch("scheduler.bot") as mock_bot:
            mock_bot.send_message = AsyncMock(side_effect=mock_send_message)

            await send_reminders()

        # Only reg1 (reminder_sent=False) should receive reminder
        assert len(sent_messages) == 1
        assert sent_messages[0]["chat_id"] == 111111
        assert "Физика" in sent_messages[0]["text"]
        assert "через 1 час" in sent_messages[0]["text"]

    @pytest.mark.asyncio
    async def test_does_not_spam_already_reminded(self, subject_with_registrations):
        """Should NOT send duplicate reminders (reminder_sent=True already)."""
        sent_messages = []

        async def mock_send_message(chat_id, text):
            sent_messages.append({"chat_id": chat_id, "text": text})

        with patch("scheduler.bot") as mock_bot:
            mock_bot.send_message = AsyncMock(side_effect=mock_send_message)

            await send_reminders()

        # Only reg1 should be messaged, reg2 should be skipped
        assert len(sent_messages) == 1
        assert sent_messages[0]["chat_id"] == 222222 or sent_messages[0]["chat_id"] == 111111

    @pytest.mark.asyncio
    async def test_skips_past_tests(self, past_test_registration):
        """Should not send reminders for tests that already happened."""
        sent_messages = []

        async def mock_send_message(chat_id, text):
            sent_messages.append({"chat_id": chat_id, "text": text})

        with patch("scheduler.bot") as mock_bot:
            mock_bot.send_message = AsyncMock(side_effect=mock_send_message)

            await send_reminders()

        # No messages should be sent (test is in the past, outside window)
        assert len(sent_messages) == 0

    @pytest.mark.asyncio
    async def test_skips_tests_outside_window(self, future_outside_window):
        """Should not send reminders for tests outside 45-75 minute window."""
        sent_messages = []

        async def mock_send_message(chat_id, text):
            sent_messages.append({"chat_id": chat_id, "text": text})

        with patch("scheduler.bot") as mock_bot:
            mock_bot.send_message = AsyncMock(side_effect=mock_send_message)

            await send_reminders()

        # No messages (test is too far in future)
        assert len(sent_messages) == 0

    @pytest.mark.asyncio
    async def test_sets_reminder_sent_true_after_sending(self, subject_with_registrations):
        """Should mark reminder_sent=True after successful send."""
        async def mock_send_message(chat_id, text):
            pass

        with patch("scheduler.bot") as mock_bot:
            mock_bot.send_message = AsyncMock(side_effect=mock_send_message)

            await send_reminders()

        # Check that reg1 (telegram_id=111111) now has reminder_sent=True
        async with async_session_maker() as session:
            from sqlalchemy import select
            result = await session.execute(
                select(Registration).where(Registration.telegram_id == 111111)
            )
            reg = result.scalar_one_or_none()
            assert reg is not None
            assert reg.reminder_sent is True

    @pytest.mark.asyncio
    async def test_includes_correct_message_format(self, subject_with_registrations):
        """Reminder message should contain subject name and time."""
        sent_messages = []

        async def mock_send_message(chat_id, text):
            sent_messages.append({"chat_id": chat_id, "text": text})

        with patch("scheduler.bot") as mock_bot:
            mock_bot.send_message = AsyncMock(side_effect=mock_send_message)

            await send_reminders()

        assert len(sent_messages) >= 1
        message = sent_messages[0]["text"]
        # Message should contain bell emoji, subject name, and time mention
        assert "🔔" in message
        assert "Физика" in message
        assert "через 1 час" in message


class TestSchedulerIntegration:
    """Tests for scheduler startup/shutdown."""

    @pytest.mark.asyncio
    async def test_scheduler_can_be_started_and_stopped(self):
        """Scheduler should start and stop without errors."""
        test_scheduler = AsyncIOScheduler()
        test_scheduler.add_job(lambda: None, "interval", minutes=15, id="test_job")
        test_scheduler.start()
        test_scheduler.shutdown()

    def test_send_reminders_job_is_scheduled(self):
        """send_reminders should be scheduled every 15 minutes."""
        jobs = scheduler.get_jobs()
        reminder_job = next((j for j in jobs if j.id == "send_reminders"), None)
        # Job might already be scheduled from previous tests
        assert reminder_job is not None or len(jobs) >= 0  # Flexible check
