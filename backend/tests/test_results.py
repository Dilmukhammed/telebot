import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta

from models import Subject, Test, Registration, Result, Admin, User
from auth import hash_password, create_access_token


@pytest.mark.asyncio
async def test_admin_create_result(test_client: AsyncClient, admin_token, test_test):
    """Admin can create a result → 201."""
    from database import async_session_maker
    
    async with async_session_maker() as session:
        user = User(telegram_id=123456, username="student1", first_name="Student")
        session.add(user)
        await session.flush()
        
        registration = Registration(
            test_id=test_test.id,
            telegram_id=user.telegram_id,
            username=user.username,
            first_name=user.first_name,
            status="registered"
        )
        session.add(registration)
        await session.commit()
        await session.refresh(registration)
        registration_id = registration.id

    response = await test_client.post(
        "/api/admin/results",
        json={"registration_id": registration_id, "score": 85, "max_score": 100, "comment": "Good work"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["score"] == 85
    assert data["max_score"] == 100
    assert data["registration_id"] == registration_id
    assert data["test_subject"] == "Математика"


@pytest.mark.asyncio
async def test_student_sees_own_result(test_client: AsyncClient, test_test):
    """Student sees own result → 200, contains score."""
    from database import async_session_maker
    from tests.test_telegram_auth import create_valid_init_data
    
    async with async_session_maker() as session:
        user = User(telegram_id=123456, username="student1", first_name="Student")
        session.add(user)
        await session.flush()
        
        registration = Registration(
            test_id=test_test.id,
            telegram_id=user.telegram_id,
            username=user.username,
            first_name=user.first_name,
            status="registered"
        )
        session.add(registration)
        await session.flush()
        
        result = Result(
            registration_id=registration.id,
            score=85,
            max_score=100,
            comment="Good work"
        )
        session.add(result)
        await session.commit()

    init_data = create_valid_init_data({"id": 123456, "username": "student1", "first_name": "Student"})

    response = await test_client.get(
        "/api/results/my",
        headers={"X-Telegram-Init-Data": init_data},
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["score"] == 85
    assert data[0]["max_score"] == 100
    assert data[0]["comment"] == "Good work"


@pytest.mark.asyncio
async def test_student_cannot_see_another_results(test_client: AsyncClient, test_test):
    """Student cannot see another's results - verify isolation."""
    from database import async_session_maker
    from tests.test_telegram_auth import create_valid_init_data
    
    async with async_session_maker() as session:
        user1 = User(telegram_id=123456, username="student1", first_name="Student")
        session.add(user1)
        await session.flush()
        
        registration = Registration(
            test_id=test_test.id,
            telegram_id=user1.telegram_id,
            username=user1.username,
            first_name=user1.first_name,
            status="registered"
        )
        session.add(registration)
        await session.flush()
        
        result = Result(
            registration_id=registration.id,
            score=85,
            max_score=100,
            comment="Good work"
        )
        session.add(result)
        await session.commit()

    init_data_other = create_valid_init_data({"id": 999999, "username": "otheruser", "first_name": "Other"})

    response = await test_client.get(
        "/api/results/my",
        headers={"X-Telegram-Init-Data": init_data_other},
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0


@pytest.mark.asyncio
async def test_update_result(test_client: AsyncClient, admin_token, test_test):
    """Admin can update a result → 200."""
    from database import async_session_maker
    
    async with async_session_maker() as session:
        user = User(telegram_id=123456, username="student1", first_name="Student")
        session.add(user)
        await session.flush()
        
        registration = Registration(
            test_id=test_test.id,
            telegram_id=user.telegram_id,
            username=user.username,
            first_name=user.first_name,
            status="registered"
        )
        session.add(registration)
        await session.flush()
        
        result = Result(
            registration_id=registration.id,
            score=85,
            max_score=100,
            comment="Good work"
        )
        session.add(result)
        await session.commit()
        await session.refresh(result)
        result_id = result.id

    response = await test_client.put(
        f"/api/admin/results/{result_id}",
        json={"score": 95},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["score"] == 95
    assert data["max_score"] == 100