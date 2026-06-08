from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Admin
from auth import verify_password, create_access_token
from schemas import AdminLogin, AdminToken
from api.deps import get_current_admin


router = APIRouter(prefix="/admin", tags=["admin auth"])


@router.post("/login", response_model=AdminToken)
async def login(
    admin_login: AdminLogin,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Admin).where(Admin.username == admin_login.username))
    admin = result.scalar_one_or_none()

    if not admin or not verify_password(admin_login.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    access_token = create_access_token(data={"sub": admin.username})
    return AdminToken(access_token=access_token)


@router.get("/me")
async def get_me(admin: Admin = Depends(get_current_admin)):
    return {"username": admin.username}
