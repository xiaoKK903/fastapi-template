from datetime import datetime
from typing import Any

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.middleware import set_operation_log_data


class APIError(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        code: str | None = None,
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.status_code = status_code
        self.code = code or "BAD_REQUEST"
        self.details = details or {}
        super().__init__(self.message)


class NotFoundError(APIError):
    def __init__(self, message: str = "Resource not found", code: str = "NOT_FOUND"):
        super().__init__(message, status.HTTP_404_NOT_FOUND, code)


class UnauthorizedError(APIError):
    def __init__(self, message: str = "Unauthorized", code: str = "UNAUTHORIZED"):
        super().__init__(message, status.HTTP_401_UNAUTHORIZED, code)


class ForbiddenError(APIError):
    def __init__(self, message: str = "Forbidden", code: str = "FORBIDDEN"):
        super().__init__(message, status.HTTP_403_FORBIDDEN, code)


class ValidationErrorResponse(APIError):
    def __init__(
        self,
        message: str = "Validation error",
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message, status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", details)


def create_error_response(
    message: str,
    status_code: int,
    code: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "success": False,
        "error": {
            "message": message,
            "code": code or f"HTTP_{status_code}",
            "details": details or {},
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    set_operation_log_data(request, error_message=exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content=create_error_response(
            exc.message, exc.status_code, exc.code, exc.details
        ),
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    set_operation_log_data(request, error_message=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content=create_error_response(
            exc.detail, exc.status_code, f"HTTP_{exc.status_code}"
        ),
    )


async def validation_error_handler(request: Request, exc: ValidationError) -> JSONResponse:
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        })
    details = {"errors": errors}
    set_operation_log_data(request, error_message=f"Validation failed: {errors}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=create_error_response(
            "Validation failed", status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", details
        ),
    )


async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    error_msg = str(exc)
    if "UNIQUE constraint failed" in error_msg or "Duplicate entry" in error_msg:
        message = "Resource already exists"
        code = "DUPLICATE_ENTRY"
    else:
        message = "Database integrity error"
        code = "INTEGRITY_ERROR"
    set_operation_log_data(request, error_message=error_msg)
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=create_error_response(message, status.HTTP_400_BAD_REQUEST, code),
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    error_msg = str(exc)
    set_operation_log_data(request, error_message=error_msg)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=create_error_response(
            "Internal server error",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
        ),
    )


def register_exception_handlers(app: Any) -> None:
    app.add_exception_handler(APIError, api_error_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(ValidationError, validation_error_handler)
    app.add_exception_handler(IntegrityError, integrity_error_handler)
    app.add_exception_handler(Exception, general_exception_handler)
