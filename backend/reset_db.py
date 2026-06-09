"""
Reset database: clear all data and create fresh admin + teacher.
Run on Railway: railway run python reset_db.py
"""
import asyncio
from database import engine, async_session_maker, Base
from models import (
    User, Admin, Subject, Lesson, LessonEnrollment,
    Attendance, LessonStatus, TeacherAvailability,
    Test, Registration, Result, Notification,
    NotificationRecipient, AuditLog,
)
from auth import hash_password
from sqlalchemy import text


ADMIN_USERNAME = "gi_rocke"
ADMIN_PASSWORD = "admin"
ADMIN_NAME = "Admin"

TEACHER_USERNAME = "tdima01"
TEACHER_NAME = "Dilmukhammed"
TEACHER_LAST_NAME = "Turdimuratov"


async def main():
    print("⚠️  This will DELETE ALL DATA in the database!")
    print("Clearing all tables...\n")

    async with engine.begin() as conn:
        # Delete in reverse dependency order to avoid FK violations
        tables = [
            "audit_logs",
            "notification_recipients",
            "notifications",
            "results",
            "registrations",
            "tests",
            "attendance",
            "lesson_statuses",
            "lesson_enrollments",
            "teacher_availability",
            "lessons",
            "subjects",
            "users",
            "admins",
        ]
        for table in tables:
            await conn.execute(text(f"DELETE FROM {table}"))
            print(f"  ✓ Cleared {table}")

        # Reset auto-increment counters (SQLite)
        await conn.execute(text("DELETE FROM sqlite_sequence"))

    print("\n✅ All tables cleared.\n")

    async with async_session_maker() as session:
        # 1. Create Admin in admins table (for JWT login)
        admin = Admin(
            username=ADMIN_USERNAME,
            password_hash=hash_password(ADMIN_PASSWORD),
        )
        session.add(admin)
        print(f"✓ Created admin '{ADMIN_USERNAME}' (password: {ADMIN_PASSWORD})")

        # 2. Create Admin in users table (for Telegram auth + role)
        # telegram_id will be updated when user logs in via Telegram
        admin_user = User(
            telegram_id=-1,  # Placeholder, updates on first Telegram login
            username=ADMIN_USERNAME,
            first_name=ADMIN_NAME,
            role="admin",
            onboarded=True,
        )
        session.add(admin_user)
        print(f"✓ Created admin user '{ADMIN_NAME}' (@{ADMIN_USERNAME})")

        # 3. Create Teacher in users table
        teacher = User(
            telegram_id=-2,  # Placeholder, updates on first Telegram login
            username=TEACHER_USERNAME,
            first_name=TEACHER_NAME,
            last_name=TEACHER_LAST_NAME,
            role="teacher",
            onboarded=False,  # Will complete onboarding on first login
        )
        session.add(teacher)
        print(f"✓ Created teacher '{TEACHER_NAME} {TEACHER_LAST_NAME}' (@{TEACHER_USERNAME})")

        await session.commit()
        print("\n✅ Done! Database reset complete.")
        print(f"\nAdmin login: {ADMIN_USERNAME} / {ADMIN_PASSWORD}")
        print(f"Teacher: @{TEACHER_USERNAME} (will onboard on first Telegram login)")


if __name__ == "__main__":
    asyncio.run(main())
