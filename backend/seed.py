"""Idempotent database seeder.

Creates initial subjects, tests, admin user, and demo data.
Safe to run multiple times — skips records that already exist.
"""

import asyncio
import datetime as dt
import sys
import io

# Fix Windows console encoding for Cyrillic output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from sqlalchemy import select

from database import engine, Base, async_session_maker
from models import Subject, Test, Admin, Registration, Result
from auth import hash_password


SUBJECTS = ["Математика", "Английский язык"]

TESTS_DATA = [
    {
        "subject_name": "Математика",
        "datetime": dt.datetime(2026, 7, 15, 10, 0),
        "max_capacity": 20,
        "format": "очный",
        "duration_minutes": 90,
    },
    {
        "subject_name": "Английский язык",
        "datetime": dt.datetime(2026, 7, 20, 14, 0),
        "max_capacity": 15,
        "format": "онлайн",
        "duration_minutes": 60,
    },
    {
        "subject_name": "Математика",
        "datetime": dt.datetime(2026, 8, 5, 10, 0),
        "max_capacity": 25,
        "format": "онлайн",
        "duration_minutes": 120,
    },
]

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

# Demo students with registrations and results
DEMO_REGISTRATIONS = [
    {
        "telegram_id": 111111111,
        "username": "alice_demo",
        "first_name": "Алиса",
        "test_subject": "Математика",
        "test_datetime": dt.datetime(2026, 7, 15, 10, 0),
        "status": "registered",
    },
    {
        "telegram_id": 222222222,
        "username": "bob_demo",
        "first_name": "Борис",
        "test_subject": "Английский язык",
        "test_datetime": dt.datetime(2026, 7, 20, 14, 0),
        "status": "registered",
    },
    {
        "telegram_id": 333333333,
        "username": "carol_demo",
        "first_name": "Катя",
        "test_subject": "Математика",
        "test_datetime": dt.datetime(2026, 7, 15, 10, 0),
        "status": "registered",
    },
]

DEMO_RESULTS = [
    {
        "telegram_id": 444444444,
        "username": "dave_demo",
        "first_name": "Дмитрий",
        "test_subject": "Математика",
        "test_datetime": dt.datetime(2025, 12, 10, 10, 0),
        "score": 78,
        "max_score": 100,
        "comment": "Хороший результат, нужно подтянуть геометрию",
    },
    {
        "telegram_id": 555555555,
        "username": "eve_demo",
        "first_name": "Елена",
        "test_subject": "Английский язык",
        "test_datetime": dt.datetime(2025, 12, 5, 14, 0),
        "score": 45,
        "max_score": 60,
        "comment": "Отличная работа с грамматикой",
    },
]


