import json
import logging
import os
import sys
from datetime import datetime
from logging.handlers import RotatingFileHandler
from typing import Any

from app.core.config import settings


class StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        if hasattr(record, "extra") and record.extra:
            log_data.update(record.extra)

        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data, ensure_ascii=False)


class ColoredFormatter(logging.Formatter):
    COLORS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[35m",
        "RESET": "\033[0m",
    }

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, self.COLORS["RESET"])
        reset = self.COLORS["RESET"]

        timestamp = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S")
        levelname = f"{color}{record.levelname:<8}{reset}"
        message = record.getMessage()

        result = f"{timestamp} | {levelname} | {record.name}:{record.lineno} | {message}"

        if record.exc_info:
            result += "\n" + self.formatException(record.exc_info)

        return result


def get_log_level() -> int:
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    return level_map.get(settings.LOG_LEVEL, logging.INFO)


def setup_logging() -> logging.Logger:
    logger = logging.getLogger("fastapi_template")
    logger.setLevel(get_log_level())

    if logger.handlers:
        return logger

    log_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        settings.LOG_PATH.lstrip("./"),
    )
    os.makedirs(log_path, exist_ok=True)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(get_log_level())
    if settings.is_local:
        console_handler.setFormatter(ColoredFormatter())
    else:
        console_handler.setFormatter(StructuredFormatter())

    log_file = os.path.join(log_path, "app.log")
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=settings.LOG_MAX_SIZE * 1024 * 1024,
        backupCount=settings.LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setLevel(get_log_level())
    file_handler.setFormatter(StructuredFormatter())

    error_log_file = os.path.join(log_path, "error.log")
    error_file_handler = RotatingFileHandler(
        error_log_file,
        maxBytes=settings.LOG_MAX_SIZE * 1024 * 1024,
        backupCount=settings.LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    error_file_handler.setLevel(logging.ERROR)
    error_file_handler.setFormatter(StructuredFormatter())

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    logger.addHandler(error_file_handler)

    logger.info(
        f"Logging initialized",
        extra={
            "environment": settings.ENVIRONMENT,
            "log_level": settings.LOG_LEVEL,
            "log_path": log_path,
        },
    )

    return logger


logger = setup_logging()


def log_request(
    method: str,
    path: str,
    status_code: int,
    duration_ms: int,
    user_id: str | None = None,
    user_email: str | None = None,
    error_message: str | None = None,
) -> None:
    extra: dict[str, Any] = {
        "method": method,
        "path": path,
        "status_code": status_code,
        "duration_ms": duration_ms,
        "user_id": user_id,
        "user_email": user_email,
    }

    if error_message:
        extra["error_message"] = error_message

    level = logging.INFO if status_code < 400 else logging.ERROR
    message = (
        f"[{method}] {path} -> {status_code} ({duration_ms}ms) "
        f"user={user_email or user_id or 'anonymous'}"
    )
    logger.log(level, message, extra={"request": extra})


def log_error(
    message: str,
    exc_info: Any = None,
    extra: dict[str, Any] | None = None,
) -> None:
    log_extra = extra.copy() if extra else {}
    logger.error(message, exc_info=exc_info, extra=log_extra)


def log_info(message: str, extra: dict[str, Any] | None = None) -> None:
    logger.info(message, extra=extra or {})


def log_debug(message: str, extra: dict[str, Any] | None = None) -> None:
    logger.debug(message, extra=extra or {})


def log_warning(message: str, extra: dict[str, Any] | None = None) -> None:
    logger.warning(message, extra=extra or {})


def log_critical(message: str, extra: dict[str, Any] | None = None) -> None:
    logger.critical(message, extra=extra or {})
