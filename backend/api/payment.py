from fastapi import APIRouter

router = APIRouter(prefix="/payment", tags=["payment"])


@router.post("/create")
async def create_payment():
    """Stub endpoint for payment creation."""
    return {
        "status": "stub",
        "payment_url": None,
        "message": "Оплата временно недоступна"
    }