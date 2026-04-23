from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

DataT = TypeVar("DataT")


class ApiResponse(BaseModel, Generic[DataT]):
    success: bool = Field(default=True, description="请求是否成功")
    data: DataT | None = Field(default=None, description="响应数据")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat(), description="响应时间戳")
    message: str | None = Field(default=None, description="可选的提示消息")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {"id": "123", "name": "Example"},
                "timestamp": "2024-01-01T00:00:00.000000",
                "message": None,
            }
        }


class ApiListResponse(BaseModel, Generic[DataT]):
    success: bool = Field(default=True, description="请求是否成功")
    data: list[DataT] = Field(default_factory=list, description="数据列表")
    count: int = Field(default=0, description="总数量")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat(), description="响应时间戳")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": [{"id": "123", "name": "Example"}],
                "count": 1,
                "timestamp": "2024-01-01T00:00:00.000000",
            }
        }


class ApiPaginatedResponse(BaseModel, Generic[DataT]):
    success: bool = Field(default=True, description="请求是否成功")
    data: list[DataT] = Field(default_factory=list, description="数据列表")
    count: int = Field(default=0, description="总数量")
    page: int = Field(default=1, description="当前页码")
    page_size: int = Field(default=20, description="每页数量")
    total_pages: int = Field(default=1, description="总页数")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat(), description="响应时间戳")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": [{"id": "123", "name": "Example"}],
                "count": 100,
                "page": 1,
                "page_size": 20,
                "total_pages": 5,
                "timestamp": "2024-01-01T00:00:00.000000",
            }
        }


def success_response(
    data: Any = None,
    message: str | None = None,
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "success": True,
        "timestamp": datetime.utcnow().isoformat(),
    }

    if data is not None:
        if isinstance(data, dict) and "data" in data:
            response.update(data)
        else:
            response["data"] = data

    if message is not None:
        response["message"] = message

    return response


def created_response(
    data: Any = None,
    message: str = "Created successfully",
) -> dict[str, Any]:
    return success_response(data=data, message=message)


def list_response(
    data: list[Any],
    count: int | None = None,
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "success": True,
        "data": data,
        "timestamp": datetime.utcnow().isoformat(),
    }

    if count is not None:
        response["count"] = count
    else:
        response["count"] = len(data)

    return response


def paginated_response(
    data: list[Any],
    count: int,
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    total_pages = (count + page_size - 1) // page_size if page_size > 0 else 1

    return {
        "success": True,
        "data": data,
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "timestamp": datetime.utcnow().isoformat(),
    }
