from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

from database import get_db
from models import User
from profile_theme import merge_profile_theme, normalize_profile_theme
from schemas import UserOut, UserRoleUpdate, OnboardingData, TeacherCreateIn, ProfileThemeUpdate
from api.deps import require_admin, get_telegram_user

router = APIRouter(prefix="/admin/users", tags=["users"])
user_router = APIRouter(prefix="/users", tags=["user"])


def user_to_dict(user: User) -> dict:
    """Convert User model to dict with proper string formatting."""
    return {
        "id": user.id,
        "telegram_id": user.telegram_id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "language_code": user.language_code,
        "is_premium": user.is_premium,
        "photo_url": user.photo_url,
        "phone": user.phone,
        "grade": user.grade,
        "role": user.role,
        "is_active": user.is_active,
        "onboarded": user.onboarded,
        "phone_verified": user.phone_verified,
        "profile_theme": normalize_profile_theme(user.profile_theme),
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.get("", response_model=list[UserOut])
async def list_users(
    role: str = Query(None),
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    result = await db.execute(query)
    users = result.scalars().all()
    return [user_to_dict(u) for u in users]


@router.post("", response_model=UserOut)
async def create_teacher(
    data: TeacherCreateIn,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    # Check username uniqueness
    existing = await db.execute(
        select(User).where(User.username == data.username)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    teacher = User(
        telegram_id=0,  # placeholder, updated on first login
        username=data.username,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        role="teacher",
        is_active=True,
        onboarded=False,
        phone_verified=False,
    )
    db.add(teacher)
    await db.commit()
    await db.refresh(teacher)
    return user_to_dict(teacher)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_to_dict(user)


@router.patch("/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: int,
    role_data: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = role_data.role
    await db.commit()
    await db.refresh(user)
    return user_to_dict(user)


# User self-service endpoints
@user_router.get("/me", response_model=UserOut)
async def get_me(
    user: User = Depends(get_telegram_user),
):
    return user_to_dict(user)


@user_router.post("/onboarding", response_model=UserOut)
async def complete_onboarding(
    data: OnboardingData,
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    user.grade = data.grade
    if data.phone:
        user.phone = data.phone
    user.onboarded = True
    # Teachers: mark phone as verified after sharing via requestContact
    if user.role == "teacher":
        user.phone_verified = True
    await db.commit()
    await db.refresh(user)
    return user_to_dict(user)


class UpdateNameData(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)


@user_router.patch("/me/profile-theme", response_model=UserOut)
async def update_profile_theme(
    data: ProfileThemeUpdate,
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    user.profile_theme = merge_profile_theme(
        user.profile_theme,
        data.model_dump(exclude_unset=True),
    )
    await db.commit()
    await db.refresh(user)
    return user_to_dict(user)


@user_router.put("/me/name", response_model=UserOut)
async def update_name(
    data: UpdateNameData,
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    user.first_name = data.first_name
    user.last_name = data.last_name
    await db.commit()
    await db.refresh(user)
    return user_to_dict(user)
