import hashlib
import os
import secrets
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional
from fastapi import UploadFile, HTTPException

from app.core.config import settings


def get_user_storage_path(user_id: str) -> Path:
    path = Path(settings.STORAGE_PATH) / "users" / user_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_file_path(user_id: str, folder_id: Optional[str], filename: str) -> Path:
    base_path = get_user_storage_path(user_id)
    if folder_id:
        folder_path = base_path / "folders" / folder_id
        folder_path.mkdir(parents=True, exist_ok=True)
        return folder_path / filename
    return base_path / filename


def generate_unique_filename(filename: str) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    random_suffix = secrets.token_hex(4)
    extension = get_file_extension(filename)
    name = f"{timestamp}_{random_suffix}"
    if extension:
        name = f"{name}.{extension}"
    return name


def get_file_extension(filename: str) -> str:
    if "." in filename:
        return filename.split(".")[-1].lower()
    return ""


def get_file_type(extension: str) -> str:
    image_extensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"]
    document_extensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "json", "csv", "xml", "yaml", "yml"]
    archive_extensions = ["zip", "rar", "7z", "tar", "gz"]
    video_extensions = ["mp4", "avi", "mkv", "mov"]
    audio_extensions = ["mp3", "wav"]

    ext_lower = extension.lower()
    if ext_lower in image_extensions:
        return "image"
    elif ext_lower in document_extensions:
        return "document"
    elif ext_lower in archive_extensions:
        return "archive"
    elif ext_lower in video_extensions:
        return "video"
    elif ext_lower in audio_extensions:
        return "audio"
    return "other"


def validate_file_extension(filename: str) -> bool:
    extension = get_file_extension(filename)
    return extension.lower() in settings.ALLOWED_EXTENSIONS


def validate_file_size(file_size: int) -> bool:
    return file_size <= settings.MAX_FILE_SIZE


def format_file_size(size_bytes: int) -> str:
    if size_bytes == 0:
        return "0 B"

    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0

    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024
        i += 1

    return f"{size_bytes:.2f} {size_names[i]}"


def generate_share_token() -> str:
    return secrets.token_urlsafe(32)


def get_share_expire_time(hours: Optional[int] = None) -> Optional[datetime]:
    if hours is None:
        hours = settings.SHARE_LINK_EXPIRE_HOURS
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def save_uploaded_file(content: bytes, file_path: Path) -> int:
    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(str(file_path), 'wb') as out_file:
        out_file.write(content)

    return len(content)


def calculate_file_hash(file_path: Path, algorithm: str = "sha256") -> str:
    hash_obj = hashlib.new(algorithm)
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            hash_obj.update(chunk)
    return hash_obj.hexdigest()


def delete_file(file_path: Path) -> bool:
    try:
        if file_path.exists():
            file_path.unlink()
            return True
        return False
    except Exception:
        return False


def move_to_trash(file_path: Path, user_id: str, file_id: str) -> Path:
    trash_path = Path(settings.STORAGE_PATH) / "trash" / user_id
    trash_path.mkdir(parents=True, exist_ok=True)

    trash_file_path = trash_path / f"{file_id}_{file_path.name}"
    if file_path.exists():
        file_path.rename(trash_file_path)

    return trash_file_path


def restore_from_trash(trash_file_path: Path, original_path: Path) -> bool:
    try:
        if trash_file_path.exists():
            original_path.parent.mkdir(parents=True, exist_ok=True)
            trash_file_path.rename(original_path)
            return True
        return False
    except Exception:
        return False
