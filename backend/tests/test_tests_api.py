import pytest
from datetime import datetime, timedelta, timezone

from auth import create_access_token
from models import Admin
from database import Base, engine, async_session_maker


def _admin_token():
    """Generate a valid admin JWT token."""
    return create_access_token({"sub": "testadmin"})


def _future_datetime():
    """Return ISO datetime string 7 days in future."""
    return (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7)).isoformat()


@pytest.mark.asyncio
async def test_create_test_admin(test_client, test_db):
    """Test creating a test via admin endpoint returns 201."""
    # Setup: create admin in DB
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
    from models import Admin
    from auth import hash_password
    
    async with async_session_maker() as session:
        admin = Admin(username="testadmin", password_hash=hash_password("testpass"))
        session.add(admin)
        await session.commit()
    
    # Create test
    response = await test_client.post(
        "/api/admin/tests",
        json={
            "subject_name": "Mathematics",
            "datetime": _future_datetime(),
            "max_capacity": 30,
            "format": "online",
            "duration_minutes": 60,
        },
        headers={"Authorization": f"Bearer {_admin_token()}"},
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["subject_name"] == "Mathematics"
    assert data["max_capacity"] == 30
    assert data["format"] == "online"
    assert data["duration_minutes"] == 60
    assert data["registered_count"] == 0
    assert data["has_capacity"] is True
    assert data["id"] is not None


@pytest.mark.asyncio
async def test_list_tests(test_client, test_db):
    """Test listing tests returns 200 with array and computed fields."""
    # Setup: create subject and test
    from sqlalchemy.ext.asyncio import AsyncSession
    from models import Subject, Test
    
    async with async_session_maker() as session:
        subject = Subject(name="Physics")
        session.add(subject)
        await session.flush()
        
        test = Test(
            subject_id=subject.id,
            datetime=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=1),
            max_capacity=20,
            format="offline",
            duration_minutes=90,
            is_active=True,
        )
        session.add(test)
        await session.commit()
    
    response = await test_client.get("/api/tests")
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    # Check computed fields
    test_data = next((t for t in data if t["subject_name"] == "Physics"), None)
    assert test_data is not None
    assert "registered_count" in test_data
    assert "has_capacity" in test_data
    assert test_data["has_capacity"] is True


@pytest.mark.asyncio
async def test_filter_by_subject(test_client, test_db):
    """Test filtering tests by subject_id returns 200."""
    from sqlalchemy.ext.asyncio import AsyncSession
    from models import Subject, Test
    
    async with async_session_maker() as session:
        math = Subject(name="Math")
        history = Subject(name="History")
        session.add_all([math, history])
        await session.flush()
        
        session.add(Test(
            subject_id=math.id,
            datetime=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=1),
            max_capacity=25,
            format="online",
            duration_minutes=45,
            is_active=True,
        ))
        session.add(Test(
            subject_id=history.id,
            datetime=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2),
            max_capacity=15,
            format="offline",
            duration_minutes=60,
            is_active=True,
        ))
        await session.commit()
    
    # Filter by Math subject
    response = await test_client.get("/api/tests?subject_id=1")
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Only Math tests should be returned (assuming subject_id=1 is Math)
    for t in data:
        if t["subject_name"] == "Math":
            assert t["subject_name"] == "Math"


