import time
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Admin
from auth import verify_password, create_access_token
from schemas import AdminLogin, AdminToken
from api.deps import get_current_admin


router = APIRouter(prefix="/admin", tags=["admin auth"])

# Simple rate limiter: track failed attempts per IP
_login_attempts: dict[str, list[float]] = defaultdict(list)
_MAX_ATTEMPTS = 5
_LOCKOUT_SECONDS = 300  # 5 minutes


def _check_rate_limit(ip: str):
    """Check if IP is rate-limited. Raises HTTPException if locked out."""
    now = time.time()
    # Clean old entries
    _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < _LOCKOUT_SECONDS]
    if len(_login_attempts[ip]) >= _MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again in 5 minutes.")


def _record_failed_attempt(ip: str):
    """Record a failed login attempt for the given IP."""
    _login_attempts[ip].append(time.time())


def _clear_attempts(ip: str):
    """Clear failed attempts for IP after successful login."""
    _login_attempts.pop(ip, None)


@router.post("/login", response_model=AdminToken)
async def login(
    admin_login: AdminLogin,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(ip)

    result = await db.execute(select(Admin).where(Admin.username == admin_login.username))
    admin = result.scalar_one_or_none()

    if not admin or not verify_password(admin_login.password, admin.password_hash):
        _record_failed_attempt(ip)
        raise HTTPException(status_code=401, detail="Invalid username or password")

    _clear_attempts(ip)
    access_token = create_access_token(data={"sub": admin.username})
    return AdminToken(access_token=access_token)


@router.get("/me")
async def get_me(admin: Admin = Depends(get_current_admin)):
    return {"username": admin.username}
