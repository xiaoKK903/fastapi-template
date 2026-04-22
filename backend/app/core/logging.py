import logging
import os
from datetime import datetime
from typing import Any

from app.core.config import settings

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

LOG_FILE = os.path.join(LOG_DIR, "app.log")
ERROR_LOG_FILE = os.path.join(LOG_DIR, "error.log")

logger = logging.getLogger("fastapi_template")
logger.setLevel(logging.DEBUG)

formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)

file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(formatter)

error_file_handler = logging.FileHandler(ERROR_LOG_FILE, encoding="utf-8")
error_file_handler.setLevel(logging.ERROR)
error_file_handler.setFormatter(formatter)

logger.addHandler(console_handler)
logger.addHandler(file_handler)
logger.addHandler(error_file_handler)


def log_request(
    method: str,
    path: str,
    status_code: int,
    duration_ms: int,
    user_id: str | None = None,
    user_email: str | None = None,
    error_message: str | None = None,
) -> None:
    level = logging.INFO if status_code < 400 else logging.ERROR
    message = (
        f"[{method}] {path} -> {status_code} ({duration_ms}ms) "
        f"user={user_email or user_id or 'anonymous'}"
    )
    if error_message:
        message += f" | error: {error_message}"
    logger.log(level, message)


def log_error(
    message: str,
    exc_info: Any = None,
    extra: dict[str, Any] | None = None,
) -> None:
    if extra:
        extra_str = " | ".join(f"{k}={v}" for k, v in extra.items())
        message = f"{message} | {extra_str}"
    logger.error(message, exc_info=exc_info)


def log_info(message: str, extra: dict[str, Any] | None = None) -> None:
    if extra:
        extra_str = " | ".join(f"{k}={v}" for k, v in extra.items())
        message = f"{message} | {extra_str}"
    logger.info(message)
