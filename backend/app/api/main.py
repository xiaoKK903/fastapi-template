from fastapi import APIRouter

from app.api.routes.login import router as login_router
from app.api.routes.users import router as users_router
from app.api.routes.utils import router as utils_router
from app.api.routes.items import router as items_router
from app.api.routes.habits import router as habits_router
from app.api.routes.habit_records import router as habit_records_router
from app.api.routes.categories import router as categories_router
from app.api.routes.transactions import router as transactions_router
from app.api.routes.budgets import router as budgets_router
from app.api.routes.roles import router as roles_router
from app.api.routes.permissions import router as permissions_router
from app.api.routes.operation_logs import router as operation_logs_router
from app.api.routes.tasks import router as tasks_router
from app.api.routes.private import router as private_router
from app.api.routes.folders import router as folders_router
from app.api.routes.files import router as files_router
from app.api.routes.recycle import router as recycle_router
from app.api.routes.shares import router as shares_router
from app.api.routes.tags import router as tags_router
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login_router)
api_router.include_router(users_router)
api_router.include_router(utils_router)
api_router.include_router(items_router)
api_router.include_router(habits_router)
api_router.include_router(habit_records_router)
api_router.include_router(categories_router)
api_router.include_router(transactions_router)
api_router.include_router(budgets_router)
api_router.include_router(roles_router)
api_router.include_router(permissions_router)
api_router.include_router(operation_logs_router)
api_router.include_router(tasks_router)
api_router.include_router(folders_router)
api_router.include_router(files_router)
api_router.include_router(recycle_router)
api_router.include_router(shares_router)
api_router.include_router(tags_router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private_router)
