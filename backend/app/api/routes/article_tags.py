from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Article,
    ArticleTag,
    ArticleTagCreate,
    ArticleTagPublic,
    ArticleTagsPublic,
    ArticleTagLink,
    Message,
)

router = APIRouter(prefix="/article-tags", tags=["article-tags"])


@router.get("/", response_model=ArticleTagsPublic)
def read_tags(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    statement = select(ArticleTag).where(ArticleTag.owner_id == current_user.id)
    
    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()
    
    statement = statement.order_by(col(ArticleTag.created_at).desc()).offset(skip).limit(limit)
    tags = session.exec(statement).all()
    
    tags_public = []
    for tag in tags:
        article_count = session.exec(
            select(func.count())
            .select_from(ArticleTagLink)
            .where(ArticleTagLink.tag_id == tag.id)
        ).one()
        
        tags_public.append(
            ArticleTagPublic.model_validate(tag, update={"article_count": article_count})
        )
    
    return ArticleTagsPublic(data=tags_public, count=count)


@router.get("/popular/{limit}", response_model=ArticleTagsPublic)
def get_popular_tags(
    session: SessionDep,
    current_user: CurrentUser,
    limit: int = 10,
) -> Any:
    statement = (
        select(ArticleTag, func.count(ArticleTagLink.tag_id).label("article_count"))
        .join(ArticleTagLink, ArticleTagLink.tag_id == ArticleTag.id)
        .where(ArticleTag.owner_id == current_user.id)
        .group_by(ArticleTag.id)
        .order_by(col("article_count").desc())
        .limit(limit)
    )
    
    results = session.exec(statement).all()
    
    tags_public = []
    for tag, article_count in results:
        tags_public.append(
            ArticleTagPublic.model_validate(tag, update={"article_count": article_count})
        )
    
    return ArticleTagsPublic(data=tags_public, count=len(tags_public))


@router.get("/{id}", response_model=ArticleTagPublic)
def read_tag(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Any:
    tag = session.get(ArticleTag, id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if tag.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    article_count = session.exec(
        select(func.count())
        .select_from(ArticleTagLink)
        .where(ArticleTagLink.tag_id == tag.id)
    ).one()
    
    return ArticleTagPublic.model_validate(tag, update={"article_count": article_count})


@router.post("/", response_model=ArticleTagPublic)
def create_tag(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    tag_in: ArticleTagCreate,
) -> Any:
    existing_tag = session.exec(
        select(ArticleTag)
        .where(ArticleTag.name == tag_in.name)
        .where(ArticleTag.owner_id == current_user.id)
    ).first()
    
    if existing_tag:
        article_count = session.exec(
            select(func.count())
            .select_from(ArticleTagLink)
            .where(ArticleTagLink.tag_id == existing_tag.id)
        ).one()
        return ArticleTagPublic.model_validate(existing_tag, update={"article_count": article_count})
    
    tag = ArticleTag.model_validate(tag_in, update={"owner_id": current_user.id})
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return ArticleTagPublic.model_validate(tag, update={"article_count": 0})


@router.delete("/{id}")
def delete_tag(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    tag = session.get(ArticleTag, id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if tag.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    links = session.exec(
        select(ArticleTagLink).where(ArticleTagLink.tag_id == id)
    ).all()
    
    for link in links:
        session.delete(link)
    
    session.delete(tag)
    session.commit()
    return Message(message="Tag deleted successfully")
