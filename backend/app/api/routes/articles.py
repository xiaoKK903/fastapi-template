import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File as FileParam, Form, HTTPException, Query, UploadFile
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.models import (
    Article,
    ArticleCategory,
    ArticleCreate,
    ArticlePublic,
    ArticlesPublic,
    ArticleStatistics,
    ArticleStatus,
    ArticleTag,
    ArticleTagLink,
    ArticleUpdate,
    ArchiveMonth,
    ArticleArchive,
    SensitiveLevel,
    Message,
)
from app.utils.content_filter import check_sensitive_content, filter_sensitive_content
from app.utils.storage import (
    generate_unique_filename,
    validate_file_extension,
    validate_file_size,
)

router = APIRouter(prefix="/articles", tags=["articles"])


def get_datetime_now() -> datetime:
    return datetime.now(timezone.utc)


def count_words(text: str) -> int:
    if not text:
        return 0
    text = text.strip()
    if not text:
        return 0
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    english_words = len(re.findall(r'\b[a-zA-Z]+\b', text))
    return chinese_chars + english_words


def enrich_article(session, article: Article) -> ArticlePublic:
    category_name = None
    category_color = None
    if article.category_id:
        category = session.get(ArticleCategory, article.category_id)
        if category:
            category_name = category.name
            category_color = category.color
    
    tag_names = []
    tag_colors = []
    for tag in article.tags:
        tag_names.append(tag.name)
        tag_colors.append(tag.color or "")
    
    return ArticlePublic.model_validate(
        article,
        update={
            "category_name": category_name,
            "category_color": category_color,
            "tag_names": tag_names,
            "tag_colors": tag_colors,
        }
    )


@router.get("/", response_model=ArticlesPublic)
def read_articles(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: ArticleStatus | None = None,
    category_id: str | None = None,
    search: str | None = None,
    include_archived: bool = False,
    include_deleted: bool = False,
) -> Any:
    statement = select(Article).where(Article.owner_id == current_user.id)
    
    if not include_deleted:
        statement = statement.where(Article.is_deleted == False)
    
    if status:
        statement = statement.where(Article.status == status)
    elif not include_archived:
        statement = statement.where(Article.status != ArticleStatus.ARCHIVED)
    
    if category_id:
        statement = statement.where(Article.category_id == category_id)
    
    if search:
        search_pattern = f"%{search}%"
        statement = statement.where(
            Article.title.like(search_pattern) |
            Article.summary.like(search_pattern) |
            Article.content.like(search_pattern)
        )
    
    count_statement = select(func.count()).select_from(
        statement.with_only_columns(Article.id).subquery()
    )
    count = session.exec(count_statement).one()
    
    statement = statement.order_by(col(Article.updated_at).desc()).offset(skip).limit(limit)
    articles = session.exec(statement).all()
    
    articles_public = [enrich_article(session, article) for article in articles]
    
    return ArticlesPublic(data=articles_public, count=count)


