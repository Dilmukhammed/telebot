"""Restore real database from local data.
Run on Railway: python restore_db.py
"""
import asyncio
import datetime as dt
import json

from database import engine, Base, async_session_maker
from models import User, Subject, Lesson, LessonEnrollment, LessonStatus, Attendance, Notification, NotificationRecipient


async def restore():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        # ── USERS ──
        users_data = [
            {"telegram_id": 8464921092, "username": "tdima01", "first_name": "Dima", "last_name": None, "role": "student", "phone": "+998873556717"},
            {"telegram_id": 8720110044, "username": "gi_rocke", "first_name": "Gulnara", "last_name": "Ismoilova", "role": "teacher", "phone": "+998999516717"},
            {"telegram_id": 7627709224, "username": "adrnmy", "first_name": "A", "last_name": None, "role": "admin", "phone": "79166395579"},
        ]
        user_map = {}
        for ud in users_data:
            from sqlalchemy import select
            result = await session.execute(select(User).where(User.telegram_id == ud["telegram_id"]))
            user = result.scalar_one_or_none()
            if not user:
                result = await session.execute(select(User).where(User.username == ud["username"]))
                user = result.scalar_one_or_none()
            if user:
                user.role = ud["role"]
                user.onboarded = True
                user.is_active = True
                user.phone = ud.get("phone") or user.phone
                user.first_name = ud.get("first_name") or user.first_name
                user.last_name = ud.get("last_name") or user.last_name
                print(f"  Updated user: @{ud['username']} -> {ud['role']}")
            else:
                user = User(
                    telegram_id=ud["telegram_id"], username=ud["username"],
                    first_name=ud["first_name"], last_name=ud.get("last_name"),
                    role=ud["role"], phone=ud.get("phone"),
                    language_code="ru", is_active=True, onboarded=True,
                )
                session.add(user)
                await session.flush()
                print(f"  Created user: @{ud['username']} -> {ud['role']}")
            user_map[ud["username"]] = user
            user_map[ud["telegram_id"]] = user

        # ── SUBJECTS ──
        subjects_data = [
            {"name": "SAT Math", "description": "Подготовка к экзамену SAT по математике. Алгебра, геометрия, статистика и тригонометрия.", "duration_weeks": 16, "duration_minutes": 90},
            {"name": "Олимпиадная Математика", "description": "Углубленное изучение математики для подготовки к олимпиадам различного уровня.", "duration_weeks": 20, "duration_minutes": 120},
            {"name": "Курсы для Абитуриентов", "description": "Интенсивная подготовка к вступительным экзаменам в университеты.", "duration_weeks": 12, "duration_minutes": 90},
            {"name": "IELTS Preparation", "description": "Подготовка к IELTS Academic. Все 4 модуля: Listening, Reading, Writing, Speaking.", "duration_weeks": 10, "duration_minutes": 60},
        ]
        subject_map = {}
        for sd in subjects_data:
            result = await session.execute(select(Subject).where(Subject.name == sd["name"]))
            subj = result.scalar_one_or_none()
            if not subj:
                subj = Subject(name=sd["name"], description=sd["description"],
                               duration_weeks=sd["duration_weeks"], duration_minutes=sd["duration_minutes"],
                               start_date=dt.datetime.now())
                session.add(subj)
                await session.flush()
                print(f"  Created subject: {sd['name']}")
            else:
                subj.description = sd["description"]
                print(f"  Updated subject: {sd['name']}")
            subject_map[sd["name"]] = subj

        # ── LESSONS ──
        teacher = user_map.get("gi_rocke")
        lessons_data = [
            {"subject": "SAT Math", "day": 0, "time": "16:00", "room": "Каб. 3", "capacity": 15},
            {"subject": "SAT Math", "day": 2, "time": "16:00", "room": "Каб. 3", "capacity": 15},
            {"subject": "Олимпиадная Математика", "day": 4, "time": "14:00", "room": "Каб. 1", "capacity": 10},
            {"subject": "Курсы для Абитуриентов", "day": 3, "time": "15:00", "room": "Каб. 2", "capacity": 12},
            {"subject": "Курсы для Абитуриентов", "day": 5, "time": "10:00", "room": "Каб. 2", "capacity": 12},
            {"subject": "IELTS Preparation", "day": 1, "time": "17:00", "room": "Каб. 5", "capacity": 10},
            {"subject": "IELTS Preparation", "day": 4, "time": "17:00", "room": "Каб. 5", "capacity": 10},
        ]
        lesson_map = {}
        for ld in lessons_data:
            subj = subject_map[ld["subject"]]
            result = await session.execute(
                select(Lesson).where(
                    Lesson.subject_id == subj.id,
                    Lesson.day_of_week == ld["day"],
                    Lesson.time == ld["time"],
                )
            )
            lesson = result.scalar_one_or_none()
            if not lesson:
                lesson = Lesson(
                    subject_id=subj.id, teacher_id=teacher.id if teacher else None,
                    teacher_name=teacher.first_name if teacher else "Gi_rocke",
                    day_of_week=ld["day"], time=ld["time"], room=ld["room"],
                    max_capacity=ld["capacity"], is_active=True,
                    lesson_plan=json.dumps([
                        {"title": "Вводное занятие", "description": "Знакомство, диагностика уровня"},
                        {"title": "Основы", "description": "Базовые概念 и формулы"},
                        {"title": "Практика", "description": "Решение задач"},
                    ]),
                )
                session.add(lesson)
                await session.flush()
                days = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"]
                print(f"  Created lesson: {ld['subject']} {days[ld['day']]} {ld['time']}")
            lesson_map[f"{ld['subject']}_{ld['day']}_{ld['time']}"] = lesson

        # ── ENROLLMENTS ──
        student = user_map.get("tdima01")
        if student:
            for key, lesson in lesson_map.items():
                result = await session.execute(
                    select(LessonEnrollment).where(
                        LessonEnrollment.lesson_id == lesson.id,
                        LessonEnrollment.user_id == student.id,
                    )
                )
                if not result.scalar_one_or_none():
                    session.add(LessonEnrollment(lesson_id=lesson.id, user_id=student.id))
                    print(f"  Enrolled tdima01 in {key}")

        # ── LESSON STATUSES ──
        today = dt.date.today()
        last_monday = today - dt.timedelta(days=today.weekday() + 7)
        statuses = [
            ("SAT Math_0_16:00", last_monday, "happened"),
            ("SAT Math_2_16:00", last_monday + dt.timedelta(days=2), "cancelled"),
            ("IELTS Preparation_1_17:00", last_monday + dt.timedelta(days=1), "happened"),
        ]
        for key, date, status in statuses:
            if key not in lesson_map:
                continue
            lesson = lesson_map[key]
            result = await session.execute(
                select(LessonStatus).where(LessonStatus.lesson_id == lesson.id, LessonStatus.date == date)
            )
            if not result.scalar_one_or_none():
                session.add(LessonStatus(lesson_id=lesson.id, date=date, status=status, marked_by=teacher.id if teacher else None))
                print(f"  Status: {key} -> {status} ({date})")

        await session.commit()

    print("\n" + "=" * 50)
    print("Database restored successfully!")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(restore())