async def seed():
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        # --- Subjects ---
        subjects_created = 0
        subject_map: dict[str, Subject] = {}

        for name in SUBJECTS:
            result = await session.execute(select(Subject).where(Subject.name == name))
            subject = result.scalar_one_or_none()

            if subject:
                print(f"  Subject '{name}' already exists (id={subject.id})")
            else:
                subject = Subject(name=name)
                session.add(subject)
                await session.flush()
                subjects_created += 1
                print(f"  Subject '{name}' created (id={subject.id})")

            subject_map[name] = subject

        # --- Tests ---
        tests_created = 0
        test_map: dict[str, Test] = {}

        for td in TESTS_DATA:
            # Check by subject_id + datetime + format (unique enough for seed)
            result = await session.execute(
                select(Test).where(
                    Test.subject_id == subject_map[td["subject_name"]].id,
                    Test.datetime == td["datetime"],
                    Test.format == td["format"],
                )
            )
            test = result.scalar_one_or_none()

            if test:
                print(f"  Test '{td['subject_name']}' {td['datetime']} ({td['format']}) already exists (id={test.id})")
            else:
                test = Test(
                    subject_id=subject_map[td["subject_name"]].id,
                    datetime=td["datetime"],
                    max_capacity=td["max_capacity"],
                    format=td["format"],
                    duration_minutes=td["duration_minutes"],
                    is_active=True,
                )
                session.add(test)
                await session.flush()
                tests_created += 1
                print(f"  Test '{td['subject_name']}' {td['datetime']} ({td['format']}) created (id={test.id})")

            test_map[f"{td['subject_name']}_{td['datetime']}"] = test

        # --- Admin ---
        result = await session.execute(select(Admin).where(Admin.username == ADMIN_USERNAME))
        admin = result.scalar_one_or_none()

        if admin:
            print(f"  Admin '{ADMIN_USERNAME}' already exists (id={admin.id})")
        else:
            admin = Admin(
                username=ADMIN_USERNAME,
                password_hash=hash_password(ADMIN_PASSWORD),
            )
            session.add(admin)
            await session.flush()
            print(f"  Admin '{ADMIN_USERNAME}' created (id={admin.id})")

        # --- Demo Registrations ---
        regs_created = 0
        for dr in DEMO_REGISTRATIONS:
            # Find the test
            key = f"{dr['test_subject']}_{dr['test_datetime']}"
            test = test_map.get(key)
            if not test:
                print(f"  SKIP registration for {dr['username']} - test not found")
                continue

            # Check if already exists
            result = await session.execute(
                select(Registration).where(
                    Registration.telegram_id == dr["telegram_id"],
                    Registration.test_id == test.id,
                )
            )
            reg = result.scalar_one_or_none()

            if reg:
                print(f"  Registration for {dr['username']} already exists (id={reg.id})")
            else:
                reg = Registration(
                    test_id=test.id,
                    telegram_id=dr["telegram_id"],
                    username=dr["username"],
                    first_name=dr["first_name"],
                    status=dr["status"],
                )
                session.add(reg)
                await session.flush()
                regs_created += 1
                print(f"  Registration for {dr['username']} created (id={reg.id})")

        # --- Demo Past Tests + Results ---
        # Create past tests for results
        past_tests_created = 0
        past_test_map: dict[str, Test] = {}

        past_tests_data = [
            {
                "subject_name": "Математика",
                "datetime": dt.datetime(2025, 12, 10, 10, 0),
                "max_capacity": 20,
                "format": "очный",
                "duration_minutes": 90,
            },
            {
                "subject_name": "Английский язык",
                "datetime": dt.datetime(2025, 12, 5, 14, 0),
                "max_capacity": 15,
                "format": "онлайн",
                "duration_minutes": 60,
            },
        ]

        for td in past_tests_data:
            result = await session.execute(
                select(Test).where(
                    Test.subject_id == subject_map[td["subject_name"]].id,
                    Test.datetime == td["datetime"],
                    Test.format == td["format"],
                )
            )
            test = result.scalar_one_or_none()

            if test:
                print(f"  Past test '{td['subject_name']}' {td['datetime']} already exists (id={test.id})")
            else:
                test = Test(
                    subject_id=subject_map[td["subject_name"]].id,
                    datetime=td["datetime"],
                    max_capacity=td["max_capacity"],
                    format=td["format"],
                    duration_minutes=td["duration_minutes"],
                    is_active=False,
                )
                session.add(test)
                await session.flush()
                past_tests_created += 1
                print(f"  Past test '{td['subject_name']}' {td['datetime']} created (id={test.id})")

            past_test_map[f"{td['subject_name']}_{td['datetime']}"] = test

        # --- Demo Results ---
        results_created = 0
        for dr_res in DEMO_RESULTS:
            key = f"{dr_res['test_subject']}_{dr_res['test_datetime']}"
            test = past_test_map.get(key)
            if not test:
                print(f"  SKIP result for {dr_res['username']} - past test not found")
                continue

            # Create registration for result student
            result = await session.execute(
                select(Registration).where(
                    Registration.telegram_id == dr_res["telegram_id"],
                    Registration.test_id == test.id,
                )
            )
            reg = result.scalar_one_or_none()

            if not reg:
                reg = Registration(
                    test_id=test.id,
                    telegram_id=dr_res["telegram_id"],
                    username=dr_res["username"],
                    first_name=dr_res["first_name"],
                    status="registered",
                )
                session.add(reg)
                await session.flush()
                print(f"  Registration for result {dr_res['username']} created (id={reg.id})")

            # Check result already exists
            result = await session.execute(
                select(Result).where(Result.registration_id == reg.id)
            )
            existing_result = result.scalar_one_or_none()

            if existing_result:
                print(f"  Result for {dr_res['username']} already exists (id={existing_result.id})")
            else:
                new_result = Result(
                    registration_id=reg.id,
                    score=dr_res["score"],
                    max_score=dr_res["max_score"],
                    comment=dr_res["comment"],
                )
                session.add(new_result)
                await session.flush()
                results_created += 1
                print(f"  Result for {dr_res['username']} created: {dr_res['score']}/{dr_res['max_score']}")

        # --- Demo Notifications ---
        notifications_created = 0
        demo_notifications = [
            {
                "message": "Набор на летний интенсив по олимпиадной математике открыт! Количество мест ограничено.",
                "target_type": "all",
            },
            {
                "message": "Уважаемые ученики, 12 июня учебный центр не работает в связи с праздником. Все пропущенные занятия будут перенесены.",
                "target_type": "students",
            }
        ]

        from models import Notification
        for dn in demo_notifications:
            result = await session.execute(
                select(Notification).where(Notification.message == dn["message"])
            )
            existing_notif = result.scalar_one_or_none()
            if not existing_notif:
                notif = Notification(
                    message=dn["message"],
                    target_type=dn["target_type"],
                )
                session.add(notif)
                notifications_created += 1

        await session.commit()

    # --- Summary ---
    print("\n=== Seed Summary ===")
    print(f"  Subjects:      {len(SUBJECTS)} defined, {subjects_created} created")
    print(f"  Future Tests:   {len(TESTS_DATA)} defined, {tests_created} created")
    print(f"  Past Tests:     {len(past_tests_data)} defined, {past_tests_created} created")
    print(f"  Registrations:  {len(DEMO_REGISTRATIONS)} demo, {regs_created} created")
    print(f"  Results:        {len(DEMO_RESULTS)} demo, {results_created} created")
    print(f"  Notifications:  {len(demo_notifications)} demo, {notifications_created} created")
    print(f"  Admin:          username='{ADMIN_USERNAME}', password='{ADMIN_PASSWORD}'")
    print("====================\n")


if __name__ == "__main__":
    print("Seeding database...\n")
    asyncio.run(seed())
    print("Done.")