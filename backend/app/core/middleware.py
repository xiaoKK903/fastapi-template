import json
import time
from typing import Any

import jwt
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.concurrency import iterate_in_threadpool
from sqlmodel import Session, select

from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.models import ActionType, OperationLog, ResourceType, User

IGNORED_PATHS = [
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/favicon.ico",
]


def get_resource_type_from_path(path: str) -> ResourceType | None:
    path_mappings = {
        "/habits": ResourceType.HABIT,
        "/habit-records": ResourceType.HABIT_RECORD,
        "/transactions": ResourceType.TRANSACTION,
        "/categories": ResourceType.CATEGORY,
        "/budgets": ResourceType.BUDGET,
        "/users": ResourceType.USER,
        "/roles": ResourceType.ROLE,
        "/permissions": ResourceType.PERMISSION,
        "/operation-logs": ResourceType.OPERATION_LOG,
        "/tasks": ResourceType.TASK,
        "/files": ResourceType.FILE,
        "/folders": ResourceType.FOLDER,
        "/recycle": ResourceType.FILE,
        "/shares": ResourceType.FILE_SHARE,
        "/tags": ResourceType.FILE_TAG,
        "/login": ResourceType.USER,
        "/items": ResourceType.USER,
    }
    for path_prefix, resource_type in path_mappings.items():
        if path_prefix in path:
            return resource_type
    return None


def get_action_from_method(method: str) -> ActionType | None:
    method_mappings = {
        "GET": ActionType.READ,
        "POST": ActionType.CREATE,
        "PUT": ActionType.UPDATE,
        "PATCH": ActionType.UPDATE,
        "DELETE": ActionType.DELETE,
    }
    return method_mappings.get(method)


def get_user_from_token(token: str) -> tuple[str | None, str | None]:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        user_id = payload.get("sub")
        if user_id:
            with Session(engine) as session:
                user = session.exec(
                    select(User).where(User.id == user_id)
                ).first()
                if user:
                    return user.id, user.email
    except Exception:
        pass
    return None, None


class OperationLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        for ignored in IGNORED_PATHS:
            if ignored in request.url.path:
                return await call_next(request)

        resource_type = get_resource_type_from_path(request.url.path)

        if resource_type == ResourceType.OPERATION_LOG:
            return await call_next(request)

        request.state.operation_log_data = {
            "resource_name": None,
            "resource_id": None,
            "request_data": None,
            "error_message": None,
        }

        action = get_action_from_method(request.method)

        request_data = None
        if resource_type and action and request.method in ["POST", "PUT", "PATCH", "DELETE"]:
            try:
                body = await request.json()
                if body:
                    if "password" in body:
                        body["password"] = "********"
                    if "new_password" in body:
                        body["new_password"] = "********"
                    request_data = json.dumps(body, ensure_ascii=False)
                    request.state.operation_log_data["request_data"] = request_data
            except Exception:
                pass

        auth_header = request.headers.get("authorization", "")
        user_id, user_email = None, None
        if auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            user_id, user_email = get_user_from_token(token)

        start_time = time.time()
        response = await call_next(request)
        duration_ms = int((time.time() - start_time) * 1000)

        if resource_type and action:
            success = response.status_code < 400

            resource_name = request.state.operation_log_data.get("resource_name")
            resource_id = request.state.operation_log_data.get("resource_id")
            error_message = request.state.operation_log_data.get("error_message")

            if resource_type != ResourceType.OPERATION_LOG:
                try:
                    with Session(engine) as session:
                        log = OperationLog(
                            user_id=user_id,
                            user_email=user_email,
                            action=action,
                            resource=resource_type,
                            resource_id=resource_id,
                            resource_name=resource_name,
                            request_path=request.url.path,
                            request_method=request.method,
                            request_data=request_data,
                            response_status=response.status_code,
                            ip_address=self._get_client_ip(request),
                            user_agent=request.headers.get("user-agent"),
                            success=success,
                            error_message=error_message,
                            duration_ms=duration_ms,
                        )
                        session.add(log)
                        session.commit()
                except Exception:
                    pass

        return response

    def _get_client_ip(self, request: Request) -> str | None:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else None


def set_operation_log_data(
    request: Request,
    resource_id: str | None = None,
    resource_name: str | None = None,
    error_message: str | None = None,
) -> None:
    if hasattr(request, "state") and hasattr(request.state, "operation_log_data"):
        if resource_id:
            request.state.operation_log_data["resource_id"] = resource_id
        if resource_name:
            request.state.operation_log_data["resource_name"] = resource_name
        if error_message:
            request.state.operation_log_data["error_message"] = error_message
