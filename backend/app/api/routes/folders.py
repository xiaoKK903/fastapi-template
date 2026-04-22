from typing import Any, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Folder,
    FolderCreate,
    FolderPublic,
    FoldersPublic,
    FolderUpdate,
    FolderTreeItem,
    FolderWithPath,
    File,
    Message,
)


router = APIRouter(prefix="/folders", tags=["folders"])


def build_folder_tree(session, user_id: str, parent_id: Optional[str] = None) -> list[FolderTreeItem]:
    statement = (
        select(Folder)
        .where(Folder.owner_id == user_id, Folder.parent_id == parent_id)
        .order_by(col(Folder.name))
    )
    folders = session.exec(statement).all()

    result = []
    for folder in folders:
        count_statement = (
            select(func.count())
            .select_from(File)
            .where(File.folder_id == folder.id, File.is_deleted == False)
        )
        file_count = session.exec(count_statement).one()

        children = build_folder_tree(session, user_id, folder.id)

        folder_dict = folder.model_dump()
        folder_dict["children"] = children
        folder_dict["file_count"] = file_count
        result.append(FolderTreeItem.model_validate(folder_dict))

    return result


@router.get("/", response_model=FoldersPublic)
def read_folders(
    session: SessionDep,
    current_user: CurrentUser,
    parent_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> Any:
    count_statement = (
        select(func.count())
        .select_from(Folder)
        .where(Folder.owner_id == current_user.id, Folder.parent_id == parent_id)
    )
    count = session.exec(count_statement).one()

    statement = (
        select(Folder)
        .where(Folder.owner_id == current_user.id, Folder.parent_id == parent_id)
        .order_by(col(Folder.created_at).desc())
        .offset(skip)
        .limit(limit)
    )
    folders = session.exec(statement).all()

    folders_public = [FolderPublic.model_validate(folder) for folder in folders]
    return FoldersPublic(data=folders_public, count=count)


@router.get("/tree", response_model=list[FolderTreeItem])
def read_folder_tree(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    return build_folder_tree(session, current_user.id)


@router.get("/{folder_id}", response_model=FolderWithPath)
def read_folder(
    session: SessionDep,
    current_user: CurrentUser,
    folder_id: str,
) -> Any:
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if folder.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    path = []
    current = folder
    while current.parent_id:
        parent = session.get(Folder, current.parent_id)
        if parent:
            path.insert(0, FolderPublic.model_validate(parent))
            current = parent
        else:
            break

    folder_dict = folder.model_dump()
    folder_dict["path"] = path
    return FolderWithPath.model_validate(folder_dict)


@router.post("/", response_model=FolderPublic)
def create_folder(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    folder_in: FolderCreate,
) -> Any:
    if folder_in.parent_id:
        parent = session.get(Folder, folder_in.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")
        if parent.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")

    folder = Folder.model_validate(folder_in, update={"owner_id": current_user.id})
    session.add(folder)
    session.commit()
    session.refresh(folder)

    return FolderPublic.model_validate(folder)


@router.put("/{folder_id}", response_model=FolderPublic)
def update_folder(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    folder_id: str,
    folder_in: FolderUpdate,
) -> Any:
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if folder.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if folder_in.parent_id:
        if folder_in.parent_id == folder_id:
            raise HTTPException(status_code=400, detail="Cannot move folder to itself")
        parent = session.get(Folder, folder_in.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")
        if parent.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")

        check_parent = parent
        while check_parent.parent_id:
            if check_parent.parent_id == folder_id:
                raise HTTPException(status_code=400, detail="Cannot move folder to its descendant")
            check_parent = session.get(Folder, check_parent.parent_id)

    update_dict = folder_in.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)
    folder.sqlmodel_update(update_dict)
    session.add(folder)
    session.commit()
    session.refresh(folder)

    return FolderPublic.model_validate(folder)


@router.delete("/{folder_id}", response_model=Message)
def delete_folder(
    session: SessionDep,
    current_user: CurrentUser,
    folder_id: str,
) -> Message:
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if folder.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    def delete_folder_recursive(session, folder_id: str):
        folder = session.get(Folder, folder_id)
        if folder:
            child_statement = select(Folder).where(Folder.parent_id == folder_id)
            children = session.exec(child_statement).all()
            for child in children:
                delete_folder_recursive(session, child.id)

            file_statement = select(File).where(File.folder_id == folder_id, File.is_deleted == False)
            files = session.exec(file_statement).all()
            for file in files:
                file.is_deleted = True
                session.add(file)

            session.delete(folder)

    delete_folder_recursive(session, folder_id)
    session.commit()

    return Message(message="Folder deleted successfully")
