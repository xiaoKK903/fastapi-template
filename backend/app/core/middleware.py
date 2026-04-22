import json
import time
from typing import Any
from urllib.parse import parse_qs

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.concurrency import iterate_in_threadpool
from sqlmodel import Session

from app.core.db import engine
from app.models import ActionType, OperationLog, ResourceType


MAX_REQUEST_BODY_SIZE = 10 * 1024
MAX_RESPONSE_BODY_SIZE = 10 * 1024


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
        "/tags": ResourceType.FILE_TAG,
        "/shares": ResourceType.FILE_SHARE,
        "/recycle": ResourceType.FILE,
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


def should_log_request(path: str, method: str) -> bool:
    exclude_paths = [
        "/docs",
        "/openapi.json",
        "/redoc",
        "/health",
        "/static",
        "/favicon.ico",
    ]
    for exclude_path in exclude_paths:
        if exclude_path in path:
            return False
    return True


class OperationLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request.state.operation_log_data = {
            "resource_name": None,
            "resource_id": None,
            "request_data": None,
            "error_message": None,
        }

        path = request.url.path
        method = request.method

        if not should_log_request(path, method):
            return await call_next(request)

        resource_type = get_resource_type_from_path(path)
        action = get_action_from_method(method)

        if not resource_type or not action:
            return await call_next(request)

        start_time = time.time()

        query_params = self._extract_query_params(request)

        request_body = await request.body()
        request.state._cached_body = request_body
        request_data = self._parse_request_body(request_body, request.headers)

        request.state.operation_log_data["request_data"] = request_data

        response = None
        error_message = None

        try:
            async def receive() -> dict:
                return {"type": "http.request", "body": request_body}

            original_receive = request._receive
            request._receive = receive
            response = await call_next(request)
            request._receive = original_receive
        except Exception as e:
            error_message = str(e)
            raise
        finally:
            duration_ms = int((time.time() - start_time) * 1000)

            user = getattr(request.state, "current_user", None)
            user_id = user.id if user else None
            user_email = user.email if user else None

            response_body = None
            response_status = response.status_code if response else 500
            success = response_status < 400 if response else False

            if response:
                response_body = await self._extract_response_body(response)

            resource_name = request.state.operation_log_data.get("resource_name")
            resource_id = request.state.operation_log_data.get("resource_id")
            log_error_message = request.state.operation_log_data.get("error_message") or error_message

            if resource_type != ResourceType.OPERATION_LOG:
                self._save_log(
                    user_id=user_id,
                    user_email=user_email,
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    resource_name=resource_name,
                    request_path=path,
                    request_method=method,
                    request_data=request_data,
                    query_params=query_params,
                    response_status=response_status,
                    response_data=response_body,
                    duration_ms=duration_ms,
                    ip_address=self._get_client_ip(request),
                    user_agent=request.headers.get("user-agent"),
                    success=success,
                    error_message=log_error_message if not success else None,
                )

        return response

    def _parse_request_body(self, body: bytes, headers) -> str | None:
        if not body:
            return None

        try:
            content_type = headers.get("content-type", "")

            if "multipart/form-data" in content_type:
                return f"[multipart/form-data, {len(body)} bytes]"

            try:
                parsed = json.loads(body)
                result = json.dumps(parsed, ensure_ascii=False)
                if len(result) > MAX_REQUEST_BODY_SIZE:
                    return result[:MAX_REQUEST_BODY_SIZE] + "..."
                return result
            except (json.JSONDecodeError, UnicodeDecodeError):
                if len(body) > MAX_REQUEST_BODY_SIZE:
                    return f"[binary data, {len(body)} bytes]"
                return body.decode("utf-8", errors="replace")
        except Exception:
            pass
        return None

    def _extract_query_params(self, request: Request) -> str | None:
        try:
            query_string = request.url.query
            if query_string:
                params = parse_qs(query_string)
                result = {}
                for key, values in params.items():
                    if len(values) == 1:
                        result[key] = values[0]
                    else:
                        result[key] = values
                if result:
                    return json.dumps(result, ensure_ascii=False)
        except Exception:
            pass
        return None

    async def _extract_response_body(self, response: Response) -> str | None:
        try:
            if hasattr(response, "body") and response.body:
                body = response.body
            elif hasattr(response, "body_iterator"):
                response_body = [chunk async for chunk in response.body_iterator]
                response.body_iterator = iterate_in_threadpool(iter(response_body))
                body = b"".join(response_body)
            else:
                return None

            if not body:
                return None

            if len(body) > MAX_RESPONSE_BODY_SIZE:
                return f"[response truncated, {len(body)} bytes total]"

            try:
                parsed = json.loads(body)
                return json.dumps(parsed, ensure_ascii=False)
            except (json.JSONDecodeError, UnicodeDecodeError):
                return body.decode("utf-8", errors="replace")
        except Exception:
            pass
        return None

    def _get_client_ip(self, request: Request) -> str | None:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        return request.client.host if request.client else None

    def _save_log(
        self,
        user_id: str | None,
        user_email: str | None,
        action: ActionType,
        resource_type: ResourceType,
        resource_id: str | None = None,
        resource_name: str | None = None,
        request_path: str | None = None,
        request_method: str | None = None,
        request_data: str | None = None,
        query_params: str | None = None,
        response_status: int | None = None,
        response_data: str | None = None,
        duration_ms: int | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        success: bool = True,
        error_message: str | None = None,
    ) -> None:
        try:
            with Session(engine) as session:
                log = OperationLog(
                    user_id=user_id,
                    user_email=user_email,
                    action=action,
                    resource=resource_type,
                    resource_id=resource_id,
                    resource_name=resource_name,
                    request_path=request_path,
                    request_method=request_method,
                    request_data=request_data,
                    query_params=query_params,
                    response_status=response_status,
                    response_data=response_data,
                    duration_ms=duration_ms,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    success=success,
                    error_message=error_message,
                )
                session.add(log)
                session.commit()
        except Exception:
            pass


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
