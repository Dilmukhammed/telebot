"""Demo data seeder for EduCenter.

Creates users (admin, teachers, students), courses, lessons, enrollments, and attendance.
Idempotent — safe to run multiple times.
"""

import asyncio
import datetime as dt
import json

from sqlalchemy import select

from database import engine, Base, async_session_maker
from models import (
    User, Subject, Lesson, LessonEnrollment, LessonStatus, Attendance,
    Notification, NotificationRecipient,
)


# ── Users ────────────────────────────────────────────────────────────

ADMIN_USER = {
    "telegram_id": 999000001,
    "username": "admin_user",
    "first_name": "Админ",
    "last_name": "Главный",
    "role": "admin",
    "phone": "+998901111111",
}

TEACHERS = [
    {
        "telegram_id": 8720110044,
        "username": "gi_rocke",
        "first_name": "Акбар",
        "last_name": "Рахимов",
        "role": "teacher",
        "phone": "+998903333333",
    },
]

STUDENTS = [
    {
        "telegram_id": 8464921092,
        "username": "tdima01",
        "first_name": "Дмитрий",
        "last_name": "Иванов",
        "role": "student",
        "phone": "+998904444444",
    },
    {
        "telegram_id": 777000002,
        "username": "alisa_student",
        "first_name": "Алиса",
        "last_name": "Ким",
        "role": "student",
        "phone": "+998905555555",
    },
    {
        "telegram_id": 777000003,
        "username": "boris_student",
        "first_name": "Борис",
        "last_name": "Петров",
        "role": "student",
        "phone": "+998906666666",
    },
    {
        "telegram_id": 777000004,
        "username": "katya_student",
        "first_name": "Екатерина",
        "last_name": "Смирнова",
        "role": "student",
        "phone": "+998907777777",
    },
    {
        "telegram_id": 777000005,
        "username": "elnur_student",
        "first_name": "Эльнур",
        "last_name": "Каримов",
        "role": "student",
        "phone": "+998908888888",
    },
]

# ── Subjects (Courses) ──────────────────────────────────────────────

SUBJECTS = [
    {
        "name": "Математика",
        "description": "Алгебра и геометрия для 8-11 классов",
        "duration_weeks": 16,
        "duration_minutes": 90,
    },
    {
        "name": "Английский язык",
        "description": "Подготовка к IELTS и общему уровню",
        "duration_weeks": 12,
        "duration_minutes": 60,
    },
    {
        "name": "Физика",
        "description": "Олимпиадная физика и подготовка к экзаменам",
        "duration_weeks": 14,
        "duration_minutes": 90,
    },
    {
        "name": "Программирование",
        "description": "Python и основы алгоритмов",
        "duration_weeks": 10,
        "duration_minutes": 120,
    },
]

# ── Lessons ──────────────────────────────────────────────────────────
# day_of_week: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun

LESSONS = [
    # Математика — gi_rocke — Пн/Ср 16:00
    {"subject": "Математика", "teacher": "gi_rocke", "day": 0, "time": "16:00", "room": "Каб. 3", "capacity": 12},
    {"subject": "Математика", "teacher": "gi_rocke", "day": 2, "time": "16:00", "room": "Каб. 3", "capacity": 12},
    # Английский — gi_rocke — Вт/Чт 14:00
    {"subject": "Английский язык", "teacher": "gi_rocke", "day": 1, "time": "14:00", "room": "Каб. 5", "capacity": 10},
    {"subject": "Английский язык", "teacher": "gi_rocke", "day": 3, "time": "14:00", "room": "Каб. 5", "capacity": 10},
    # Физика — gi_rocke — Пт 15:00
    {"subject": "Физика", "teacher": "gi_rocke", "day": 4, "time": "15:00", "room": "Каб. 7", "capacity": 8},
    # Программирование — gi_rocke — Сб 10:00
    {"subject": "Программирование", "teacher": "gi_rocke", "day": 5, "time": "10:00", "room": "Каб. 1", "capacity": 15},
]

