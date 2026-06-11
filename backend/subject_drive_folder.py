"""Per-course Google Drive folder: '{course} — {teacher(s)}'."""

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import google_drive
from config import settings
from models import Lesson, Subject

logger = logging.getLogger(__name__)


def sanitize_folder_name(name: str) -> str:
    cleaned = name.replace("/", "-").replace("\\", "-").strip()
    return cleaned[:200] if len(cleaned) > 200 else cleaned


def build_subject_folder_name(course_name: str, teacher_names: list[str]) -> str:
    course = sanitize_folder_name(course_name)
    teachers = [sanitize_folder_name(n) for n in teacher_names if n and n.strip()]
    unique = sorted(set(teachers))
    if unique:
        return sanitize_folder_name(f"{course} — {', '.join(unique)}")
    return course


async def get_active_teacher_names(db: AsyncSession, subject_id: int) -> list[str]:
    result = await db.execute(
        select(Lesson.teacher_name)
        .where(Lesson.subject_id == subject_id, Lesson.is_active == True)
        .distinct()
    )
    return [row[0].strip() for row in result.all() if row[0] and row[0].strip()]


async def get_subject_upload_folder(db: AsyncSession, subject: Subject) -> Optional[str]:
    """Resolve Drive folder for upload. Uses cache; creates only if missing (no rename per upload)."""
    if not settings.GOOGLE_DRIVE_FOLDER_ID:
        return None
    if subject.google_drive_folder_id:
        return subject.google_drive_folder_id
    return await sync_subject_drive_folder(db, subject)


async def sync_subject_drive_folder(db: AsyncSession, subject: Subject) -> Optional[str]:
    """Create or rename the course folder on Drive. Updates subject.google_drive_folder_id."""
    if not settings.GOOGLE_DRIVE_FOLDER_ID:
        return None

    teacher_names = await get_active_teacher_names(db, subject.id)
    folder_name = build_subject_folder_name(subject.name, teacher_names)
    root_id = settings.GOOGLE_DRIVE_FOLDER_ID

    if subject.google_drive_folder_id:
        try:
            await google_drive.rename_folder(subject.google_drive_folder_id, folder_name)
            return subject.google_drive_folder_id
        except Exception as exc:
            logger.warning(
                "Drive folder rename failed for subject %s (%s): %s",
                subject.id,
                subject.google_drive_folder_id,
                exc,
            )
            subject.google_drive_folder_id = None

    existing_id = await google_drive.find_folder_in_parent(root_id, folder_name)
    if existing_id:
        subject.google_drive_folder_id = existing_id
        return existing_id

    try:
        folder_id = await google_drive.create_folder(root_id, folder_name)
        subject.google_drive_folder_id = folder_id
        logger.info("Created Drive folder for subject %s: %s (%s)", subject.id, folder_name, folder_id)
        return folder_id
    except Exception as exc:
        logger.error("Failed to create Drive folder for subject %s: %s", subject.id, exc)
        return None
