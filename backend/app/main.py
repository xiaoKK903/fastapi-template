import sentry_sdk
from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.core.config import settings
from app.core.db import engine, init_db
from app.core.exceptions import register_exception_handlers
from app.core.middleware import OperationLogMiddleware
from sqlmodel import SQLModel
from sqlmodel import Session


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


if settings.SENTRY_DSN and settings.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
)

register_exception_handlers(app)

cors_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "https://localhost:5173",
    "https://localhost:5174",
    "https://localhost:5175",
    "https://localhost:5176",
    "http://localhost",
    "https://localhost",
]

if settings.BACKEND_CORS_ORIGINS:
    if isinstance(settings.BACKEND_CORS_ORIGINS, list):
        for origin in settings.BACKEND_CORS_ORIGINS:
            origin_str = str(origin).rstrip("/")
            if origin_str not in cors_origins:
                cors_origins.append(origin_str)

frontend_host = settings.FRONTEND_HOST.rstrip("/")
if frontend_host not in cors_origins:
    cors_origins.append(frontend_host)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.add_middleware(OperationLogMiddleware)


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        init_db(session)


app.include_router(api_router, prefix=settings.API_V1_STR)
