"""Shared attendance-list builder used by both teacher and admin endpoints."""

from datetime import datetime

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import User, LessonEnrollment, Attendance
from schemas import AttendanceListOut, AttendanceRecordOut


async def build_attendance_list(
    lesson_id: int,
    date: str,
    status: str | None,
    db: AsyncSession,
) -> AttendanceListOut:
    """Build an attendance list with all enrolled students for a lesson instance."""
    lesson_date = datetime.strptime(date, "%Y-%m-%d").date()

    # Get all enrolled students
    enrollments_result = await db.execute(
        select(User)
        .join(LessonEnrollment, LessonEnrollment.user_id == User.id)
        .where(LessonEnrollment.lesson_id == lesson_id)
        .order_by(User.first_name)
    )
    students = enrollments_result.scalars().all()

    # Get existing attendance records
    att_result = await db.execute(
        select(Attendance).where(
            and_(Attendance.lesson_id == lesson_id, Attendance.date == lesson_date)
        )
    )
    att_map = {att.user_id: att for att in att_result.scalars().all()}

    records = []
    for student in students:
        att = att_map.get(student.id)
        records.append(AttendanceRecordOut(
            user_id=student.id,
            first_name=student.first_name or (f"@{student.username}" if student.username else "Ученик"),
            username=student.username,
            present=att.present if att else False,
        ))

    return AttendanceListOut(
        lesson_id=lesson_id,
        date=date,
        status=status,
        saved=len(att_map) > 0,
        records=records,
    )