# ── Enrollments ──────────────────────────────────────────────────────

ENROLLMENTS = [
    # tdima01 → Математика, Английский, Программирование
    ("tdima01", "Математика"),
    ("tdima01", "Английский язык"),
    ("tdima01", "Программирование"),
    # Алиса → Математика, Английский
    ("alisa_student", "Математика"),
    ("alisa_student", "Английский язык"),
    # Борис → Английский, Физика
    ("boris_student", "Английский язык"),
    ("boris_student", "Физика"),
    # Катя → Математика, Английский, Физика
    ("katya_student", "Математика"),
    ("katya_student", "Английский язык"),
    ("katya_student", "Физика"),
    # Эльнур → Программирование, Физика
    ("elnur_student", "Программирование"),
    ("elnur_student", "Физика"),
]


async def get_or_create_user(session, data: dict) -> User:
    """Get existing user or create new one."""
    result = await session.execute(
        select(User).where(User.telegram_id == data["telegram_id"])
    )
    user = result.scalar_one_or_none()
    if user:
        return user

    user = User(
        telegram_id=data["telegram_id"],
        username=data.get("username"),
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        role=data["role"],
        phone=data.get("phone"),
        language_code="ru",
        is_active=True,
        onboarded=True,
    )
    session.add(user)
    await session.flush()
    print(f"  ✓ User created: {data['first_name']} ({data['role']})")
    return user


async def get_or_create_subject(session, data: dict) -> Subject:
    """Get existing subject or create new one."""
    result = await session.execute(
        select(Subject).where(Subject.name == data["name"])
    )
    subject = result.scalar_one_or_none()
    if subject:
        return subject

    subject = Subject(
        name=data["name"],
        description=data.get("description"),
        duration_weeks=data.get("duration_weeks", 12),
        duration_minutes=data.get("duration_minutes", 90),
        start_date=dt.datetime.now(),
    )
    session.add(subject)
    await session.flush()
    print(f"  ✓ Subject created: {data['name']}")
    return subject


async def get_or_create_lesson(session, data: dict, subject: Subject, teacher: User) -> Lesson:
    """Get existing lesson or create new one."""
    result = await session.execute(
        select(Lesson).where(
            Lesson.subject_id == subject.id,
            Lesson.teacher_id == teacher.id,
            Lesson.day_of_week == data["day"],
            Lesson.time == data["time"],
        )
    )
    lesson = result.scalar_one_or_none()
    if lesson:
        return lesson

    lesson = Lesson(
        subject_id=subject.id,
        teacher_id=teacher.id,
        teacher_name=teacher.first_name or "Преподаватель",
        day_of_week=data["day"],
        time=data["time"],
        room=data["room"],
        max_capacity=data.get("capacity", 15),
        is_active=True,
        lesson_plan=json.dumps([
            {"title": "Вводное занятие", "description": "Знакомство, диагностика уровня"},
            {"title": "Основы", "description": "Базовые概念 и формулы"},
            {"title": "Практика", "description": "Решение задач"},
        ]),
    )
    session.add(lesson)
    await session.flush()
    day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    print(f"  ✓ Lesson created: {subject.name} — {day_names[data['day']]} {data['time']} ({teacher.first_name})")
    return lesson


