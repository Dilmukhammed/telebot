"""Helpers for recurring lesson slots with effective date ranges."""

from __future__ import annotations

import datetime as dt

from models import Lesson


def lesson_applies_on_date(lesson: Lesson, instance_date: dt.date) -> bool:
    """True if this slot version should be used for a calendar instance date."""
    if instance_date.weekday() != lesson.day_of_week:
        return False
    if lesson.effective_from and instance_date < lesson.effective_from:
        return False
    if lesson.effective_until and instance_date > lesson.effective_until:
        return False
    return True


def slot_group_id(lesson: Lesson) -> int:
    return lesson.slot_group_id or lesson.id


def pick_lesson_for_date(lessons: list[Lesson], instance_date: dt.date) -> Lesson | None:
    """Pick the applicable slot version per slot group for a given date."""
    by_group: dict[int, list[Lesson]] = {}
    for lesson in lessons:
        if not lesson_applies_on_date(lesson, instance_date):
            continue
        gid = slot_group_id(lesson)
        by_group.setdefault(gid, []).append(lesson)

    if not by_group:
        return None

    # One instance per slot group; prefer the latest effective_from if overlapping.
    chosen: list[Lesson] = []
    for group_lessons in by_group.values():
        chosen.append(max(group_lessons, key=lambda l: l.effective_from or dt.date.min))
    return chosen[0] if len(chosen) == 1 else None


def generate_instances_for_course(
    lessons: list[Lesson],
    start_monday: dt.date,
    weeks_needed: int,
    course_start: dt.date | None,
    course_end: dt.date | None,
    today: dt.date,
    duration_minutes: int,
    calculate_end_time,
    day_names_short: dict[int, str],
    course_lesson_out_cls,
) -> list:
    """Generate course lesson instances respecting slot effective date ranges."""
    instances = []
    seen: set[tuple[int, str]] = set()

    for week in range(weeks_needed):
        week_monday = start_monday + dt.timedelta(weeks=week)
        for day_offset in range(7):
            instance_date = week_monday + dt.timedelta(days=day_offset)

            if course_start and instance_date < course_start:
                continue
            if course_end and instance_date >= course_end:
                continue

            by_group: dict[int, Lesson] = {}
            for lesson in lessons:
                if not lesson_applies_on_date(lesson, instance_date):
                    continue
                gid = slot_group_id(lesson)
                current = by_group.get(gid)
                if current is None or (lesson.effective_from or dt.date.min) > (current.effective_from or dt.date.min):
                    by_group[gid] = lesson

            for lesson in by_group.values():
                key = (lesson.id, instance_date.isoformat())
                if key in seen:
                    continue
                seen.add(key)

                end_time_str = calculate_end_time(lesson.time, duration_minutes)
                if instance_date == today:
                    current_time_str = dt.datetime.now().strftime("%H:%M")
                    status = "past" if current_time_str > end_time_str else "today"
                elif instance_date > today:
                    status = "upcoming"
                else:
                    status = "past"

                instances.append(course_lesson_out_cls(
                    id=lesson.id,
                    lesson_number=0,
                    title="",
                    day_name=day_names_short[lesson.day_of_week],
                    day_of_week=lesson.day_of_week,
                    time=lesson.time,
                    end_time=end_time_str,
                    room=lesson.room,
                    location=lesson.location,
                    teacher_name=lesson.teacher_name,
                    status=status,
                    date=instance_date.strftime("%Y-%m-%d"),
                ))

    instances.sort(key=lambda x: x.date)
    for i, inst in enumerate(instances):
        inst.lesson_number = i + 1
        inst.title = f"Занятие {i + 1}"
    return instances


async def resolve_lesson_for_date(db, lesson_id: int, target_date: dt.date) -> Lesson | None:
    """Resolve the slot version that applies on target_date (follows slot_group chain)."""
    from sqlalchemy import select, or_

    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        return None
    if lesson_applies_on_date(lesson, target_date):
        return lesson

    gid = slot_group_id(lesson)
    siblings = await db.execute(
        select(Lesson).where(
            Lesson.subject_id == lesson.subject_id,
            or_(Lesson.slot_group_id == gid, Lesson.id == gid),
        )
    )
    for candidate in siblings.scalars().all():
        if lesson_applies_on_date(candidate, target_date):
            return candidate
    return lesson
