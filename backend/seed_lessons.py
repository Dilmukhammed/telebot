"""Seed script for demo lessons data."""
import asyncio
from sqlalchemy import select
from database import async_session_maker
from models import Subject, Lesson


async def seed():
    async with async_session_maker() as db:
        # Create subjects if not exist
        subjects_data = [
            ("SAT Math", "Подготовка к экзамену SAT по математике. Алгебра, геометрия, статистика и тригонометрия."),
            ("Олимпиадная Математика", "Углубленное изучение математики для подготовки к олимпиадам различного уровня."),
            ("Курсы для Абитуриентов", "Интенсивная подготовка к вступительным экзаменам в университеты."),
        ]
        for name, description in subjects_data:
            result = await db.execute(select(Subject).where(Subject.name == name))
            subject = result.scalar_one_or_none()
            if not subject:
                db.add(Subject(name=name, description=description))
            else:
                subject.description = description
        await db.commit()

        # Get subject IDs
        result = await db.execute(select(Subject))
        subjects = {s.name: s.id for s in result.scalars().all()}

        # Calculate dynamic times in Tashkent timezone to trigger urgent/ongoing highlights immediately
        import datetime as _dt
        tashkent_tz = _dt.timezone(_dt.timedelta(hours=5))
        now = _dt.datetime.now(tashkent_tz)
        today_weekday = now.weekday()

        ongoing_time = (now - _dt.timedelta(minutes=20)).strftime("%H:%M")
        urgent_time = (now + _dt.timedelta(minutes=20)).strftime("%H:%M")

        # Clear any old Saturday/Sunday dynamic lessons first to avoid clutter
        from sqlalchemy import delete
        await db.execute(
            delete(Lesson).where(
                Lesson.day_of_week == today_weekday,
                Lesson.teacher_name == "Zuhra (Demo)"
            )
        )

        # Create lessons list
        import json

        sat_plan_mon = json.dumps([
            {"title": "Алгебра: линейные уравнения", "description": "Решение уравнений с одной переменной, системы уравнений."},
            {"title": "Практика: задачи SAT", "description": "Разбор типовых задач секции Math."},
            {"title": "Стратегии решения", "description": "Методы быстрого ответа и исключения вариантов."},
        ], ensure_ascii=False)

        sat_plan_wed = json.dumps([
            {"title": "Геометрия и тригонометрия", "description": "Углы, площади, теоремы синусов и косинусов."},
            {"title": "Работа с графиками", "description": "Анализ функций, пересечения, экстремумы."},
            {"title": "Тест-симуляция", "description": "Мини-тест на 15 минут в формате SAT."},
        ], ensure_ascii=False)

        olympiad_plan = json.dumps([
            {"title": "Теория чисел", "description": "Делимость, остатки, модульная арифметика."},
            {"title": "Комбинаторика", "description": "Подсчёт, принцип включений-исключений."},
            {"title": "Разбор олимпиадных задач", "description": "Задачи прошлых лет республиканской олимпиады."},
        ], ensure_ascii=False)

        abiturient_plan = json.dumps([
            {"title": "Повторение: алгебра", "description": "Многочлены, неравенства, логарифмы."},
            {"title": "Разбор вступительных", "description": "Типичные задания приёмных экзаменов."},
            {"title": "Самостоятельная работа", "description": "Решение варианта с последующей проверкой."},
        ], ensure_ascii=False)

        lessons_data = [
            # Standard weekly lessons
            {
                "subject_id": subjects["SAT Math"],
                "teacher_name": "Zuhra",
                "day_of_week": 0,  # Monday
                "time": "16:00",
                "room": "Каб. 3",
                "location": "г. Ташкент, Мирабадский район, ул. Фидокор 7А",
                "lesson_plan": sat_plan_mon,
            },
            {
                "subject_id": subjects["SAT Math"],
                "teacher_name": "Zuhra",
                "day_of_week": 2,  # Wednesday
                "time": "16:00",
                "room": "Каб. 3",
                "location": "г. Ташкент, Мирабадский район, ул. Фидокор 7А",
                "lesson_plan": sat_plan_wed,
            },
            {
                "subject_id": subjects["Олимпиадная Математика"],
                "teacher_name": "Zuhra",
                "day_of_week": 4,  # Friday
                "time": "14:00",
                "room": "Каб. 1",
                "location": "г. Ташкент, Мирабадский район, ул. Фидокор 7А",
                "lesson_plan": olympiad_plan,
            },
            {
                "subject_id": subjects["Курсы для Абитуриентов"],
                "teacher_name": "Zuhra",
                "day_of_week": 3,  # Thursday
                "time": "15:00",
                "room": "Каб. 2",
                "location": "г. Ташкент, Мирабадский район, ул. Фидокор 7А",
                "lesson_plan": abiturient_plan,
            },
            # Dynamic lessons to test highlights
            {
                "subject_id": subjects["SAT Math"],
                "teacher_name": "Zuhra (Demo)",
                "day_of_week": today_weekday,
                "time": ongoing_time,
                "room": "Каб. 4 (Тест)",
                "location": "г. Ташкент, Мирабадский район, ул. Фидокор 7А",
                "lesson_plan": sat_plan_mon,
            },
            {
                "subject_id": subjects["Олимпиадная Математика"],
                "teacher_name": "Zuhra (Demo)",
                "day_of_week": today_weekday,
                "time": urgent_time,
                "room": "Каб. 5 (Тест)",
                "location": "г. Ташкент, Мирабадский район, ул. Фидокор 7А",
                "lesson_plan": olympiad_plan,
            },
        ]

        for lesson_data in lessons_data:
            # For weekly lessons, check if exists. For dynamic demo lessons, always add them
            if lesson_data["teacher_name"] == "Zuhra (Demo)":
                db.add(Lesson(**lesson_data))
            else:
                result = await db.execute(
                    select(Lesson).where(
                        Lesson.subject_id == lesson_data["subject_id"],
                        Lesson.day_of_week == lesson_data["day_of_week"],
                        Lesson.time == lesson_data["time"],
                    )
                )
                existing = result.scalar_one_or_none()
                if existing:
                    # Update lesson_plan for existing lessons
                    existing.lesson_plan = lesson_data.get("lesson_plan")
                else:
                    db.add(Lesson(**lesson_data))

        await db.commit()
        print(f"Demo lessons seeded! Dynamic times set to: Ongoing={ongoing_time}, Urgent={urgent_time}")


if __name__ == "__main__":
    asyncio.run(seed())