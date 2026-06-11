import pytest
import hmac
import hashlib
import time
import json
from urllib.parse import quote

# Import the functions to test
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from telegram_auth import validate_init_data
from config import settings


def create_valid_init_data(user_data: dict, auth_date: int | None = None) -> str:
    """
    Create a valid signed initData string for testing.

    Args:
        user_data: dict with id, username, first_name
        auth_date: auth_date timestamp (default: current time)

    Returns:
        Signed initData string ready to send to API
    """
    if auth_date is None:
        auth_date = int(time.time())

    # Build the data dict (without hash)
    data = {
        "auth_date": str(auth_date),
        "user": json.dumps(user_data, separators=(",", ":")),
    }

    # Sort keys alphabetically and create data_check_string
    sorted_keys = sorted(data.keys())
    data_check_string = "\n".join(f"{k}={data[k]}" for k in sorted_keys)

    # Generate secret_key = HMAC-SHA256("WebAppData", bot_token)
    secret_key = hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()

    # Generate hash = HMAC-SHA256(data_check_string, secret_key)
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    # Build final initData string with hash at the end
    final_data = dict(data, hash=computed_hash)
    return "&".join(f"{k}={quote(final_data[k], safe='')}" for k in sorted(final_data.keys()))


class TestValidateInitData:
    """Tests for validate_init_data function."""

    @pytest.mark.asyncio
    async def test_valid_init_data_returns_user_dict(self):
        """Test that valid initData with correct signature returns user info."""
        user_data = {
            "id": 123456789,
            "username": "testuser",
            "first_name": "Test",
        }
        init_data = create_valid_init_data(user_data)

        result = validate_init_data(init_data)

        assert result["telegram_id"] == 123456789
        assert result["username"] == "testuser"
        assert result["first_name"] == "Test"

    @pytest.mark.asyncio
    async def test_valid_init_data_with_minimal_user(self):
        """Test valid initData with only required user fields."""
        user_data = {
            "id": 987654321,
            "first_name": "Minimal",
        }
        init_data = create_valid_init_data(user_data)

        result = validate_init_data(init_data)

        assert result["telegram_id"] == 987654321
        assert result["username"] is None
        assert result["first_name"] == "Minimal"

    @pytest.mark.asyncio
    async def test_tampered_hash_raises_error(self):
        """Test that tampered hash returns ValueError."""
        user_data = {"id": 123456789, "first_name": "Test"}
        init_data = create_valid_init_data(user_data)

        # Tamper with the hash by changing last char
        tampered = init_data.replace("hash=", "hash=tampered")
        assert "hash=tampered" in tampered

        with pytest.raises(ValueError, match="Invalid hash"):
            validate_init_data(tampered)

    @pytest.mark.asyncio
    async def test_expired_auth_date_raises_error(self):
        """Test that initData older than 1 hour raises error."""
        user_data = {"id": 123456789, "first_name": "Test"}
        # auth_date from 2 hours ago (exceeds 1-hour window)
        old_auth_date = int(time.time()) - (3600 * 2)
        init_data = create_valid_init_data(user_data, auth_date=old_auth_date)

        with pytest.raises(ValueError, match="Data expired"):
            validate_init_data(init_data)

    @pytest.mark.asyncio
    async def test_exactly_1_hour_old_is_valid(self):
        """Test that exactly 1 hour old is still valid (boundary test)."""
        user_data = {"id": 123456789, "first_name": "Test"}
        # Exactly 1 hour ago minus 10 seconds (should still be valid as we use > not >=)
        old_auth_date = int(time.time()) - 3590
        init_data = create_valid_init_data(user_data, auth_date=old_auth_date)

        result = validate_init_data(init_data)
        assert result["telegram_id"] == 123456789

    @pytest.mark.asyncio
    async def test_missing_hash_raises_error(self):
        """Test that initData without hash raises error."""
        # Create data string without hash
        user_data = {"id": 123456789, "first_name": "Test", "auth_date": str(int(time.time()))}
        init_data_no_hash = f"auth_date={user_data['auth_date']}&user={quote(json.dumps({'id': 123456789, 'first_name': 'Test'}, separators=(',', ':')), safe='')}"

        with pytest.raises(ValueError, match="No hash"):
            validate_init_data(init_data_no_hash)

    @pytest.mark.asyncio
    async def test_modified_data_raises_error(self):
        """Test that modified data (other than hash) raises error."""
        user_data = {"id": 123456789, "first_name": "Test"}
        init_data = create_valid_init_data(user_data)

        # Modify user id in the string
        tampered = init_data.replace("123456789", "999999999")

        with pytest.raises(ValueError, match="Invalid hash"):
            validate_init_data(tampered)


