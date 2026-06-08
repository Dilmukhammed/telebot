import pytest
import pytest_asyncio
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
import os

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import Test, Registration, Subject


def create_valid_init_data(bot_token: str, user_id: int = 123456, username: str = "testuser", first_name: str = "Test"):
    """Create a valid Telegram initData string for testing."""
    user_data = json.dumps({"id": user_id, "username": username, "first_name": first_name})
    
    # Build data without hash
    data = {
        "user": user_data,
        "auth_date": str(int(datetime.now(timezone.utc).replace(tzinfo=None).timestamp())),
    }
    
    # Create hash
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    
    data["hash"] = calculated_hash
    return urlencode(data)


@pytest.fixture
def valid_init_data():
    """Return a valid init data string."""
    return create_valid_init_data(os.environ.get("BOT_TOKEN", "test-token-for-pytest"))


@pytest.fixture
def another_user_init_data():
    """Return init data for a different user."""
    return create_valid_init_data(
        os.environ.get("BOT_TOKEN", "test-token-for-pytest"),
        user_id=999999,
        username="otheruser",
        first_name="Other"
    )


@pytest_asyncio.fixture
async def setup_test_data():
    """Set up test data in the database."""
    from database import async_session_maker
    
    # Create subject
    subject = Subject(id=1, name="Mathematics")
    
    # Create test in the future
    test = Test(
        id=1,
        subject_id=1,
        datetime=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7),
        max_capacity=2,
        format="online",
        duration_minutes=60,
        is_active=True,
    )
    
    # Create test in the past
    past_test = Test(
        id=2,
        subject_id=1,
        datetime=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1),
        max_capacity=10,
        format="online",
        duration_minutes=60,
        is_active=True,
    )
    
    # Create inactive test
    inactive_test = Test(
        id=3,
        subject_id=1,
        datetime=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=14),
        max_capacity=10,
        format="online",
        duration_minutes=60,
        is_active=False,
    )
    
    async with async_session_maker() as session:
        session.add(subject)
        session.add(test)
        session.add(past_test)
        session.add(inactive_test)
        await session.commit()


@pytest.mark.asyncio
async def test_register_success(test_client, valid_init_data, setup_test_data):
    """Test successful registration returns 201."""
    response = await test_client.post(
        "/api/tests/1/register",
        headers={"X-Telegram-Init-Data": valid_init_data},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["test_id"] == 1
    assert data["status"] == "registered"
    assert "test_subject" in data


@pytest.mark.asyncio
async def test_register_double_registration(test_client, valid_init_data, setup_test_data):
    """Test double registration returns 409."""
    # First registration
    response = await test_client.post(
        "/api/tests/1/register",
        headers={"X-Telegram-Init-Data": valid_init_data},
    )
    assert response.status_code == 201
    
    # Second registration should fail
    response = await test_client.post(
        "/api/tests/1/register",
        headers={"X-Telegram-Init-Data": valid_init_data},
    )
    assert response.status_code == 409
    assert "уже зарегистрированы" in response.json()["detail"]


@pytest.mark.asyncio
async def test_register_full_test(test_client, valid_init_data, setup_test_data):
    """Test registration on a full test returns 400."""
    # Register first user
    response = await test_client.post(
        "/api/tests/1/register",
        headers={"X-Telegram-Init-Data": valid_init_data},
    )
    assert response.status_code == 201
    
    # Register second user (fills capacity of 2)
    another_init_data = create_valid_init_data(
        "test-token-for-pytest",
        user_id=654321,
        username="seconduser",
        first_name="Second"
    )
    response = await test_client.post(
        "/api/tests/1/register",
        headers={"X-Telegram-Init-Data": another_init_data},
    )
    assert response.status_code == 201
    
    # Try to register third user - should fail
    third_init_data = create_valid_init_data(
        "test-token-for-pytest",
        user_id=111111,
        username="thirduser",
        first_name="Third"
    )
    response = await test_client.post(
        "/api/tests/1/register",
        headers={"X-Telegram-Init-Data": third_init_data},
    )
    assert response.status_code == 400
    assert "заполнен" in response.json()["detail"]


@pytest.mark.asyncio
async def test_register_inactive_test(test_client, valid_init_data, setup_test_data):
    """Test registration on inactive test returns 400."""
    response = await test_client.post(
        "/api/tests/3/register",
        headers={"X-Telegram-Init-Data": valid_init_data},
    )
    assert response.status_code == 400
    assert "неактивен" in response.json()["detail"]


@pytest.mark.asyncio
async def test_cancel_registration(test_client, valid_init_data, setup_test_data):
    """Test cancel registration returns 200."""
    # First register
    response = await test_client.post(
        "/api/tests/1/register",
        headers={"X-Telegram-Init-Data": valid_init_data},
    )
    assert response.status_code == 201
    registration_id = response.json()["id"]
    
    # Cancel registration
    response = await test_client.post(
        f"/api/registrations/{registration_id}/cancel",
        headers={"X-Telegram-Init-Data": valid_init_data},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cancel_wrong_user(test_client, valid_init_data, another_user_init_data, setup_test_data):
    """Test cancel registration by wrong user returns 403."""
    # Register as first user
    response = await test_client.post(
        "/api/tests/1/register",
        headers={"X-Telegram-Init-Data": valid_init_data},
    )
    assert response.status_code == 201
    registration_id = response.json()["id"]
    
    # Try to cancel as second user
    response = await test_client.post(
        f"/api/registrations/{registration_id}/cancel",
        headers={"X-Telegram-Init-Data": another_user_init_data},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_my_registrations(test_client, valid_init_data, setup_test_data):
    """Test my registrations returns user's own registrations."""
    # Register
    await test_client.post(
        "/api/tests/1/register",
        headers={"X-Telegram-Init-Data": valid_init_data},
    )
    
    # Get my registrations
    response = await test_client.get(
        "/api/registrations/my",
        headers={"X-Telegram-Init-Data": valid_init_data},
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["test_id"] is not None  # Response has proper structure


@pytest.mark.asyncio
async def test_admin_view_registrations(test_client, setup_test_data, admin_token):
    """Test admin view registrations returns 200."""
    # Use admin endpoint with token
    response = await test_client.get(
        "/api/admin/registrations?test_id=1",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_admin_view_registrations_no_filter(test_client, setup_test_data, admin_token):
    """Test admin view registrations without filter returns 200."""
    response = await test_client.get(
        "/api/admin/registrations",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_register_nonexistent_test(test_client, valid_init_data, setup_test_data):
    """Test registration on nonexistent test returns 404."""
    response = await test_client.post(
        "/api/tests/9999/register",
        headers={"X-Telegram-Init-Data": valid_init_data},
    )
    assert response.status_code == 404
    assert "не найден" in response.json()["detail"]


@pytest.mark.asyncio
async def test_register_past_test(test_client, valid_init_data, setup_test_data):
    """Test registration on past test returns 400."""
    response = await test_client.post(
        "/api/tests/2/register",
        headers={"X-Telegram-Init-Data": valid_init_data},
    )
    assert response.status_code == 400
    assert "прошёл" in response.json()["detail"]


@pytest.mark.asyncio
async def test_cancel_nonexistent_registration(test_client, valid_init_data, setup_test_data):
    """Test cancel nonexistent registration returns 404."""
    response = await test_client.post(
        "/api/registrations/99999/cancel",
        headers={"X-Init-Data": valid_init_data},
    )
    assert response.status_code == 404