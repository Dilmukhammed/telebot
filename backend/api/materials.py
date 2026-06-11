"""Materials API — CRUD + file upload for course/lesson materials."""

import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional

from database import get_db
from models import Material, User, Lesson
from schemas import MaterialOut, MaterialCreate, MaterialUpdate
from api.deps import get_telegram_user, require_teacher
import google_drive

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/materials", tags=["materials"])


async def _user_can_manage_material(user: User, material: Material, db: AsyncSession) -> bool:
    """Owner, admin, or any teacher with an active lesson on the course."""
    if user.role == "admin":
        return True
    if material.created_by == user.id:
        return True
    if user.role != "teacher":
        return False

    subject_id = material.subject_id
    if subject_id is None and material.lesson_id is not None:
        lesson = await db.get(Lesson, material.lesson_id)
        if lesson:
            subject_id = lesson.subject_id
    if subject_id is None:
        return False

    result = await db.execute(
        select(Lesson.id)
        .where(
            and_(
                Lesson.subject_id == subject_id,
                Lesson.teacher_id == user.id,
                Lesson.is_active == True,
            )
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


def _material_to_out(m: Material) -> MaterialOut:
    return MaterialOut(
        id=m.id,
        title=m.title,
        type=m.type,
        url=m.url,
        content=m.content,
        file_name=m.file_name,
        file_size=m.file_size,
        created_by=m.created_by,
        created_at=m.created_at.isoformat() if m.created_at else "",
    )


@router.get("", response_model=list[MaterialOut])
async def list_materials(
    subject_id: Optional[int] = None,
    lesson_id: Optional[int] = None,
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """List materials filtered by subject_id and/or lesson_id.

    subject_id alone returns course-level materials only (lesson_id IS NULL).
    lesson_id returns materials attached to that lesson.

    Students can only see materials for courses they are enrolled in.
    Teachers and admins can see all materials.
    """
    if subject_id is None and lesson_id is None:
        raise HTTPException(status_code=400, detail="Provide subject_id or lesson_id")

    # Enrollment check: students must be enrolled in the course
    if user.role == "student" and subject_id is not None:
        from models import LessonEnrollment, Lesson as LessonModel
        enrolled = await db.execute(
            select(LessonEnrollment.id)
            .join(LessonModel, LessonModel.id == LessonEnrollment.lesson_id)
            .where(
                LessonModel.subject_id == subject_id,
                LessonEnrollment.user_id == user.id,
            )
            .limit(1)
        )
        if not enrolled.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not enrolled in this course")

    query = select(Material)
    if subject_id is not None:
        query = query.where(Material.subject_id == subject_id)
    if lesson_id is not None:
        query = query.where(Material.lesson_id == lesson_id)
    elif subject_id is not None:
        query = query.where(Material.lesson_id.is_(None))

    query = query.order_by(Material.created_at.desc())
    result = await db.execute(query)
    materials = result.scalars().all()
    return [_material_to_out(m) for m in materials]


@router.post("", response_model=MaterialOut)
async def create_material(
    data: MaterialCreate,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Create a material (link, youtube, video, text). For files, use /upload."""
    if data.subject_id is None and data.lesson_id is None:
        raise HTTPException(status_code=400, detail="Provide subject_id or lesson_id")

    # Validate lesson exists if lesson_id provided
    if data.lesson_id is not None:
        lesson = await db.get(Lesson, data.lesson_id)
        if not lesson:
            raise HTTPException(status_code=404, detail="Lesson not found")
        # Auto-set subject_id from lesson if not provided
        if data.subject_id is None:
            data.subject_id = lesson.subject_id

    # Validate url for url-based types
    if data.type in ("video", "youtube", "link") and not data.url:
        raise HTTPException(status_code=400, detail="URL is required for this material type")
    if data.type == "text" and not data.content:
        raise HTTPException(status_code=400, detail="Content is required for text materials")

    material = Material(
        subject_id=data.subject_id,
        lesson_id=data.lesson_id,
        title=data.title,
        type=data.type,
        url=data.url,
        content=data.content,
        created_by=user.id,
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)

    logger.info("Material created: id=%d type=%s by user=%d", material.id, material.type, user.id)
    return _material_to_out(material)


@router.post("/upload", response_model=MaterialOut)
async def upload_material(
    file: UploadFile = File(...),
    title: str = Form(...),
    subject_id: Optional[int] = Form(None),
    lesson_id: Optional[int] = Form(None),
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file material to Google Drive."""
    if subject_id is None and lesson_id is None:
        raise HTTPException(status_code=400, detail="Provide subject_id or lesson_id")

    # Validate lesson if provided
    if lesson_id is not None:
        lesson = await db.get(Lesson, lesson_id)
        if not lesson:
            raise HTTPException(status_code=404, detail="Lesson not found")
        if subject_id is None:
            subject_id = lesson.subject_id

    # Read file bytes with size limit (50 MB)
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB")
    file_size = len(file_bytes)
    file_name = file.filename or "upload"

    # Upload to Google Drive
    try:
        google_file_id, download_url = await google_drive.upload_file(
            file_bytes=file_bytes,
            file_name=file_name,
            mime_type=file.content_type or "application/octet-stream",
        )
    except Exception as exc:
        logger.error("Google Drive upload failed: %s", exc)
        raise HTTPException(status_code=500, detail="File upload failed")

    material = Material(
        subject_id=subject_id,
        lesson_id=lesson_id,
        title=title,
        type="file",
        url=download_url,
        file_name=file_name,
        file_size=file_size,
        google_file_id=google_file_id,
        created_by=user.id,
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)

    logger.info("File material uploaded: id=%d file=%s by user=%d", material.id, file_name, user.id)
    return _material_to_out(material)


@router.put("/{material_id}", response_model=MaterialOut)
async def update_material(
    material_id: int,
    data: MaterialUpdate,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Update material metadata (owner or admin only)."""
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    if not await _user_can_manage_material(user, material, db):
        raise HTTPException(status_code=403, detail="Not allowed")

    if data.title is not None:
        material.title = data.title
    if data.url is not None:
        material.url = data.url
    if data.content is not None:
        material.content = data.content

    await db.commit()
    await db.refresh(material)
    return _material_to_out(material)


@router.delete("/{material_id}")
async def delete_material(
    material_id: int,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Delete a material (owner or admin only). Also deletes from Google Drive if applicable."""
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    if not await _user_can_manage_material(user, material, db):
        raise HTTPException(status_code=403, detail="Not allowed")

    # Delete from Google Drive if it's a file
    if material.google_file_id:
        await google_drive.delete_file(material.google_file_id)

    await db.delete(material)
    await db.commit()

    logger.info("Material deleted: id=%d by user=%d", material_id, user.id)
    return {"message": "Material deleted"}
