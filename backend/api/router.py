from fastapi import APIRouter, Depends

from api.deps import require_admin
from api.admin_auth import router as admin_auth_router
from api.registrations import router as registrations_router
from api.results import router as results_router
from api.tests import router as tests_router
from api.payment import router as payment_router
from api.users import router as users_router, user_router
from api.dashboard import router as dashboard_router
from api.courses import router as courses_router
from api.teacher import router as teacher_router
from api.admin import router as admin_panel_router
from api.materials import router as materials_router

api_router = APIRouter()

api_router.include_router(payment_router)


@api_router.get("/health")
async def health_check():
    return {"status": "ok"}


@api_router.get("/scheduler-status")
async def scheduler_status(admin=Depends(require_admin)):
    from scheduler import scheduler
    jobs = scheduler.get_jobs()
    return {
        "running": scheduler.running,
        "jobs": [{"id": j.id, "next_run": str(j.next_run_time)} for j in jobs]
    }


api_router.include_router(admin_auth_router)
api_router.include_router(registrations_router)
api_router.include_router(results_router)
api_router.include_router(tests_router)
api_router.include_router(users_router)
api_router.include_router(user_router)
api_router.include_router(dashboard_router)
api_router.include_router(courses_router)  # This now includes /courses/lessons/{lesson_id}
api_router.include_router(teacher_router)
api_router.include_router(admin_panel_router)
api_router.include_router(materials_router)