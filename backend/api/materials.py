"""Materials API — CRUD + file upload for course/lesson materials."""

import logging
import os
import re
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import Optional

from config import settings
from database import get_db
from models import Material, User, Lesson, Subject
from schemas import MaterialOut, MaterialCreate, MaterialUpdate, MaterialDuplicateOut
from api.deps import get_telegram_user, require_teacher
import google_drive
from subject_drive_folder import get_subject_upload_folder

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


def _apply_material_scope(query, subject_id: Optional[int], lesson_id: Optional[int]):
    if lesson_id is not None:
        return query.where(Material.lesson_id == lesson_id)
    if subject_id is not None:
        return query.where(Material.subject_id == subject_id, Material.lesson_id.is_(None))
    return query


def _youtube_video_id(url: str) -> Optional[str]:
    match = re.search(
        r"(?:youtu\.be/|youtube\.com/(?:embed/|v/|watch\?v=|shorts/))([A-Za-z0-9_-]{11})",
        url,
    )
    return match.group(1) if match else None


_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".bmp", ".avif"}


def _is_image_upload(file_name: str, mime_type: str) -> bool:
    if mime_type.startswith("image/"):
        return True
    ext = os.path.splitext(file_name)[1].lower()
    return ext in _IMAGE_EXTENSIONS


def _normalize_material_url(url: str, material_type: str) -> str:
    cleaned = url.strip()
    if material_type == "youtube":
        video_id = _youtube_video_id(cleaned)
        if video_id:
            return f"youtube:{video_id}"
    parsed = urlparse(cleaned.lower())
    host = (parsed.netloc or "").removeprefix("www.")
    path = parsed.path.rstrip("/")
    return f"{host}{path}{('?' + parsed.query) if parsed.query else ''}"


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


@router.get("/check-duplicate", response_model=MaterialDuplicateOut)
async def check_material_duplicate(
    subject_id: Optional[int] = None,
    lesson_id: Optional[int] = None,
    file_name: Optional[str] = None,
    file_size: Optional[int] = None,
    url: Optional[str] = None,
    material_type: Optional[str] = Query(None, alias="type"),
    title: Optional[str] = None,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Check if an identical file or URL already exists in the course/lesson materials."""
    if subject_id is None and lesson_id is None:
        raise HTTPException(status_code=400, detail="Provide subject_id or lesson_id")

    existing: Material | None = None

    if file_name is not None and file_size is not None:
        query = select(Material).where(
            Material.type.in_(("file", "image")),
            func.lower(Material.file_name) == file_name.strip().lower(),
            Material.file_size == file_size,
        )
        query = _apply_material_scope(query, subject_id, lesson_id)
        existing = (await db.execute(query.limit(1))).scalar_one_or_none()
    elif url and material_type in ("link", "youtube", "video"):
        normalized = _normalize_material_url(url, material_type)
        scoped = _apply_material_scope(select(Material), subject_id, lesson_id)
        candidates = (await db.execute(
            scoped.where(Material.type.in_(("link", "youtube", "video")), Material.url.isnot(None))
        )).scalars().all()
        for candidate in candidates:
            if _normalize_material_url(candidate.url or "", candidate.type) == normalized:
                existing = candidate
                break
    elif material_type == "text" and title:
        query = _apply_material_scope(
            select(Material).where(
                Material.type == "text",
                func.lower(Material.title) == title.strip().lower(),
            ),
            subject_id,
            lesson_id,
        )
        existing = (await db.execute(query.limit(1))).scalar_one_or_none()

    if existing:
        return MaterialDuplicateOut(duplicate=True, material=_material_to_out(existing))
    return MaterialDuplicateOut(duplicate=False)


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
    material_type: str = Form("file"),
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file or image material to Google Drive."""
    if material_type not in ("file", "image"):
        raise HTTPException(status_code=400, detail="material_type must be file or image")
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
    mime_type = file.content_type or "application/octet-stream"

    is_image = _is_image_upload(file_name, mime_type)
    if material_type == "image":
        if not is_image:
            raise HTTPException(status_code=400, detail="File must be an image")
    elif is_image:
        raise HTTPException(status_code=400, detail="Use image material type for photos")

    parent_folder_id = settings.GOOGLE_DRIVE_FOLDER_ID
    subject = await db.get(Subject, subject_id)
    if subject:
        try:
            folder_id = await get_subject_upload_folder(db, subject)
            if folder_id:
                parent_folder_id = folder_id
            # Commit before slow Drive API — don't hold a DB transaction open during upload.
            await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.warning("Drive folder resolve failed for subject %s: %s", subject_id, exc)

    if not parent_folder_id:
        raise HTTPException(status_code=500, detail="Google Drive upload is not configured")

    # Upload to Google Drive (no open DB transaction)
    google_file_id: str | None = None
    try:
        google_file_id, download_url = await google_drive.upload_file(
            file_bytes=file_bytes,
            file_name=file_name,
            mime_type=mime_type,
            parent_folder_id=parent_folder_id,
        )
    except Exception as exc:
        logger.error("Google Drive upload failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="File upload failed")

    material = Material(
        subject_id=subject_id,
        lesson_id=lesson_id,
        title=title,
        type=material_type,
        url=download_url,
        file_name=file_name,
        file_size=file_size,
        google_file_id=google_file_id,
        created_by=user.id,
    )
    db.add(material)
    try:
        await db.flush()
        await db.refresh(material)
    except IntegrityError as exc:
        await db.rollback()
        if google_file_id:
            await google_drive.delete_file(google_file_id)
        logger.error(
            "Material save failed: %s | subject_id=%s lesson_id=%s type=%s user=%s title=%r",
            exc.orig if hasattr(exc, 'orig') else exc,
            subject_id, lesson_id, material_type, user.id, title,
        )
        raise HTTPException(status_code=400, detail=f"Could not save material: {exc.orig if hasattr(exc, 'orig') else exc}")
    except Exception as exc:
        await db.rollback()
        if google_file_id:
            await google_drive.delete_file(google_file_id)
        logger.error("Material save unexpected error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Save failed: {exc}")

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
