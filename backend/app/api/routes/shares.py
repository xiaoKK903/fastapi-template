import hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Optional, List
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, RedirectResponse
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep, get_current_user
from app.core.config import settings
from app.core.security import verify_password, get_password_hash
from app.models import (
    File,
    FileShare,
    FileShareCreate,
    FileShareUpdate,
    FileSharePublic,
    FileSharesPublic,
    FileSharePermission,
    Message,
)
from app.utils.storage import (
    generate_share_token,
    get_share_expire_time,
    format_file_size,
)


router = APIRouter(prefix="/shares", tags=["shares"])


def build_file_share_public(session, share: FileShare, include_url: bool = True) -> FileSharePublic:
    file = session.get(File, share.file_id)
    file_name = file.name if file else None
    file_size = file.size if file else None

    share_dict = share.model_dump()
    share_dict["file_name"] = file_name
    share_dict["file_size"] = file_size

    if include_url:
        share_dict["share_url"] = f"/api/v1/shares/token/{share.share_token}"

    if share_dict["password"]:
        share_dict["password"] = "******"

    return FileSharePublic.model_validate(share_dict)


@router.get("/", response_model=FileSharesPublic)
def list_shares(
    session: SessionDep,
    current_user: CurrentUser,
    file_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> Any:
    statement = select(FileShare).where(FileShare.owner_id == current_user.id)

    if file_id:
        statement = statement.where(FileShare.file_id == file_id)

    if is_active is not None:
        statement = statement.where(FileShare.is_active == is_active)

    count_statement = statement.with_only_columns(func.count())
    count = session.exec(count_statement).one()

    statement = (
        statement
        .order_by(col(FileShare.created_at).desc())
        .offset(skip)
        .limit(limit)
    )
    shares = session.exec(statement).all()

    shares_public = [build_file_share_public(session, s) for s in shares]
    return FileSharesPublic(data=shares_public, count=count)


@router.get("/{share_id}", response_model=FileSharePublic)
def get_share(
    session: SessionDep,
    current_user: CurrentUser,
    share_id: str,
) -> Any:
    share = session.get(FileShare, share_id)
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    if share.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return build_file_share_public(session, share)


@router.post("/", response_model=FileSharePublic, status_code=201)
def create_share(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    share_in: FileShareCreate,
) -> Any:
    file = session.get(File, share_in.file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    share_token = generate_share_token()

    expire_at = None
    if share_in.expire_hours:
        expire_at = get_share_expire_time(share_in.expire_hours)

    password_hash = None
    if share_in.password:
        password_hash = get_password_hash(share_in.password)

    share = FileShare(
        file_id=share_in.file_id,
        owner_id=current_user.id,
        share_token=share_token,
        permission=share_in.permission,
        password=password_hash,
        expire_at=expire_at,
        max_downloads=share_in.max_downloads,
        download_count=0,
        is_active=True,
    )
    session.add(share)
    session.commit()
    session.refresh(share)

    return build_file_share_public(session, share)


@router.put("/{share_id}", response_model=FileSharePublic)
def update_share(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    share_id: str,
    share_in: FileShareUpdate,
) -> Any:
    share = session.get(FileShare, share_id)
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    if share.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    update_dict = share_in.model_dump(exclude_unset=True)

    if "expire_hours" in update_dict:
        expire_hours = update_dict.pop("expire_hours")
        if expire_hours:
            update_dict["expire_at"] = get_share_expire_time(expire_hours)
        else:
            update_dict["expire_at"] = None

    if "password" in update_dict:
        password = update_dict.pop("password")
        if password:
            update_dict["password"] = get_password_hash(password)
        else:
            update_dict["password"] = None

    share.sqlmodel_update(update_dict)
    session.add(share)
    session.commit()
    session.refresh(share)

    return build_file_share_public(session, share)


@router.delete("/{share_id}", response_model=Message)
def delete_share(
    session: SessionDep,
    current_user: CurrentUser,
    share_id: str,
) -> Message:
    share = session.get(FileShare, share_id)
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    if share.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    session.delete(share)
    session.commit()

    return Message(message="Share deleted successfully")


@router.post("/{share_id}/revoke", response_model=Message)
def revoke_share(
    session: SessionDep,
    current_user: CurrentUser,
    share_id: str,
) -> Message:
    share = session.get(FileShare, share_id)
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    if share.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    share.is_active = False
    session.add(share)
    session.commit()

    return Message(message="Share revoked successfully")


@router.post("/{share_id}/activate", response_model=Message)
def activate_share(
    session: SessionDep,
    current_user: CurrentUser,
    share_id: str,
) -> Message:
    share = session.get(FileShare, share_id)
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    if share.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    share.is_active = True
    session.add(share)
    session.commit()

    return Message(message="Share activated successfully")


@router.get("/token/{share_token}")
def get_shared_file(
    session: SessionDep,
    share_token: str,
    password: Optional[str] = None,
) -> Any:
    share = session.exec(
        select(FileShare).where(FileShare.share_token == share_token)
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    if not share.is_active:
        raise HTTPException(status_code=400, detail="Share is not active")

    if share.expire_at and datetime.now(timezone.utc) > share.expire_at:
        raise HTTPException(status_code=400, detail="Share has expired")

    if share.max_downloads and share.download_count >= share.max_downloads:
        raise HTTPException(status_code=400, detail="Share download limit exceeded")

    if share.password:
        if not password:
            raise HTTPException(
                status_code=401,
                detail="Password required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not verify_password(password, share.password):
            raise HTTPException(status_code=403, detail="Invalid password")

    file = session.get(File, share.file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    filename = file.original_name or file.name
    encoded_filename = quote(filename, safe="")

    share.download_count += 1
    session.add(share)
    session.commit()

    return FileResponse(
        path=str(file_path),
        media_type=file.mime_type or "application/octet-stream",
        filename=filename,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        },
    )


@router.get("/token/{share_token}/info")
def get_shared_file_info(
    session: SessionDep,
    share_token: str,
) -> Any:
    share = session.exec(
        select(FileShare).where(FileShare.share_token == share_token)
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    if not share.is_active:
        raise HTTPException(status_code=400, detail="Share is not active")

    if share.expire_at and datetime.now(timezone.utc) > share.expire_at:
        raise HTTPException(status_code=400, detail="Share has expired")

    if share.max_downloads and share.download_count >= share.max_downloads:
        raise HTTPException(status_code=400, detail="Share download limit exceeded")

    file = session.get(File, share.file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")

    return {
        "file_name": file.name,
        "original_name": file.original_name,
        "file_size": file.size,
        "file_type": file.file_type,
        "mime_type": file.mime_type,
        "formatted_size": format_file_size(file.size),
        "requires_password": bool(share.password),
        "expire_at": share.expire_at,
        "download_count": share.download_count,
        "max_downloads": share.max_downloads,
        "permission": share.permission,
    }
