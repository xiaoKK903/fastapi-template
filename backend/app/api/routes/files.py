import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Optional, List
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File as FileParam, Form, Request, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlmodel import col, func, select, or_

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.models import (
    File,
    FileCreate,
    FilePublic,
    FilesPublic,
    FileUpdate,
    FileUploadResponse,
    Folder,
    Message,
    StorageQuota,
    FileTag,
    FileTagLink,
)
from app.utils.storage import (
    get_user_storage_path,
    get_file_path,
    generate_unique_filename,
    get_file_extension,
    get_file_type,
    validate_file_extension,
    validate_file_size,
    format_file_size,
    save_uploaded_file,
)


MIME_TYPE_MAP = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "webp": "image/webp",
    "svg": "image/svg+xml",
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "txt": "text/plain",
    "md": "text/markdown",
    "json": "application/json",
    "csv": "text/csv",
    "xml": "application/xml",
    "yaml": "text/yaml",
    "yml": "text/yaml",
    "zip": "application/zip",
    "rar": "application/vnd.rar",
    "7z": "application/x-7z-compressed",
    "tar": "application/x-tar",
    "gz": "application/gzip",
    "mp4": "video/mp4",
    "avi": "video/x-msvideo",
    "mkv": "video/x-matroska",
    "mov": "video/quicktime",
    "mp3": "audio/mpeg",
    "wav": "audio/wav",
}


def get_mime_type(extension: str) -> str:
    return MIME_TYPE_MAP.get(extension.lower(), "application/octet-stream")


router = APIRouter(prefix="/files", tags=["files"])


def get_or_create_storage_quota(session, user_id: str) -> StorageQuota:
    statement = select(StorageQuota).where(StorageQuota.user_id == user_id)
    quota = session.exec(statement).first()
    if not quota:
        quota = StorageQuota(
            user_id=user_id,
            total_quota=settings.DEFAULT_STORAGE_QUOTA,
            used_storage=0,
        )
        session.add(quota)
        session.commit()
        session.refresh(quota)
    return quota


def update_storage_usage(session, user_id: str, size_change: int):
    quota = get_or_create_storage_quota(session, user_id)
    quota.used_storage += size_change
    if quota.used_storage < 0:
        quota.used_storage = 0
    quota.updated_at = datetime.now(timezone.utc)
    session.add(quota)
    session.commit()


def get_file_tags(session, file_id: str) -> list[str]:
    statement = (
        select(FileTag.name)
        .join(FileTagLink, FileTagLink.tag_id == FileTag.id)
        .where(FileTagLink.file_id == file_id)
    )
    tags = session.exec(statement).all()
    return list(tags)


def add_file_tags(session, file_id: str, tags: list[str], user_id: str):
    for tag_name in tags:
        tag_name = tag_name.strip().lower()
        if not tag_name:
            continue

        statement = select(FileTag).where(FileTag.owner_id == user_id, FileTag.name == tag_name)
        tag = session.exec(statement).first()
        if not tag:
            tag = FileTag(name=tag_name, owner_id=user_id)
            session.add(tag)
            session.commit()
            session.refresh(tag)

        link_statement = select(FileTagLink).where(
            FileTagLink.file_id == file_id,
            FileTagLink.tag_id == tag.id,
        )
        link = session.exec(link_statement).first()
        if not link:
            link = FileTagLink(file_id=file_id, tag_id=tag.id)
            session.add(link)
            session.commit()


def build_file_public(session, file: File) -> FilePublic:
    file_dict = file.model_dump()
    file_dict["tags"] = get_file_tags(session, file.id)

    if file.folder_id:
        folder = session.get(Folder, file.folder_id)
        if folder:
            file_dict["folder_name"] = folder.name

    return FilePublic.model_validate(file_dict)


