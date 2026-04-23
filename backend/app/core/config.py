import os
import secrets
import warnings
from typing import Annotated, Any, Literal

from pydantic import (
    AnyUrl,
    BeforeValidator,
    EmailStr,
    HttpUrl,
    computed_field,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Self


def parse_cors(v: Any) -> list[str] | str:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",") if i.strip()]
    elif isinstance(v, list | str):
        return v
    raise ValueError(v)


def parse_extensions(v: Any) -> list[str]:
    if isinstance(v, str):
        return [ext.strip().lower() for ext in v.split(",") if ext.strip()]
    elif isinstance(v, list):
        return [ext.lower() for ext in v]
    return []


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.getenv(
            "ENV_FILE",
            os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                ".env",
            ),
        ),
        env_ignore_empty=True,
        extra="ignore",
    )

    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    FRONTEND_HOST: str = "http://localhost:5173"
    ENVIRONMENT: Literal["local", "test", "staging", "production"] = "local"

    BACKEND_CORS_ORIGINS: Annotated[
        list[AnyUrl] | str, BeforeValidator(parse_cors)
    ] = []

    @computed_field
    @property
    def all_cors_origins(self) -> list[str]:
        return [str(origin).rstrip("/") for origin in self.BACKEND_CORS_ORIGINS] + [
            self.FRONTEND_HOST
        ]

    PROJECT_NAME: str
    SENTRY_DSN: HttpUrl | None = None

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = ""

    @computed_field
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.ENVIRONMENT == "local" and not self.POSTGRES_PASSWORD:
            return "sqlite:///./app.db"
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    SMTP_PORT: int = 587
    SMTP_HOST: str | None = None
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAILS_FROM_EMAIL: EmailStr | None = None
    EMAILS_FROM_NAME: str | None = None

    @model_validator(mode="after")
    def _set_default_emails_from(self) -> Self:
        if not self.EMAILS_FROM_NAME:
            self.EMAILS_FROM_NAME = self.PROJECT_NAME
        return self

    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = 48

    @computed_field
    @property
    def emails_enabled(self) -> bool:
        return bool(self.SMTP_HOST and self.EMAILS_FROM_EMAIL)

    EMAIL_TEST_USER: EmailStr = "test@example.com"
    FIRST_SUPERUSER: EmailStr
    FIRST_SUPERUSER_PASSWORD: str

    STORAGE_PATH: str = "./storage"
    MAX_FILE_SIZE: int = 100 * 1024 * 1024
    ALLOWED_EXTENSIONS: Annotated[list[str], BeforeValidator(parse_extensions)] = [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "bmp",
        "webp",
        "svg",
        "pdf",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "ppt",
        "pptx",
        "txt",
        "md",
        "json",
        "csv",
        "xml",
        "yaml",
        "yml",
        "zip",
        "rar",
        "7z",
        "tar",
        "gz",
        "mp4",
        "mp3",
        "wav",
        "avi",
        "mkv",
        "mov",
    ]
    DEFAULT_STORAGE_QUOTA: int = 2 * 1024 * 1024 * 1024
    SHARE_LINK_EXPIRE_HOURS: int = 24

    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    LOG_PATH: str = "./logs"
    LOG_MAX_SIZE: int = 50
    LOG_BACKUP_COUNT: int = 10

    @computed_field
    @property
    def is_local(self) -> bool:
        return self.ENVIRONMENT == "local"

    @computed_field
    @property
    def is_test(self) -> bool:
        return self.ENVIRONMENT == "test"

    @computed_field
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    def _check_default_secret(self, var_name: str, value: str | None) -> None:
        if value == "changethis":
            message = (
                f'The value of {var_name} is "changethis", '
                "for security, please change it, at least for deployments."
            )
            if self.ENVIRONMENT in ["local", "test"]:
                warnings.warn(message, stacklevel=1)
            else:
                raise ValueError(message)

    @model_validator(mode="after")
    def _enforce_non_default_secrets(self) -> Self:
        if not self.is_local:
            self._check_default_secret("SECRET_KEY", self.SECRET_KEY)
            self._check_default_secret("POSTGRES_PASSWORD", self.POSTGRES_PASSWORD)
            self._check_default_secret(
                "FIRST_SUPERUSER_PASSWORD", self.FIRST_SUPERUSER_PASSWORD
            )

        return self


def get_env_file() -> str:
    env = os.getenv("ENVIRONMENT", "local")
    env_file_map = {
        "local": ".env.local",
        "test": ".env.test",
        "staging": ".env.staging",
        "production": ".env",
    }

    base_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    env_file = os.path.join(base_path, env_file_map.get(env, ".env"))

    if os.path.exists(env_file):
        return env_file

    default_env = os.path.join(base_path, ".env")
    if os.path.exists(default_env):
        return default_env

    return env_file


settings = Settings()
