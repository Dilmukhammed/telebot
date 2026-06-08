from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from database import get_db
from models import Result, Registration, Test, Subject, User
from schemas import ResultOut, ResultCreate, ResultUpdate
from api.deps import get_current_admin, get_telegram_user


router = APIRouter(prefix="", tags=["results"])


@router.get("/results/my", response_model=List[ResultOut])
async def get_my_results(
    telegram_user: User = Depends(get_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current student's own results."""
    telegram_id = telegram_user.telegram_id

    stmt = (
        select(Result, Registration, Test, Subject)
        .join(Registration, Result.registration_id == Registration.id)
        .join(Test, Registration.test_id == Test.id)
        .join(Subject, Test.subject_id == Subject.id)
        .where(Registration.telegram_id == telegram_id)
        .order_by(Result.created_at.desc())
    )
    rows = await db.execute(stmt)

    return [
        ResultOut(
            id=r.id,
            registration_id=r.registration_id,
            test_subject=s.name,
            test_datetime=t.datetime.isoformat(),
            score=r.score,
            max_score=r.max_score,
            comment=r.comment,
            created_at=r.created_at.isoformat(),
        )
        for r, reg, t, s in rows.all()
    ]


@router.post(
    "/admin/results",
    response_model=ResultOut,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_result(
    result_in: ResultCreate,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a result for a registration (admin only)."""
    # Verify registration exists
    reg_stmt = select(Registration).where(Registration.id == result_in.registration_id)
    reg_result = await db.execute(reg_stmt)
    registration = reg_result.scalar_one_or_none()

    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")

    # Check no existing result for this registration
    existing_stmt = select(Result).where(Result.registration_id == result_in.registration_id)
    existing_result = await db.execute(existing_stmt)
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Result already exists for this registration")

    # Create result
    db_result = Result(
        registration_id=result_in.registration_id,
        score=result_in.score,
        max_score=result_in.max_score,
        comment=result_in.comment,
    )
    db.add(db_result)
    await db.commit()
    await db.refresh(db_result)

    # Reload with relationships
    full_stmt = (
        select(Result)
        .where(Result.id == db_result.id)
        .options(selectinload(Result.registration).selectinload(Registration.test).selectinload(Test.subject))
    )
    full_result = await db.execute(full_stmt)
    r = full_result.scalar_one()

    return ResultOut(
        id=r.id,
        registration_id=r.registration_id,
        test_subject=r.registration.test.subject.name,
        test_datetime=r.registration.test.datetime.isoformat(),
        score=r.score,
        max_score=r.max_score,
        comment=r.comment,
        created_at=r.created_at.isoformat(),
    )


@router.put("/admin/results/{result_id}", response_model=ResultOut)
async def admin_update_result(
    result_id: int,
    result_in: ResultUpdate,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a result (admin only)."""
    stmt = select(Result).where(Result.id == result_id)
    result = await db.execute(stmt)
    db_result = result.scalar_one_or_none()

    if not db_result:
        raise HTTPException(status_code=404, detail="Result not found")

    # Update only provided fields
    update_data = result_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_result, field, value)

    await db.commit()
    await db.refresh(db_result)

    # Reload with relationships
    full_stmt = (
        select(Result)
        .where(Result.id == db_result.id)
        .options(selectinload(Result.registration).selectinload(Registration.test).selectinload(Test.subject))
    )
    full_result = await db.execute(full_stmt)
    r = full_result.scalar_one()

    return ResultOut(
        id=r.id,
        registration_id=r.registration_id,
        test_subject=r.registration.test.subject.name,
        test_datetime=r.registration.test.datetime.isoformat(),
        score=r.score,
        max_score=r.max_score,
        comment=r.comment,
        created_at=r.created_at.isoformat(),
    )