async def seed():
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        print("\n── Users ──")
        admin = await get_or_create_user(session, ADMIN_USER)

        teachers = {}
        for t in TEACHERS:
            user = await get_or_create_user(session, t)
            teachers[t["username"]] = user

        students = {}
        for s in STUDENTS:
            user = await get_or_create_user(session, s)
            students[s["username"]] = user

        print("\n── Subjects ──")
        subjects = {}
        for s in SUBJECTS:
            subj = await get_or_create_subject(session, s)
            subjects[s["name"]] = subj

        print("\n── Lessons ──")
        lessons = {}
        for ld in LESSONS:
            subj = subjects[ld["subject"]]
            teacher = teachers[ld["teacher"]]
            lesson = await get_or_create_lesson(session, ld, subj, teacher)
            key = f"{ld['subject']}_{ld['day']}_{ld['time']}"
            lessons[key] = lesson

        print("\n── Enrollments ──")
        enrolled_count = 0
        for student_username, subject_name in ENROLLMENTS:
            student = students[student_username]
            # Find all lessons for this subject
            for key, lesson in lessons.items():
                if key.startswith(subject_name + "_"):
                    # Check if already enrolled
                    result = await session.execute(
                        select(LessonEnrollment).where(
                            LessonEnrollment.lesson_id == lesson.id,
                            LessonEnrollment.user_id == student.id,
                        )
                    )
                    existing = result.scalar_one_or_none()
                    if not existing:
                        enrollment = LessonEnrollment(
                            lesson_id=lesson.id,
                            user_id=student.id,
                        )
                        session.add(enrollment)
                        enrolled_count += 1
        print(f"  ✓ {enrolled_count} enrollments created")

        # ── Lesson statuses (past lessons) ──
        print("\n── Lesson Statuses ──")
        today = dt.date.today()
        # Create some past lesson statuses
        for lesson_key, lesson in list(lessons.items())[:4]:
            # Check if status already exists for today
            result = await session.execute(
                select(LessonStatus).where(LessonStatus.lesson_id == lesson.id)
            )
            existing = result.scalar_one_or_none()
            if not existing:
                status = LessonStatus(
                    lesson_id=lesson.id,
                    date=today - dt.timedelta(days=1),
                    status="happened",
                )
                session.add(status)
                print(f"  ✓ Status: {lesson_key} → happened")

        # ── Attendance ──
        print("\n── Attendance ──")
        attendance_count = 0
        for lesson_key, lesson in list(lessons.items())[:3]:
            for student_username in ["tdima01", "alisa_student", "katya_student"]:
                student = students[student_username]
                # Check if already enrolled
                enroll_result = await session.execute(
                    select(LessonEnrollment).where(
                        LessonEnrollment.lesson_id == lesson.id,
                        LessonEnrollment.user_id == student.id,
                    )
                )
                if not enroll_result.scalar_one_or_none():
                    continue

                att_result = await session.execute(
                    select(Attendance).where(
                        Attendance.lesson_id == lesson.id,
                        Attendance.user_id == student.id,
                    )
                )
                if att_result.scalar_one_or_none():
                    continue

                att = Attendance(
                    lesson_id=lesson.id,
                    user_id=student.id,
                    date=today - dt.timedelta(days=1),
                    status="present" if student_username != "boris_student" else "absent",
                )
                session.add(att)
                attendance_count += 1
        print(f"  ✓ {attendance_count} attendance records created")

        # ── Notifications ──
        print("\n── Notifications ──")
        notif_result = await session.execute(
            select(Notification).where(Notification.message.like("%Добро пожаловать%"))
        )
        if not notif_result.scalar_one_or_none():
            notif = Notification(
                sender_id=admin.id,
                title="Добро пожаловать!",
                message="Добро пожаловать в EduCenter! Мы рады видеть вас в нашем учебном центре. Если у вас есть вопросы, обращайтесь к администратору.",
                target_type="all",
            )
            session.add(notif)
            await session.flush()

            # Add recipients
            for student in students.values():
                session.add(NotificationRecipient(notification_id=notif.id, user_id=student.id))
            print("  ✓ Welcome notification created")

        await session.commit()

    print("\n" + "=" * 50)
    print("✅ Demo data seeded successfully!")
    print("=" * 50)
    print(f"\n👥 Users: 1 admin, {len(TEACHERS)} teachers, {len(STUDENTS)} students")
    print(f"📚 Subjects: {len(SUBJECTS)}")
    print(f"📅 Lessons: {len(LESSONS)}")
    print(f"🔗 Enrollments: {enrolled_count}")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(seed())