@router.get("/statistics", response_model=ArticleStatistics)
def get_statistics(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    stats = ArticleStatistics()
    
    stats.total_articles = session.exec(
        select(func.count()).select_from(
            select(Article.id)
            .where(Article.owner_id == current_user.id, Article.is_deleted == False)
            .subquery()
        )
    ).one()
    
    stats.draft_articles = session.exec(
        select(func.count()).select_from(
            select(Article.id)
            .where(
                Article.owner_id == current_user.id,
                Article.is_deleted == False,
                Article.status == ArticleStatus.DRAFT,
            )
            .subquery()
        )
    ).one()
    
    stats.published_articles = session.exec(
        select(func.count()).select_from(
            select(Article.id)
            .where(
                Article.owner_id == current_user.id,
                Article.is_deleted == False,
                Article.status == ArticleStatus.PUBLISHED,
            )
            .subquery()
        )
    ).one()
    
    stats.archived_articles = session.exec(
        select(func.count()).select_from(
            select(Article.id)
            .where(
                Article.owner_id == current_user.id,
                Article.is_deleted == False,
                Article.status == ArticleStatus.ARCHIVED,
            )
            .subquery()
        )
    ).one()
    
    stats.deleted_articles = session.exec(
        select(func.count()).select_from(
            select(Article.id)
            .where(
                Article.owner_id == current_user.id,
                Article.is_deleted == True,
            )
            .subquery()
        )
    ).one()
    
    total_views = session.exec(
        select(func.sum(Article.views))
        .where(Article.owner_id == current_user.id, Article.is_deleted == False)
    ).one()
    stats.total_views = int(total_views) if total_views else 0
    
    total_words = session.exec(
        select(func.sum(Article.word_count))
        .where(Article.owner_id == current_user.id, Article.is_deleted == False)
    ).one()
    stats.total_words = int(total_words) if total_words else 0
    
    category_stats = session.exec(
        select(
            ArticleCategory.id,
            ArticleCategory.name,
            func.count(Article.id).label("article_count"),
        )
        .outerjoin(Article, Article.category_id == ArticleCategory.id)
        .where(
            ArticleCategory.owner_id == current_user.id,
            Article.is_deleted == False,
        )
        .group_by(ArticleCategory.id, ArticleCategory.name)
    ).all()
    
    stats.category_distribution = [
        {"id": cat_id, "name": name, "count": count}
        for cat_id, name, count in category_stats
    ]
    
    return stats


@router.get("/drafts", response_model=ArticlesPublic)
def read_drafts(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    return read_articles(
        session=session,
        current_user=current_user,
        skip=skip,
        limit=limit,
        status=ArticleStatus.DRAFT,
    )


@router.get("/archived", response_model=ArticlesPublic)
def read_archived(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    statement = select(Article).where(
        Article.owner_id == current_user.id,
        Article.status == ArticleStatus.ARCHIVED,
        Article.is_deleted == False,
    )
    
    count_statement = select(func.count()).select_from(
        statement.with_only_columns(Article.id).subquery()
    )
    count = session.exec(count_statement).one()
    
    statement = statement.order_by(col(Article.updated_at).desc()).offset(skip).limit(limit)
    articles = session.exec(statement).all()
    
    articles_public = [enrich_article(session, article) for article in articles]
    
    return ArticlesPublic(data=articles_public, count=count)


@router.get("/trash", response_model=ArticlesPublic)
def read_trash(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    return read_articles(
        session=session,
        current_user=current_user,
        skip=skip,
        limit=limit,
        include_deleted=True,
    )


@router.get("/archive", response_model=ArticleArchive)
def get_archive(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    statement = (
        select(
            func.extract("year", Article.created_at).label("year"),
            func.extract("month", Article.created_at).label("month"),
            func.count(Article.id).label("article_count"),
        )
        .where(
            Article.owner_id == current_user.id,
            Article.is_deleted == False,
            Article.status == ArticleStatus.PUBLISHED,
        )
        .group_by("year", "month")
        .order_by(col("year").desc(), col("month").desc())
    )
    
    results = session.exec(statement).all()
    
    months = []
    for year, month, count in results:
        months.append(
            ArchiveMonth(
                year=int(year),
                month=int(month),
                article_count=int(count),
            )
        )
    
    return ArticleArchive(months=months)


@router.post("/upload-cover", status_code=201)
async def upload_cover_image(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = FileParam(...),
) -> Any:
    from pathlib import Path
    
    filename = file.filename or "unknown"
    extension = filename.lower().split(".")[-1] if "." in filename else ""
    
    if extension.lower() not in ["jpg", "jpeg", "png", "gif", "webp", "bmp"]:
        raise HTTPException(
            status_code=400,
            detail=f"File extension '{extension}' is not allowed for images"
        )
    
    unique_filename = generate_unique_filename(filename)
    
    upload_dir = Path("uploads") / "articles" / current_user.id
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = upload_dir / unique_filename
    
    content = await file.read()
    file_size = len(content)
    
    max_image_size = 5 * 1024 * 1024
    if file_size > max_image_size:
        raise HTTPException(
            status_code=400,
            detail="Image size exceeds maximum allowed size of 5MB"
        )
    
    with open(str(file_path), 'wb') as f:
        f.write(content)
    
    return {
        "filename": unique_filename,
        "original_name": filename,
        "size": file_size,
        "url": f"/uploads/articles/{current_user.id}/{unique_filename}",
    }


@router.delete("/trash/empty")
def empty_trash(
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    deleted_articles = session.exec(
        select(Article).where(
            Article.owner_id == current_user.id,
            Article.is_deleted == True,
        )
    ).all()
    
    deleted_count = 0
    for article in deleted_articles:
        session.exec(
            ArticleTagLink.__table__.delete().where(ArticleTagLink.article_id == article.id)
        )
        session.delete(article)
        deleted_count += 1
    
    session.commit()
    
    return Message(message=f"Permanently deleted {deleted_count} articles")


@router.post("/", response_model=ArticlePublic, status_code=201)
def create_article(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    article_in: ArticleCreate,
) -> Any:
    sensitive_level = SensitiveLevel.SAFE
    sensitive_reason = None
    filtered_content = article_in.content
    filtered_title = article_in.title
    filtered_summary = article_in.summary
    
    combined_text = f"{article_in.title} {article_in.summary or ''} {article_in.content or ''}"
    level, keywords, reason = check_sensitive_content(combined_text)
    
    if level == SensitiveLevel.BLOCKED:
        sensitive_level = level
        sensitive_reason = reason
        filtered_title = filter_sensitive_content(article_in.title)
        if article_in.summary:
            filtered_summary = filter_sensitive_content(article_in.summary)
        if article_in.content:
            filtered_content = filter_sensitive_content(article_in.content)
    elif level == SensitiveLevel.WARNING:
        sensitive_level = level
        sensitive_reason = reason
    
    word_count = count_words(filtered_content)
    
    published_at = None
    if article_in.status == ArticleStatus.PUBLISHED:
        published_at = get_datetime_now()
    
    article = Article(
        title=filtered_title,
        summary=filtered_summary,
        content=filtered_content,
        cover_image=article_in.cover_image,
        status=article_in.status or ArticleStatus.DRAFT,
        category_id=article_in.category_id,
        is_private=article_in.is_private,
        word_count=word_count,
        sensitive_level=sensitive_level,
        sensitive_reason=sensitive_reason,
        owner_id=current_user.id,
        published_at=published_at,
        created_at=get_datetime_now(),
        updated_at=get_datetime_now(),
    )
    
    if article_in.tag_ids:
        for tag_id in article_in.tag_ids:
            tag = session.get(ArticleTag, tag_id)
            if tag and tag.owner_id == current_user.id:
                article.tags.append(tag)
    
    session.add(article)
    session.commit()
    session.refresh(article)
    
    return enrich_article(session, article)


@router.get("/{id}", response_model=ArticlePublic)
def read_article(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Any:
    article = session.get(Article, id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    article.views += 1
    session.add(article)
    session.commit()
    
    return enrich_article(session, article)


@router.patch("/{id}", response_model=ArticlePublic)
def update_article(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
    article_in: ArticleUpdate,
) -> Any:
    article = session.get(Article, id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    update_dict = article_in.model_dump(exclude_unset=True)
    
    if "tag_ids" in update_dict:
        tag_ids = update_dict.pop("tag_ids")
        article.tags = []
        if tag_ids:
            for tag_id in tag_ids:
                tag = session.get(ArticleTag, tag_id)
                if tag and tag.owner_id == current_user.id:
                    article.tags.append(tag)
    
    if "content" in update_dict and update_dict["content"] is not None:
        combined_text = (
            f"{update_dict.get('title', article.title)} "
            f"{update_dict.get('summary', article.summary) or ''} "
            f"{update_dict['content']}"
        )
        level, keywords, reason = check_sensitive_content(combined_text)
        
        if level == SensitiveLevel.BLOCKED:
            article.sensitive_level = level
            article.sensitive_reason = reason
            update_dict["content"] = filter_sensitive_content(update_dict["content"])
            if "title" in update_dict:
                update_dict["title"] = filter_sensitive_content(update_dict["title"])
            if "summary" in update_dict and update_dict["summary"]:
                update_dict["summary"] = filter_sensitive_content(update_dict["summary"])
        elif level == SensitiveLevel.WARNING:
            article.sensitive_level = level
            article.sensitive_reason = reason
        
        article.word_count = count_words(update_dict["content"])
    
    if "status" in update_dict:
        if (
            update_dict["status"] == ArticleStatus.PUBLISHED
            and article.status != ArticleStatus.PUBLISHED
        ):
            article.published_at = get_datetime_now()
    
    article.sqlmodel_update(update_dict)
    article.updated_at = get_datetime_now()
    
    session.add(article)
    session.commit()
    session.refresh(article)
    
    return enrich_article(session, article)


@router.patch("/{id}/publish", response_model=ArticlePublic)
def publish_article(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Any:
    article = session.get(Article, id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    article.status = ArticleStatus.PUBLISHED
    article.published_at = get_datetime_now()
    article.updated_at = get_datetime_now()
    
    session.add(article)
    session.commit()
    session.refresh(article)
    
    return enrich_article(session, article)


@router.patch("/{id}/archive", response_model=ArticlePublic)
def archive_article(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Any:
    article = session.get(Article, id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    article.status = ArticleStatus.ARCHIVED
    article.updated_at = get_datetime_now()
    
    session.add(article)
    session.commit()
    session.refresh(article)
    
    return enrich_article(session, article)


@router.patch("/{id}/unarchive", response_model=ArticlePublic)
def unarchive_article(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Any:
    article = session.get(Article, id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    article.status = ArticleStatus.PUBLISHED
    article.updated_at = get_datetime_now()
    
    session.add(article)
    session.commit()
    session.refresh(article)
    
    return enrich_article(session, article)


@router.patch("/{id}/soft-delete")
def soft_delete_article(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    article = session.get(Article, id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    article.is_deleted = True
    article.updated_at = get_datetime_now()
    
    session.add(article)
    session.commit()
    
    return Message(message="Article moved to trash successfully")


@router.patch("/{id}/restore")
def restore_article(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    article = session.get(Article, id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    article.is_deleted = False
    article.updated_at = get_datetime_now()
    
    session.add(article)
    session.commit()
    
    return Message(message="Article restored successfully")


@router.delete("/{id}")
def delete_article(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    article = session.get(Article, id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    session.exec(
        ArticleTagLink.__table__.delete().where(ArticleTagLink.article_id == id)
    )
    
    session.delete(article)
    session.commit()
    
    return Message(message="Article deleted permanently")


@router.get("/admin/all", response_model=ArticlesPublic, dependencies=[Depends(get_current_active_superuser)])
def read_all_articles_admin(
    session: SessionDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = None,
    sensitive_level: SensitiveLevel | None = None,
) -> Any:
    statement = select(Article)
    
    if search:
        search_pattern = f"%{search}%"
        statement = statement.where(
            Article.title.like(search_pattern) |
            Article.content.like(search_pattern)
        )
    
    if sensitive_level:
        statement = statement.where(Article.sensitive_level == sensitive_level)
    
    count_statement = select(func.count()).select_from(
        statement.with_only_columns(Article.id).subquery()
    )
    count = session.exec(count_statement).one()
    
    statement = statement.order_by(col(Article.created_at).desc()).offset(skip).limit(limit)
    articles = session.exec(statement).all()
    
    articles_public = [enrich_article(session, article) for article in articles]
    
    return ArticlesPublic(data=articles_public, count=count)