@router.get("/", response_model=FilesPublic)
def read_files(
    session: SessionDep,
    current_user: CurrentUser,
    folder_id: Optional[str] = None,
    search: Optional[str] = None,
    file_type: Optional[str] = None,
    tag: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    sort_by: str = Query("created_at", pattern="^(name|size|created_at|updated_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
) -> Any:
    statement = select(File).where(
        File.owner_id == current_user.id,
        File.is_deleted == False,
    )

    if folder_id is not None:
        statement = statement.where(File.folder_id == folder_id)

    if search:
        search_term = f"%{search}%"
        statement = statement.where(
            or_(
                File.name.ilike(search_term),
                File.original_name.ilike(search_term),
            )
        )

    if file_type:
        statement = statement.where(File.file_type == file_type)

    if tag:
        statement = (
            statement
            .join(FileTagLink, FileTagLink.file_id == File.id)
            .join(FileTag, FileTag.id == FileTagLink.tag_id)
            .where(FileTag.name == tag)
        )

    if is_favorite is not None:
        statement = statement.where(File.is_favorite == is_favorite)

    count_statement = statement.with_only_columns(func.count())
    count = session.exec(count_statement).one()

    sort_column = getattr(File, sort_by)
    if sort_order == "desc":
        sort_column = col(sort_column).desc()
    else:
        sort_column = col(sort_column).asc()

    statement = statement.order_by(sort_column).offset(skip).limit(limit)
    files = session.exec(statement).all()

    files_public = [build_file_public(session, f) for f in files]
    return FilesPublic(data=files_public, count=count)


@router.get("/{file_id}", response_model=FilePublic)
def read_file(
    session: SessionDep,
    current_user: CurrentUser,
    file_id: str,
) -> Any:
    file = session.get(File, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return build_file_public(session, file)


@router.post("/upload", response_model=FileUploadResponse, status_code=201)
async def upload_file(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = FileParam(...),
    folder_id: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: List[str] = Form(default_factory=list),
) -> Any:
    if folder_id:
        folder = session.get(Folder, folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
        if folder.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")

    filename = file.filename or "unknown"
    extension = get_file_extension(filename)

    if not validate_file_extension(filename):
        raise HTTPException(
            status_code=400,
            detail=f"File extension '{extension}' is not allowed"
        )

    unique_filename = generate_unique_filename(filename)
    file_path = get_file_path(current_user.id, folder_id, unique_filename)

    content = await file.read()
    file_size = len(content)

    if not validate_file_size(file_size):
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum allowed size of {format_file_size(settings.MAX_FILE_SIZE)}"
        )

    quota = get_or_create_storage_quota(session, current_user.id)
    if quota.used_storage + file_size > quota.total_quota:
        raise HTTPException(
            status_code=400,
            detail="Storage quota exceeded. Please delete some files or upgrade your plan."
        )

    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(str(file_path), 'wb') as f:
        f.write(content)

    mime_type = get_mime_type(extension) if file_size > 0 else None
    file_type = get_file_type(extension)

    original_name = filename
    saved_name = name if name else filename

    db_file = File(
        name=saved_name,
        original_name=original_name,
        size=file_size,
        file_type=file_type,
        extension=extension,
        mime_type=mime_type,
        folder_id=folder_id,
        description=description,
        owner_id=current_user.id,
        file_path=str(file_path),
    )
    session.add(db_file)
    session.commit()
    session.refresh(db_file)

    if tags:
        add_file_tags(session, db_file.id, tags, current_user.id)

    update_storage_usage(session, current_user.id, file_size)

    return FileUploadResponse(
        id=db_file.id,
        name=db_file.name,
        original_name=db_file.original_name,
        size=db_file.size,
        file_type=db_file.file_type,
        mime_type=db_file.mime_type,
        folder_id=db_file.folder_id,
    )


@router.get("/{file_id}/download")
def download_file(
    session: SessionDep,
    current_user: CurrentUser,
    file_id: str,
) -> Any:
    file = session.get(File, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    file_path = Path(file.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    filename = file.original_name or file.name
    encoded_filename = quote(filename, safe="")

    return FileResponse(
        path=str(file_path),
        media_type=file.mime_type or "application/octet-stream",
        filename=filename,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        },
    )


@router.get("/{file_id}/preview")
def preview_file(
    session: SessionDep,
    current_user: CurrentUser,
    file_id: str,
) -> Any:
    file = session.get(File, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    file_path = Path(file.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    filename = file.original_name or file.name
    encoded_filename = quote(filename, safe="")

    preview_types = ["image", "pdf"]
    if file.file_type not in preview_types:
        raise HTTPException(
            status_code=400,
            detail=f"Preview not available for this file type. Use download instead."
        )

    return FileResponse(
        path=str(file_path),
        media_type=file.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{encoded_filename}"
        },
    )


@router.put("/{file_id}", response_model=FilePublic)
def update_file(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    file_id: str,
    file_in: FileUpdate,
) -> Any:
    file = session.get(File, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if file_in.folder_id:
        folder = session.get(Folder, file_in.folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
        if folder.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")

    update_dict = file_in.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)
    file.sqlmodel_update(update_dict)
    session.add(file)
    session.commit()
    session.refresh(file)

    return build_file_public(session, file)


@router.delete("/{file_id}", response_model=Message)
def delete_file(
    session: SessionDep,
    current_user: CurrentUser,
    file_id: str,
) -> Message:
    file = session.get(File, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    file.is_deleted = True
    file.deleted_at = datetime.now(timezone.utc)
    file.updated_at = datetime.now(timezone.utc)
    session.add(file)
    session.commit()

    return Message(message="File moved to trash successfully")


@router.post("/{file_id}/toggle-favorite", response_model=FilePublic)
def toggle_favorite(
    session: SessionDep,
    current_user: CurrentUser,
    file_id: str,
) -> Any:
    file = session.get(File, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    file.is_favorite = not file.is_favorite
    file.updated_at = datetime.now(timezone.utc)
    session.add(file)
    session.commit()
    session.refresh(file)

    return build_file_public(session, file)


@router.post("/{file_id}/tags/{tag_name}", response_model=FilePublic)
def add_tag(
    session: SessionDep,
    current_user: CurrentUser,
    file_id: str,
    tag_name: str,
) -> Any:
    file = session.get(File, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    add_file_tags(session, file.id, [tag_name], current_user.id)
    session.refresh(file)

    return build_file_public(session, file)


@router.delete("/{file_id}/tags/{tag_name}", response_model=FilePublic)
def remove_tag(
    session: SessionDep,
    current_user: CurrentUser,
    file_id: str,
    tag_name: str,
) -> Any:
    file = session.get(File, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    tag_name = tag_name.strip().lower()
    tag_statement = select(FileTag).where(FileTag.owner_id == current_user.id, FileTag.name == tag_name)
    tag = session.exec(tag_statement).first()

    if tag:
        link_statement = select(FileTagLink).where(
            FileTagLink.file_id == file_id,
            FileTagLink.tag_id == tag.id,
        )
        link = session.exec(link_statement).first()
        if link:
            session.delete(link)
            session.commit()

    session.refresh(file)
    return build_file_public(session, file)


@router.get("/quota/info", response_model=Any)
def get_storage_quota(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    quota = get_or_create_storage_quota(session, current_user.id)
    remaining = max(0, quota.total_quota - quota.used_storage)
    percentage = (quota.used_storage / quota.total_quota * 100) if quota.total_quota > 0 else 0

    return {
        "user_id": quota.user_id,
        "total_quota": quota.total_quota,
        "used_storage": quota.used_storage,
        "remaining_storage": remaining,
        "usage_percentage": round(percentage, 2),
        "formatted_total": format_file_size(quota.total_quota),
        "formatted_used": format_file_size(quota.used_storage),
        "formatted_remaining": format_file_size(remaining),
    }
