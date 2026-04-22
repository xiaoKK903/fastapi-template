from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    FileTag,
    FileTagCreate,
    FileTagPublic,
    FileTagsPublic,
    FileTagLink,
    File,
    Message,
)


router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("/", response_model=FileTagsPublic)
def list_tags(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> Any:
    count_statement = (
        select(func.count())
        .select_from(FileTag)
        .where(FileTag.owner_id == current_user.id)
    )
    count = session.exec(count_statement).one()

    statement = (
        select(FileTag)
        .where(FileTag.owner_id == current_user.id)
        .order_by(col(FileTag.name))
        .offset(skip)
        .limit(limit)
    )
    tags = session.exec(statement).all()

    tags_public = []
    for tag in tags:
        count_statement = (
            select(func.count())
            .select_from(FileTagLink)
            .where(FileTagLink.tag_id == tag.id)
        )
        file_count = session.exec(count_statement).one()

        tag_dict = tag.model_dump()
        tag_dict["file_count"] = file_count
        tags_public.append(FileTagPublic.model_validate(tag_dict))

    return FileTagsPublic(data=tags_public, count=count)


@router.get("/{tag_id}", response_model=FileTagPublic)
def get_tag(
    session: SessionDep,
    current_user: CurrentUser,
    tag_id: str,
) -> Any:
    tag = session.get(FileTag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if tag.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    count_statement = (
        select(func.count())
        .select_from(FileTagLink)
        .where(FileTagLink.tag_id == tag.id)
    )
    file_count = session.exec(count_statement).one()

    tag_dict = tag.model_dump()
    tag_dict["file_count"] = file_count
    return FileTagPublic.model_validate(tag_dict)


@router.post("/", response_model=FileTagPublic, status_code=201)
def create_tag(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    tag_in: FileTagCreate,
) -> Any:
    tag_name = tag_in.name.strip().lower()

    existing_statement = (
        select(FileTag)
        .where(FileTag.owner_id == current_user.id, FileTag.name == tag_name)
    )
    existing_tag = session.exec(existing_statement).first()
    if existing_tag:
        return FileTagPublic.model_validate(existing_tag.model_dump() | {"file_count": 0})

    tag = FileTag.model_validate(tag_in, update={"owner_id": current_user.id, "name": tag_name})
    session.add(tag)
    session.commit()
    session.refresh(tag)

    return FileTagPublic.model_validate(tag.model_dump() | {"file_count": 0})


@router.delete("/{tag_id}", response_model=Message)
def delete_tag(
    session: SessionDep,
    current_user: CurrentUser,
    tag_id: str,
) -> Message:
    tag = session.get(FileTag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if tag.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    link_statement = select(FileTagLink).where(FileTagLink.tag_id == tag_id)
    links = session.exec(link_statement).all()
    for link in links:
        session.delete(link)

    session.delete(tag)
    session.commit()

    return Message(message="Tag deleted successfully")


@router.get("/search/{tag_name}", response_model=FileTagsPublic)
def search_tags(
    session: SessionDep,
    current_user: CurrentUser,
    tag_name: str,
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    search_term = f"%{tag_name}%"

    statement = (
        select(FileTag)
        .where(
            FileTag.owner_id == current_user.id,
            FileTag.name.ilike(search_term),
        )
        .order_by(col(FileTag.name))
        .limit(limit)
    )
    tags = session.exec(statement).all()

    tags_public = []
    for tag in tags:
        count_statement = (
            select(func.count())
            .select_from(FileTagLink)
            .where(FileTagLink.tag_id == tag.id)
        )
        file_count = session.exec(count_statement).one()

        tag_dict = tag.model_dump()
        tag_dict["file_count"] = file_count
        tags_public.append(FileTagPublic.model_validate(tag_dict))

    return FileTagsPublic(data=tags_public, count=len(tags_public))


@router.get("/popular/{limit}", response_model=FileTagsPublic)
def get_popular_tags(
    session: SessionDep,
    current_user: CurrentUser,
    limit: int = Query(10, ge=1, le=100),
) -> Any:
    statement = (
        select(FileTag, func.count(FileTagLink.file_id).label("file_count"))
        .join(FileTagLink, FileTagLink.tag_id == FileTag.id)
        .where(FileTag.owner_id == current_user.id)
        .group_by(FileTag.id)
        .order_by(col("file_count").desc())
        .limit(limit)
    )
    results = session.exec(statement).all()

    tags_public = []
    for tag, file_count in results:
        tag_dict = tag.model_dump()
        tag_dict["file_count"] = file_count
        tags_public.append(FileTagPublic.model_validate(tag_dict))

    return FileTagsPublic(data=tags_public, count=len(tags_public))
