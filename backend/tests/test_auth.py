import pytest


@pytest.mark.asyncio
async def test_login_success(test_client, admin_token):
    """Test successful login with admin credentials."""
    response = await test_client.post(
        "/api/admin/login",
        json={"username": "testadmin", "password": "admin123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(test_client, admin_token):
    """Test login with wrong password returns 401."""
    response = await test_client.post(
        "/api/admin/login",
        json={"username": "testadmin", "password": "wrongpassword"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_no_user(test_client):
    """Test login with non-existent user returns 401."""
    response = await test_client.post(
        "/api/admin/login",
        json={"username": "nonexistent", "password": "whatever"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_no_token(test_client):
    """Test protected endpoint without token returns 401."""
    response = await test_client.get("/api/admin/me")
    assert response.status_code == 401  # FastAPI returns 401 for missing credentials


@pytest.mark.asyncio
async def test_protected_endpoint_with_token(test_client, admin_token):
    """Test protected endpoint with valid token returns 200."""
    response = await test_client.get(
        "/api/admin/me",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
