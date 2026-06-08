import pytest
from httpx import AsyncClient, ASGITransport


@pytest.mark.asyncio
async def test_payment_create_stub(test_client):
    """Test POST /api/payment/create returns stub response."""
    response = await test_client.post("/api/payment/create")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "stub"
    assert data["payment_url"] is None
    assert data["message"] == "Оплата временно недоступна"


@pytest.mark.asyncio
async def test_payment_create_no_body_required(test_client):
    """Test that payment create endpoint requires no body."""
    response = await test_client.post("/api/payment/create", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "stub"


@pytest.mark.asyncio
async def test_payment_create_accepts_any_body(test_client):
    """Test that payment create accepts any payload without error."""
    response = await test_client.post(
        "/api/payment/create",
        json={"amount": 100, "currency": "RUB", "test_id": 1}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "stub"
    assert data["payment_url"] is None