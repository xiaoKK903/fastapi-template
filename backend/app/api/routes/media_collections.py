from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    MediaCollection,
    MediaCollectionCreate,
    MediaCollectionPublic,
    MediaCollectionsPublic,
    MediaCollectionStatistics,
    MediaCollectionTagLink,
    MediaCollectionUpdate,
    MediaStatus,
    MediaTag,
    MediaTagCreate,
    MediaTagPublic,
    MediaTagsPublic,
    MediaType,
    Message,
)

router = APIRouter(prefix="/media", tags=["media"])


def get_collection_with_tags(
    session: SessionDep, collection: MediaCollection
) -> MediaCollectionPublic:
    tag_names = [tag.name for tag in collection.tags]
    return MediaCollectionPublic(
        **collection.model_dump(),
        tag_names=tag_names,
    )


@router.post("/collections", response_model=MediaCollectionPublic, status_code=201)
def create_collection(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    collection_in: MediaCollectionCreate,
) -> Any:
    collection = MediaCollection.model_validate(
        collection_in, update={"owner_id": current_user.id}
    )
    
    if collection_in.tag_ids:
        for tag_id in collection_in.tag_ids:
            tag = session.get(MediaTag, tag_id)
            if tag and tag.owner_id == current_user.id:
                collection.tags.append(tag)
    
    if collection_in.status == MediaStatus.COMPLETED and not collection.completed_at:
        collection.completed_at = datetime.now(timezone.utc)
    
    session.add(collection)
    session.commit()
    session.refresh(collection)
    
    return get_collection_with_tags(session, collection)


@router.get("/collections", response_model=MediaCollectionsPublic)
def list_collections(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    media_type: MediaType | None = None,
    status: MediaStatus | None = None,
    search: str | None = None,
    tag_id: str | None = None,
) -> Any:
    count_statement = (
        select(func.count())
        .select_from(MediaCollection)
        .where(MediaCollection.owner_id == current_user.id)
    )
    
    statement = (
        select(MediaCollection)
        .where(MediaCollection.owner_id == current_user.id)
        .order_by(col(MediaCollection.updated_at).desc())
        .offset(skip)
        .limit(limit)
    )
    
    if media_type:
        count_statement = count_statement.where(MediaCollection.media_type == media_type)
        statement = statement.where(MediaCollection.media_type == media_type)
    
    if status:
        count_statement = count_statement.where(MediaCollection.status == status)
        statement = statement.where(MediaCollection.status == status)
    
    if search:
        search_term = f"%{search}%"
        count_statement = count_statement.where(
            col(MediaCollection.title).ilike(search_term)
            | col(MediaCollection.original_title).ilike(search_term)
            | col(MediaCollection.description).ilike(search_term)
        )
        statement = statement.where(
            col(MediaCollection.title).ilike(search_term)
            | col(MediaCollection.original_title).ilike(search_term)
            | col(MediaCollection.description).ilike(search_term)
        )
    
    if tag_id:
        tag = session.get(MediaTag, tag_id)
        if tag and tag.owner_id == current_user.id:
            count_statement = (
                select(func.count())
                .select_from(MediaCollection)
                .join(MediaCollectionTagLink, MediaCollectionTagLink.collection_id == MediaCollection.id)
                .where(
                    MediaCollection.owner_id == current_user.id,
                    MediaCollectionTagLink.tag_id == tag_id,
                )
            )
            statement = (
                select(MediaCollection)
                .join(MediaCollectionTagLink, MediaCollectionTagLink.collection_id == MediaCollection.id)
                .where(
                    MediaCollection.owner_id == current_user.id,
                    MediaCollectionTagLink.tag_id == tag_id,
                )
                .order_by(col(MediaCollection.updated_at).desc())
                .offset(skip)
                .limit(limit)
            )
    
    count = session.exec(count_statement).one()
    collections = session.exec(statement).all()
    
    collections_public = [get_collection_with_tags(session, c) for c in collections]
    return MediaCollectionsPublic(data=collections_public, count=count)


