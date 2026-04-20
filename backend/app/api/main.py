from fastapi import APIRouter

from app.api.routes.login import router as login_router
from app.api.routes.users import router as users_router
from app.api.routes.utils import router as utils_router
from app.api.routes.items import router as items_router
from app.api.routes.habits import router as habits_router
from app.api.routes.habit_records import router as habit_records_router
from app.api.routes.private import router as private_router
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login_router)
api_router.include_router(users_router)
api_router.include_router(utils_router)
api_router.include_router(items_router)
api_router.include_router(habits_router)
api_router.include_router(habit_records_router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private_router)
