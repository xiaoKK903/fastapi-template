import json
from typing import Any

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.concurrency import iterate_in_threadpool
from sqlmodel import Session

from app.core.db import engine
from app.models import ActionType, OperationLog, ResourceType, User


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


class OperationLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request.state.operation_log_data = {
            "resource_name": None,
            "resource_id": None,
            "request_data": None,
            "error_message": None,
        }

        user = getattr(request.state, "current_user", None)
        user_id = user.id if user else None
        user_email = user.email if user else None

        resource_type = get_resource_type_from_path(request.url.path)
        action = get_action_from_method(request.method)

        if resource_type and action:
            request_data = await self._extract_request_data(request)
            request.state.operation_log_data["request_data"] = request_data

        response = await call_next(request)

        if resource_type and action:
            response_body = await self._extract_response_body(response)
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
                        )
                        session.add(log)
                        session.commit()
                except Exception:
                    pass

        return response

    async def _extract_request_data(self, request: Request) -> str | None:
        try:
            body = await request.json()
            if body:
                return json.dumps(body, ensure_ascii=False)
        except Exception:
            pass
        return None

    async def _extract_response_body(self, response: Response) -> str | None:
        try:
            if hasattr(response, "body"):
                return response.body.decode("utf-8")
            elif hasattr(response, "body_iterator"):
                response_body = [chunk async for chunk in response.body_iterator]
                response.body_iterator = iterate_in_threadpool(iter(response_body))
                return b"".join(response_body).decode("utf-8")
        except Exception:
            pass
        return None

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
    if hasattr(request, "state"):
        if resource_id:
            request.state.operation_log_data["resource_id"] = resource_id
        if resource_name:
            request.state.operation_log_data["resource_name"] = resource_name
        if error_message:
            request.state.operation_log_data["error_message"] = error_message
