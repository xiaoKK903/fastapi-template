from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.models import (
    File,
    FilePublic,
    FilesPublic,
    Message,
    Folder,
)
from app.utils.storage import (
    delete_file,
    format_file_size,
)


router = APIRouter(prefix="/recycle", tags=["recycle"])


def build_file_public(session, file: File) -> FilePublic:
    file_dict = file.model_dump()
    file_dict["tags"] = []

    if file.folder_id:
        folder = session.get(Folder, file.folder_id)
        if folder:
            file_dict["folder_name"] = folder.name

    return FilePublic.model_validate(file_dict)


@router.get("/", response_model=FilesPublic)
def get_trash_files(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> Any:
    count_statement = (
        select(func.count())
        .select_from(File)
        .where(File.owner_id == current_user.id, File.is_deleted == True)
    )
    count = session.exec(count_statement).one()

    statement = (
        select(File)
        .where(File.owner_id == current_user.id, File.is_deleted == True)
        .order_by(col(File.deleted_at).desc())
        .offset(skip)
        .limit(limit)
    )
    files = session.exec(statement).all()

    files_public = [build_file_public(session, f) for f in files]
    return FilesPublic(data=files_public, count=count)


@router.get("/stats", response_model=Any)
def get_trash_stats(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    count_statement = (
        select(func.count())
        .select_from(File)
        .where(File.owner_id == current_user.id, File.is_deleted == True)
    )
    count = session.exec(count_statement).one()

    size_statement = (
        select(func.sum(File.size))
        .where(File.owner_id == current_user.id, File.is_deleted == True)
    )
    total_size = session.exec(size_statement).one() or 0

    return {
        "file_count": count,
        "total_size": total_size,
        "formatted_size": format_file_size(total_size),
        "auto_delete_days": 30,
    }


@router.post("/{file_id}/restore", response_model=Message)
def restore_file(
    session: SessionDep,
    current_user: CurrentUser,
    file_id: str,
) -> Message:
    file = session.get(File, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if not file.is_deleted:
        raise HTTPException(status_code=400, detail="File is not in trash")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    file.is_deleted = False
    file.deleted_at = None
    file.updated_at = datetime.now(timezone.utc)
    session.add(file)
    session.commit()

    return Message(message="File restored successfully")


@router.delete("/{file_id}", response_model=Message)
def permanently_delete_file(
    session: SessionDep,
    current_user: CurrentUser,
    file_id: str,
) -> Message:
    file = session.get(File, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if not file.is_deleted:
        raise HTTPException(status_code=400, detail="File is not in trash. Move to trash first.")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    file_path = Path(file.file_path)
    if file_path.exists():
        file_path.unlink()

    session.delete(file)
    session.commit()

    return Message(message="File permanently deleted successfully")


@router.post("/empty", response_model=Message)
def empty_trash(
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    statement = (
        select(File)
        .where(File.owner_id == current_user.id, File.is_deleted == True)
    )
    files = session.exec(statement).all()

    deleted_count = 0
    for file in files:
        file_path = Path(file.file_path)
        if file_path.exists():
            file_path.unlink()
        session.delete(file)
        deleted_count += 1

    session.commit()

    return Message(message=f"Emptied trash: {deleted_count} files permanently deleted")


@router.post("/restore-all", response_model=Message)
def restore_all_files(
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    statement = (
        select(File)
        .where(File.owner_id == current_user.id, File.is_deleted == True)
    )
    files = session.exec(statement).all()

    restored_count = 0
    for file in files:
        file.is_deleted = False
        file.deleted_at = None
        file.updated_at = datetime.now(timezone.utc)
        session.add(file)
        restored_count += 1

    session.commit()

    return Message(message=f"Restored {restored_count} files from trash")


@router.get("/cleanup-old", response_model=Message)
def cleanup_old_files(
    session: SessionDep,
    current_user: CurrentUser,
    days: int = Query(30, ge=1, le=365),
) -> Message:
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    statement = (
        select(File)
        .where(
            File.owner_id == current_user.id,
            File.is_deleted == True,
            File.deleted_at < cutoff_date,
        )
    )
    files = session.exec(statement).all()

    deleted_count = 0
    for file in files:
        file_path = Path(file.file_path)
        if file_path.exists():
            file_path.unlink()
        session.delete(file)
        deleted_count += 1

    session.commit()

    return Message(message=f"Cleaned up {deleted_count} files older than {days} days")
