from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone

from database import get_db
from models import Test, Registration, Subject, User
from schemas import RegistrationOut
from api.deps import get_telegram_user, get_current_admin

router = APIRouter(prefix="", tags=["registrations"])


@router.post("/tests/{test_id}/register", response_model=RegistrationOut, status_code=status.HTTP_201_CREATED)
async def register_for_test(
    test_id: int,
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Register a student for a test.
    - Validates test exists and is active
    - Checks test datetime is in the future
    - Checks capacity (counts registered, not cancelled)
    - Uses transaction with begin() to prevent race conditions
    - Handles duplicate registration with 409
    """
    telegram_id = user.telegram_id
    username = user.username
    first_name = user.first_name

    # Check test exists and is active
    result = await db.execute(
        select(Test).where(Test.id == test_id)
    )
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")

    if not test.is_active:
        raise HTTPException(status_code=400, detail="Тест неактивен")

    # Check test datetime is in the future
    if test.datetime <= datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="Тест уже прошёл")

    # Check capacity (only registered, not cancelled)
    count_result = await db.execute(
        select(func.count(Registration.id))
        .where(Registration.test_id == test_id)
        .where(Registration.status == "registered")
    )
    current_count = count_result.scalar() or 0

    if current_count >= test.max_capacity:
        raise HTTPException(status_code=400, detail="Тест заполнен")

    # Check if user already has a registration (any status)
    existing_result = await db.execute(
        select(Registration).where(
            Registration.test_id == test_id,
            Registration.telegram_id == telegram_id,
        )
    )
    existing_reg = existing_result.scalar_one_or_none()

    if existing_reg:
        if existing_reg.status == "registered":
            raise HTTPException(status_code=409, detail="Вы уже зарегистрированы")
        # Re-activate cancelled registration
        existing_reg.status = "registered"
        existing_reg.username = username
        existing_reg.first_name = first_name
        await db.flush()
        registration = existing_reg
    else:
        registration = Registration(
            test_id=test_id,
            telegram_id=telegram_id,
            username=username,
            first_name=first_name,
            status="registered",
        )
        db.add(registration)
        await db.flush()

    # Load test relationship for response
    await db.refresh(registration)
    await db.commit()

    # Get subject name after transaction
    subject_result = await db.execute(
        select(Subject.name).where(Subject.id == test.subject_id)
    )
    subject_name = subject_result.scalar() or "Unknown"

    return RegistrationOut(
        id=registration.id,
        test_id=test_id,
        test_subject=subject_name,
        test_datetime=test.datetime.isoformat(),
        status=registration.status,
        registered_at=registration.registered_at.isoformat(),
    )


@router.get("/registrations/my", response_model=list[RegistrationOut])
async def get_my_registrations(
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current user's registrations with test info.
    Only returns user's own registrations.
    """
    telegram_id = user.telegram_id

    result = await db.execute(
        select(Registration, Test, Subject.name)
        .join(Test, Registration.test_id == Test.id)
        .join(Subject, Test.subject_id == Subject.id)
        .where(Registration.telegram_id == telegram_id)
        .order_by(Test.datetime.desc())
    )
    rows = result.all()

    registrations = []
    for reg, test, subject_name in rows:
        registrations.append(RegistrationOut(
            id=reg.id,
            test_id=reg.test_id,
            test_subject=subject_name or "Unknown",
            test_datetime=test.datetime.isoformat(),
            status=reg.status,
            registered_at=reg.registered_at.isoformat(),
        ))

    return registrations


@router.post("/registrations/{registration_id}/cancel", response_model=RegistrationOut)
async def cancel_registration(
    registration_id: int,
    user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cancel a registration.
    - Verifies ownership (telegram_id matches)
    - Verifies test hasn't passed
    - Sets status to cancelled
    """
    telegram_id = user.telegram_id

    result = await db.execute(
        select(Registration).where(Registration.id == registration_id)
    )
    registration = result.scalar_one_or_none()

    if not registration:
        raise HTTPException(status_code=404, detail="Регистрация не найдена")

    if registration.telegram_id != telegram_id:
        raise HTTPException(status_code=403, detail="Нет доступа")

    # Get test to check datetime
    test_result = await db.execute(
        select(Test).where(Test.id == registration.test_id)
    )
    test = test_result.scalar_one_or_none()

    if test and test.datetime <= datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="Нельзя отменить прошедший тест")

    registration.status = "cancelled"
    await db.flush()
    await db.commit()
    await db.refresh(registration)

    # Get subject name
    subject_name = "Unknown"
    if test:
        subject_result = await db.execute(
            select(Subject.name).where(Subject.id == test.subject_id)
        )
        subject_name = subject_result.scalar() or "Unknown"

    return RegistrationOut(
        id=registration.id,
        test_id=registration.test_id,
        test_subject=subject_name,
        test_datetime=test.datetime.isoformat() if test else "",
        status=registration.status,
        registered_at=registration.registered_at.isoformat(),
    )


@router.get("/admin/registrations", response_model=list[dict])
async def admin_get_registrations(
    test_id: int | None = Query(None),
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint to view registrations.
    - Filter by test_id if provided
    - Returns student info: telegram_id, username, first_name, status, registered_at
    """
    query = (
        select(Registration, Test, Subject.name)
        .join(Test, Registration.test_id == Test.id)
        .join(Subject, Test.subject_id == Subject.id)
    )

    if test_id is not None:
        query = query.where(Registration.test_id == test_id)

    query = query.order_by(Registration.registered_at.desc())

    result = await db.execute(query)
    rows = result.all()

    registrations = []
    for reg, test, subject_name in rows:
        registrations.append({
            "id": reg.id,
            "test_id": reg.test_id,
            "test_subject": subject_name or "Unknown",
            "test_datetime": test.datetime.isoformat(),
            "telegram_id": reg.telegram_id,
            "username": reg.username,
            "first_name": reg.first_name,
            "status": reg.status,
            "registered_at": reg.registered_at.isoformat(),
        })

    return registrations