class TestGetTelegramUserDependency:
    """Tests for get_telegram_user FastAPI dependency."""

    @pytest.mark.asyncio
    async def test_missing_header_returns_401(self, monkeypatch):
        """Test that missing X-Telegram-Init-Data header returns 401."""
        monkeypatch.setattr("api.deps.settings.DEV_MODE", False)

        # Create a test endpoint that uses the dependency
        from fastapi import FastAPI, Depends
        from api.deps import get_telegram_user
        from httpx import AsyncClient, ASGITransport

        app = FastAPI()
        @app.get("/test-telegram")
        async def test_endpoint(user = Depends(get_telegram_user)):
            return {"telegram_id": user.telegram_id}

        # Don't include the header
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/test-telegram")
        assert response.status_code == 401
        assert "Missing init data" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_valid_init_data_returns_user(self, monkeypatch):
        """Test that valid initData returns user info."""
        monkeypatch.setattr("api.deps.settings.DEV_MODE", False)

        from fastapi import FastAPI, Depends
        from api.deps import get_telegram_user
        from httpx import AsyncClient, ASGITransport

        app = FastAPI()
        @app.get("/test-telegram")
        async def test_endpoint(user = Depends(get_telegram_user)):
            return {"telegram_id": user.telegram_id, "username": user.username, "first_name": user.first_name}

        user_data = {"id": 123456789, "username": "testuser", "first_name": "Test"}
        init_data = create_valid_init_data(user_data)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(
                "/test-telegram",
                headers={"X-Telegram-Init-Data": init_data},
            )
        assert response.status_code == 200
        result = response.json()
        assert result["telegram_id"] == 123456789

    @pytest.mark.asyncio
    async def test_invalid_hash_returns_401(self, monkeypatch):
        """Test that invalid hash returns 401."""
        monkeypatch.setattr("api.deps.settings.DEV_MODE", False)

        from fastapi import FastAPI, Depends
        from api.deps import get_telegram_user
        from httpx import AsyncClient, ASGITransport

        app = FastAPI()
        @app.get("/test-telegram")
        async def test_endpoint(user = Depends(get_telegram_user)):
            return {"telegram_id": user.telegram_id}

        user_data = {"id": 123456789, "first_name": "Test"}
        init_data = create_valid_init_data(user_data)
        init_data = init_data.replace("hash=", "hash=invalid")

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(
                "/test-telegram",
                headers={"X-Telegram-Init-Data": init_data},
            )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_data_returns_401(self, monkeypatch):
        """Test that expired initData returns 401."""
        monkeypatch.setattr("api.deps.settings.DEV_MODE", False)

        from fastapi import FastAPI, Depends
        from api.deps import get_telegram_user
        from httpx import AsyncClient, ASGITransport

        app = FastAPI()
        @app.get("/test-telegram")
        async def test_endpoint(user = Depends(get_telegram_user)):
            return {"telegram_id": user.telegram_id}

        user_data = {"id": 123456789, "first_name": "Test"}
        old_auth_date = int(time.time()) - (3600 * 2)
        init_data = create_valid_init_data(user_data, auth_date=old_auth_date)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(
                "/test-telegram",
                headers={"X-Telegram-Init-Data": init_data},
            )
        assert response.status_code == 401
        assert "Missing init data" in response.json()["detail"]