import traceback
from typing import Any

from fastapi import HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class APIError(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: str | None = None,
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        super().__init__(message)


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    error_data = {
        "success": False,
        "error": {
            "message": exc.message,
            "code": exc.error_code or "unknown_error",
            "details": exc.details,
        },
    }
    return JSONResponse(
        status_code=exc.status_code,
        content=error_data,
    )


async def http_exception_handler(
    request: Request, exc: HTTPException
) -> JSONResponse:
    error_data = {
        "success": False,
        "error": {
            "message": str(exc.detail) if exc.detail else "An error occurred",
            "code": f"http_{exc.status_code}",
            "details": {},
        },
    }
    return JSONResponse(
        status_code=exc.status_code,
        content=error_data,
    )


async def starlette_http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    error_data = {
        "success": False,
        "error": {
            "message": str(exc.detail) if exc.detail else "An error occurred",
            "code": f"http_{exc.status_code}",
            "details": {},
        },
    }
    return JSONResponse(
        status_code=exc.status_code,
        content=error_data,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = []
    for error in exc.errors():
        errors.append(
            {
                "loc": list(error.get("loc", [])),
                "msg": error.get("msg"),
                "type": error.get("type"),
            }
        )

    error_data = {
        "success": False,
        "error": {
            "message": "Validation failed",
            "code": "validation_error",
            "details": {"errors": errors},
        },
    }
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=jsonable_encoder(error_data),
    )


async def global_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    tb = traceback.format_exc()

    error_data = {
        "success": False,
        "error": {
            "message": str(exc),
            "code": "internal_server_error",
            "details": {"traceback": tb},
        },
    }

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_data,
    )


def register_exception_handlers(app):
    app.add_exception_handler(APIError, api_error_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(StarletteHTTPException, starlette_http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, global_exception_handler)