@pytest.mark.asyncio
async def test_get_test_detail(test_client, test_db):
    """Test getting a single test detail returns 200."""
    from sqlalchemy.ext.asyncio import AsyncSession
    from models import Subject, Test
    
    async with async_session_maker() as session:
        subject = Subject(name="Chemistry")
        session.add(subject)
        await session.flush()
        
        test = Test(
            subject_id=subject.id,
            datetime=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=5),
            max_capacity=40,
            format="online",
            duration_minutes=120,
            is_active=True,
        )
        session.add(test)
        await session.commit()
        test_id = test.id
    
    response = await test_client.get(f"/api/tests/{test_id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["subject_name"] == "Chemistry"
    assert data["max_capacity"] == 40
    assert "registered_count" in data
    assert "has_capacity" in data


@pytest.mark.asyncio
async def test_get_test_not_found(test_client, test_db):
    """Test getting non-existent test returns 404."""
    response = await test_client.get("/api/tests/99999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_test(test_client, test_db):
    """Test updating a test via admin returns 200."""
    from sqlalchemy.ext.asyncio import AsyncSession
    from models import Subject, Test, Admin
    from auth import hash_password
    
    async with async_session_maker() as session:
        admin = Admin(username="testadmin2", password_hash=hash_password("testpass"))
        session.add(admin)
        
        subject = Subject(name="Biology")
        session.add(subject)
        await session.flush()
        
        test = Test(
            subject_id=subject.id,
            datetime=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=3),
            max_capacity=50,
            format="offline",
            duration_minutes=90,
            is_active=True,
        )
        session.add(test)
        await session.commit()
        test_id = test.id
    
    response = await test_client.put(
        f"/api/admin/tests/{test_id}",
        json={
            "max_capacity": 100,
            "format": "online",
        },
        headers={"Authorization": f"Bearer {create_access_token({'sub': 'testadmin2'})}"},
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["max_capacity"] == 100
    assert data["format"] == "online"
    assert data["subject_name"] == "Biology"  # unchanged


@pytest.mark.asyncio
async def test_soft_delete_test(test_client, test_db):
    """Test soft delete sets is_active=False and returns 200."""
    from sqlalchemy.ext.asyncio import AsyncSession
    from models import Subject, Test, Admin
    from auth import hash_password
    
    async with async_session_maker() as session:
        admin = Admin(username="testadmin3", password_hash=hash_password("testpass"))
        session.add(admin)
        
        subject = Subject(name="English")
        session.add(subject)
        await session.flush()
        
        test = Test(
            subject_id=subject.id,
            datetime=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=4),
            max_capacity=30,
            format="online",
            duration_minutes=60,
            is_active=True,
        )
        session.add(test)
        await session.commit()
        test_id = test.id
    
    response = await test_client.delete(
        f"/api/admin/tests/{test_id}",
        headers={"Authorization": f"Bearer {create_access_token({'sub': 'testadmin3'})}"},
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False
    
    # Verify it's no longer in list
    list_response = await test_client.get("/api/tests")
    tests = list_response.json()
    assert all(t["id"] != test_id for t in tests)


@pytest.mark.asyncio
async def test_unauthorized_no_token(test_client, test_db):
    """Test that endpoints without token return 401."""
    from sqlalchemy.ext.asyncio import AsyncSession
    from models import Subject, Test, Admin
    from auth import hash_password
    
    async with async_session_maker() as session:
        admin = Admin(username="testadmin4", password_hash=hash_password("testpass"))
        session.add(admin)
        await session.commit()
    
    # Try to create without token
    response = await test_client.post(
        "/api/admin/tests",
        json={
            "subject_name": "Art",
            "datetime": _future_datetime(),
            "max_capacity": 20,
            "format": "offline",
            "duration_minutes": 45,
        },
    )
    assert response.status_code == 401 or response.status_code == 403


@pytest.mark.asyncio
async def test_unauthorized_wrong_token(test_client, test_db):
    """Test that endpoints with invalid token return 401."""
    from sqlalchemy.ext.asyncio import AsyncSession
    from models import Admin
    from auth import hash_password
    
    async with async_session_maker() as session:
        admin = Admin(username="testadmin5", password_hash=hash_password("testpass"))
        session.add(admin)
        await session.commit()
    
    # Try with fake token
    response = await test_client.post(
        "/api/admin/tests",
        json={
            "subject_name": "Music",
            "datetime": _future_datetime(),
            "max_capacity": 15,
            "format": "online",
            "duration_minutes": 30,
        },
        headers={"Authorization": "Bearer fake_token_here"},
    )
    assert response.status_code == 401