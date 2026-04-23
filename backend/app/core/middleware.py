import json
import time
import uuid
from contextvars import ContextVar
from typing import Any

import jwt
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.concurrency import iterate_in_threadpool
from sqlmodel import Session, select

from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.core.logging import logger, log_request, log_error
from app.models import ActionType, OperationLog, ResourceType, User


request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")


def get_request_id() -> str:
    return request_id_ctx.get()


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
        "/articles": ResourceType.USER,
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


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request_id_ctx.set(request_id)

        request.state.request_id = request_id
        request.state.start_time = time.time()

        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")

        logger.debug(
            "Request started",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "client_ip": client_ip,
                "user_agent": user_agent,
            },
        )

        try:
            response = await call_next(request)

            duration_ms = int((time.time() - request.state.start_time) * 1000)

            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = str(duration_ms)

            logger.info(
                "Request completed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                    "client_ip": client_ip,
                },
            )

            return response

        except Exception as e:
            duration_ms = int((time.time() - request.state.start_time) * 1000)

            logger.error(
                f"Request failed with exception: {str(e)}",
                exc_info=True,
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                    "client_ip": client_ip,
                    "exception": str(e),
                },
            )

            raise

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"


class OperationLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        for ignored in IGNORED_PATHS:
            if ignored in request.url.path:
                return await call_next(request)

        resource_type = get_resource_type_from_path(request.url.path)
        is_operation_log = resource_type == ResourceType.OPERATION_LOG

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

            should_log_to_file = True
            should_log_to_db = False
            if is_operation_log:
                if not success:
                    should_log_to_db = True
            else:
                should_log_to_db = True

            if should_log_to_file:
                try:
                    log_request(
                        method=request.method,
                        path=request.url.path,
                        status_code=response.status_code,
                        duration_ms=duration_ms,
                        user_id=user_id,
                        user_email=user_email,
                        error_message=error_message,
                    )
                except Exception:
                    pass

            if should_log_to_db:
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
                except Exception as e:
                    try:
                        log_error(
                            f"Failed to save operation log to database: {str(e)}",
                            extra={
                                "path": request.url.path,
                                "method": request.method,
                                "user_email": user_email,
                            },
                        )
                    except Exception:
                        pass

        return response

    def _get_client_ip(self, request: Request) -> str | None:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else None


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    MAX_REQUEST_SIZE = 10 * 1024 * 1024

    async def dispatch(self, request: Request, call_next) -> Response:
        content_length = request.headers.get("content-length")

        if content_length:
            try:
                size = int(content_length)
                if size > self.MAX_REQUEST_SIZE:
                    from fastapi import HTTPException

                    raise HTTPException(
                        status_code=413,
                        detail=f"Request too large. Maximum allowed size is {self.MAX_REQUEST_SIZE // (1024 * 1024)}MB",
                    )
            except ValueError:
                pass

        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    }

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        for header, value in self.SECURITY_HEADERS.items():
            if header not in response.headers:
                response.headers[header] = value

        if settings.is_production:
            response.headers[
                "Strict-Transport-Security"
            ] = "max-age=31536000; includeSubDomains"

        return response


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
