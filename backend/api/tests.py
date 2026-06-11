from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional

from database import get_db
from models import Test, Subject, Registration
from schemas import TestOut, TestCreate, TestUpdate, SubjectUpdate
from subject_drive_folder import sync_subject_drive_folder
from api.deps import get_current_admin

router = APIRouter(prefix="", tags=["tests"])


def _test_to_out(test: Test, registered_count: int) -> TestOut:
    """Convert Test model to TestOut schema with computed fields."""
    return TestOut(
        id=test.id,
        subject_name=test.subject.name,
        datetime=test.datetime.isoformat(),
        max_capacity=test.max_capacity,
        format=test.format,
        duration_minutes=test.duration_minutes,
        registered_count=registered_count,
        has_capacity=registered_count < test.max_capacity,
        is_active=test.is_active,
    )


@router.get("/tests", response_model=list[TestOut])
async def list_tests(
    subject_id: Optional[int] = Query(None, description="Filter by subject ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    List active tests with computed registered_count and has_capacity.
    Only returns is_active=True tests ordered by datetime ascending.
    """
    # Fetch tests with subject eagerly loaded
    query = select(Test).options(selectinload(Test.subject)).where(Test.is_active == True)

    if subject_id is not None:
        query = query.where(Test.subject_id == subject_id)

    query = query.order_by(Test.datetime.asc())

    result = await db.execute(query)
    tests = result.scalars().all()

    # Batch-fetch registration counts
    test_ids = [t.id for t in tests]
    reg_counts: dict[int, int] = {}
    if test_ids:
        reg_result = await db.execute(
            select(Registration.test_id, func.count(Registration.id))
            .where(Registration.test_id.in_(test_ids))
            .where(Registration.status == "registered")
            .group_by(Registration.test_id)
        )
        reg_counts = dict(reg_result.all())

    out_list = []
    for test in tests:
        registered_count = reg_counts.get(test.id, 0)
        out_list.append(_test_to_out(test, registered_count))

    return out_list


@router.get("/tests/{test_id}", response_model=TestOut)
async def get_test(
    test_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a single test by ID with computed fields."""
    result = await db.execute(
        select(Test).options(selectinload(Test.subject)).where(Test.id == test_id)
    )
    test = result.scalar_one_or_none()
    
    if not test or not test.is_active:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Count registrations
    reg_count_result = await db.execute(
        select(func.count(Registration.id))
        .where(Registration.test_id == test.id)
        .where(Registration.status == "registered")
    )
    registered_count = reg_count_result.scalar() or 0
    
    return _test_to_out(test, registered_count)


@router.post("/admin/tests", response_model=TestOut, status_code=status.HTTP_201_CREATED)
async def create_test(
    test_data: TestCreate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """
    Create a new test (admin only).
    Finds or creates Subject by name.
    """
    # Find or create subject
    subject_result = await db.execute(
        select(Subject).where(Subject.name == test_data.subject_name, Subject.is_deleted == False)
    )
    subject = subject_result.scalar_one_or_none()
    
    if not subject:
        subject = Subject(name=test_data.subject_name)
        db.add(subject)
        await db.flush()
    
    # Parse datetime
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(test_data.datetime)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный формат даты. Используйте ISO формат (например, 2025-06-01T10:00:00)"
        )
    
    # Create test
    test = Test(
        subject_id=subject.id,
        datetime=dt,
        max_capacity=test_data.max_capacity,
        format=test_data.format,
        duration_minutes=test_data.duration_minutes,
        is_active=True,
    )
    db.add(test)
    await db.flush()
    await db.refresh(test)
    
    # Load subject relationship
    await db.refresh(test, ["subject"])
    await db.commit()
    
    return _test_to_out(test, registered_count=0)


@router.put("/admin/tests/{test_id}", response_model=TestOut)
async def update_test(
    test_id: int,
    test_data: TestUpdate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Update a test (admin only). Only provided fields are updated."""
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Update provided fields
    update_dict = test_data.model_dump(exclude_unset=True)
    
    if "subject_name" in update_dict:
        subject_name = update_dict.pop("subject_name")
        # Find or create subject
        subject_result = await db.execute(
            select(Subject).where(Subject.name == subject_name, Subject.is_deleted == False)
        )
        subject = subject_result.scalar_one_or_none()
        if not subject:
            subject = Subject(name=subject_name)
            db.add(subject)
            await db.flush()
        test.subject_id = subject.id
    
    if "datetime" in update_dict:
        from datetime import datetime
        try:
            test.datetime = datetime.fromisoformat(update_dict.pop("datetime"))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат даты. Используйте ISO формат (например, 2025-06-01T10:00:00)"
            )
    
    if "max_capacity" in update_dict:
        test.max_capacity = update_dict["max_capacity"]
    
    if "format" in update_dict:
        test.format = update_dict["format"]
    
    if "duration_minutes" in update_dict:
        test.duration_minutes = update_dict["duration_minutes"]
    
    if "is_active" in update_dict:
        test.is_active = update_dict["is_active"]
    
    await db.flush()
    await db.refresh(test)
    await db.refresh(test, ["subject"])
    await db.commit()
    
    # Get registered count
    reg_count_result = await db.execute(
        select(func.count(Registration.id))
        .where(Registration.test_id == test.id)
        .where(Registration.status == "registered")
    )
    registered_count = reg_count_result.scalar() or 0
    
    return _test_to_out(test, registered_count)


@router.delete("/admin/tests/{test_id}", response_model=TestOut)
async def delete_test(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Soft delete a test - sets is_active=False (admin only)."""
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    test.is_active = False
    await db.flush()
    await db.refresh(test, ["subject"])
    await db.commit()

    # Get registered count
    reg_count_result = await db.execute(
        select(func.count(Registration.id))
        .where(Registration.test_id == test.id)
        .where(Registration.status == "registered")
    )
    registered_count = reg_count_result.scalar() or 0

    return _test_to_out(test, registered_count)


@router.patch("/admin/subjects/{subject_id}", response_model=dict)
async def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Update a subject/course (admin only). Only provided fields are updated."""
    result = await db.execute(select(Subject).where(Subject.id == subject_id, Subject.is_deleted == False))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    update_dict = data.model_dump(exclude_unset=True)

    if "name" in update_dict:
        subject.name = update_dict["name"]
    if "description" in update_dict:
        subject.description = update_dict["description"]
    if "start_date" in update_dict:
        from datetime import datetime
        sd = update_dict["start_date"]
        if sd is None:
            subject.start_date = None
        else:
            try:
                subject.start_date = datetime.strptime(sd, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    if "duration_weeks" in update_dict:
        subject.duration_weeks = update_dict["duration_weeks"]
    if "duration_minutes" in update_dict:
        subject.duration_minutes = update_dict["duration_minutes"]

    await db.commit()
    await db.refresh(subject)
    await sync_subject_drive_folder(db, subject)
    await db.commit()

    return {
        "id": subject.id,
        "name": subject.name,
        "description": subject.description,
        "start_date": subject.start_date.strftime("%Y-%m-%d") if subject.start_date else None,
        "duration_weeks": subject.duration_weeks,
        "duration_minutes": subject.duration_minutes,
    }