@router.get("/collections/stats", response_model=MediaCollectionStatistics)
def get_collection_stats(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    count_statement = (
        select(func.count())
        .select_from(MediaCollection)
        .where(MediaCollection.owner_id == current_user.id)
    )
    total_items = session.exec(count_statement).one()
    
    want_to_watch = session.exec(
        count_statement.where(MediaCollection.status == MediaStatus.WANT_TO_WATCH)
    ).one()
    watching = session.exec(
        count_statement.where(MediaCollection.status == MediaStatus.WATCHING)
    ).one()
    completed = session.exec(
        count_statement.where(MediaCollection.status == MediaStatus.COMPLETED)
    ).one()
    on_hold = session.exec(
        count_statement.where(MediaCollection.status == MediaStatus.ON_HOLD)
    ).one()
    dropped = session.exec(
        count_statement.where(MediaCollection.status == MediaStatus.DROPPED)
    ).one()
    
    books = session.exec(
        count_statement.where(MediaCollection.media_type == MediaType.BOOK)
    ).one()
    movies = session.exec(
        count_statement.where(MediaCollection.media_type == MediaType.MOVIE)
    ).one()
    tv_shows = session.exec(
        count_statement.where(MediaCollection.media_type == MediaType.TV_SHOW)
    ).one()
    
    rating_statement = (
        select(func.avg(MediaCollection.rating))
        .where(
            MediaCollection.owner_id == current_user.id,
            MediaCollection.rating != None,
        )
    )
    average_rating = session.exec(rating_statement).one()
    
    return MediaCollectionStatistics(
        total_items=total_items,
        want_to_watch=want_to_watch,
        watching=watching,
        completed=completed,
        on_hold=on_hold,
        dropped=dropped,
        books=books,
        movies=movies,
        tv_shows=tv_shows,
        average_rating=average_rating,
    )


@router.get("/collections/{collection_id}", response_model=MediaCollectionPublic)
def get_collection(
    session: SessionDep,
    current_user: CurrentUser,
    collection_id: str,
) -> Any:
    collection = session.get(MediaCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return get_collection_with_tags(session, collection)


@router.patch("/collections/{collection_id}", response_model=MediaCollectionPublic)
def update_collection(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    collection_id: str,
    collection_in: MediaCollectionUpdate,
) -> Any:
    collection = session.get(MediaCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    update_data = collection_in.model_dump(exclude_unset=True)
    
    if "tag_ids" in update_data:
        tag_ids = update_data.pop("tag_ids")
        collection.tags = []
        if tag_ids:
            for tag_id in tag_ids:
                tag = session.get(MediaTag, tag_id)
                if tag and tag.owner_id == current_user.id:
                    collection.tags.append(tag)
    
    if "status" in update_data:
        if update_data["status"] == MediaStatus.COMPLETED and not collection.completed_at:
            collection.completed_at = datetime.now(timezone.utc)
        elif update_data["status"] != MediaStatus.COMPLETED:
            collection.completed_at = None
    
    collection.updated_at = datetime.now(timezone.utc)
    
    for key, value in update_data.items():
        setattr(collection, key, value)
    
    session.add(collection)
    session.commit()
    session.refresh(collection)
    
    return get_collection_with_tags(session, collection)


@router.delete("/collections/{collection_id}", response_model=Message)
def delete_collection(
    session: SessionDep,
    current_user: CurrentUser,
    collection_id: str,
) -> Message:
    collection = session.get(MediaCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    session.delete(collection)
    session.commit()
    
    return Message(message="Collection deleted successfully")


@router.post("/tags", response_model=MediaTagPublic, status_code=201)
def create_tag(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    tag_in: MediaTagCreate,
) -> Any:
    tag_name = tag_in.name.strip()
    if not tag_name:
        raise HTTPException(status_code=400, detail="Tag name cannot be empty")
    
    existing_statement = (
        select(MediaTag)
        .where(MediaTag.owner_id == current_user.id, MediaTag.name == tag_name)
    )
    existing_tag = session.exec(existing_statement).first()
    if existing_tag:
        count_statement = (
            select(func.count())
            .select_from(MediaCollectionTagLink)
            .where(MediaCollectionTagLink.tag_id == existing_tag.id)
        )
        media_count = session.exec(count_statement).one()
        return MediaTagPublic.model_validate(
            existing_tag.model_dump() | {"media_count": media_count}
        )
    
    tag = MediaTag.model_validate(tag_in, update={"owner_id": current_user.id, "name": tag_name})
    session.add(tag)
    session.commit()
    session.refresh(tag)
    
    return MediaTagPublic.model_validate(tag.model_dump() | {"media_count": 0})


@router.get("/tags", response_model=MediaTagsPublic)
def list_tags(
    session: SessionDep,
    current_user: CurrentUser,
    search: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
) -> Any:
    count_statement = (
        select(func.count())
        .select_from(MediaTag)
        .where(MediaTag.owner_id == current_user.id)
    )
    
    statement = (
        select(MediaTag)
        .where(MediaTag.owner_id == current_user.id)
        .order_by(col(MediaTag.name))
        .limit(limit)
    )
    
    if search:
        search_term = f"%{search}%"
        count_statement = count_statement.where(col(MediaTag.name).ilike(search_term))
        statement = statement.where(col(MediaTag.name).ilike(search_term))
    
    count = session.exec(count_statement).one()
    tags = session.exec(statement).all()
    
    tags_public = []
    for tag in tags:
        count_statement = (
            select(func.count())
            .select_from(MediaCollectionTagLink)
            .where(MediaCollectionTagLink.tag_id == tag.id)
        )
        media_count = session.exec(count_statement).one()
        
        tag_dict = tag.model_dump()
        tag_dict["media_count"] = media_count
        tags_public.append(MediaTagPublic.model_validate(tag_dict))
    
    return MediaTagsPublic(data=tags_public, count=count)


@router.get("/tags/{tag_id}", response_model=MediaTagPublic)
def get_tag(
    session: SessionDep,
    current_user: CurrentUser,
    tag_id: str,
) -> Any:
    tag = session.get(MediaTag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if tag.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    count_statement = (
        select(func.count())
        .select_from(MediaCollectionTagLink)
        .where(MediaCollectionTagLink.tag_id == tag.id)
    )
    media_count = session.exec(count_statement).one()
    
    tag_dict = tag.model_dump()
    tag_dict["media_count"] = media_count
    return MediaTagPublic.model_validate(tag_dict)


@router.delete("/tags/{tag_id}", response_model=Message)
def delete_tag(
    session: SessionDep,
    current_user: CurrentUser,
    tag_id: str,
) -> Message:
    tag = session.get(MediaTag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if tag.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    link_statement = select(MediaCollectionTagLink).where(MediaCollectionTagLink.tag_id == tag_id)
    links = session.exec(link_statement).all()
    for link in links:
        session.delete(link)
    
    session.delete(tag)
    session.commit()
    
    return Message(message="Tag deleted successfully")
