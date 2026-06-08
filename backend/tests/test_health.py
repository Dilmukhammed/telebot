import pytest


@pytest.mark.asyncio
async def test_health(test_client):
    """Smoke test - verifies test infrastructure works."""
    assert True is True