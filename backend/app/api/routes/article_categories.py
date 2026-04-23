from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Article,
    ArticleCategory,
    ArticleCategoryCreate,
    ArticleCategoryPublic,
    ArticleCategoriesPublic,
    ArticleCategoryUpdate,
    Message,
)

router = APIRouter(prefix="/article-categories", tags=["article-categories"])


@router.get("/", response_model=ArticleCategoriesPublic)
def read_categories(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    statement = select(ArticleCategory).where(ArticleCategory.owner_id == current_user.id)
    
    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()
    
    statement = statement.order_by(col(ArticleCategory.created_at).desc()).offset(skip).limit(limit)
    categories = session.exec(statement).all()
    
    categories_public = []
    for category in categories:
        article_count = session.exec(
            select(func.count())
            .select_from(Article)
            .where(Article.category_id == category.id)
            .where(Article.is_deleted == False)
        ).one()
        
        categories_public.append(
            ArticleCategoryPublic.model_validate(category, update={"article_count": article_count})
        )
    
    return ArticleCategoriesPublic(data=categories_public, count=count)


@router.get("/tree", response_model=ArticleCategoriesPublic)
def read_categories_tree(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    statement = select(ArticleCategory).where(ArticleCategory.owner_id == current_user.id)
    categories = session.exec(statement).all()
    
    categories_public = []
    for category in categories:
        article_count = session.exec(
            select(func.count())
            .select_from(Article)
            .where(Article.category_id == category.id)
            .where(Article.is_deleted == False)
        ).one()
        
        categories_public.append(
            ArticleCategoryPublic.model_validate(category, update={"article_count": article_count})
        )
    
    return ArticleCategoriesPublic(data=categories_public, count=len(categories_public))


@router.get("/{id}", response_model=ArticleCategoryPublic)
def read_category(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Any:
    category = session.get(ArticleCategory, id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if category.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    article_count = session.exec(
        select(func.count())
        .select_from(Article)
        .where(Article.category_id == category.id)
        .where(Article.is_deleted == False)
    ).one()
    
    return ArticleCategoryPublic.model_validate(category, update={"article_count": article_count})


@router.post("/", response_model=ArticleCategoryPublic)
def create_category(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    category_in: ArticleCategoryCreate,
) -> Any:
    category = ArticleCategory.model_validate(category_in, update={"owner_id": current_user.id})
    session.add(category)
    session.commit()
    session.refresh(category)
    return ArticleCategoryPublic.model_validate(category, update={"article_count": 0})


@router.patch("/{id}", response_model=ArticleCategoryPublic)
def update_category(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
    category_in: ArticleCategoryUpdate,
) -> Any:
    category = session.get(ArticleCategory, id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if category.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    update_dict = category_in.model_dump(exclude_unset=True)
    category.sqlmodel_update(update_dict)
    session.add(category)
    session.commit()
    session.refresh(category)
    
    article_count = session.exec(
        select(func.count())
        .select_from(Article)
        .where(Article.category_id == category.id)
        .where(Article.is_deleted == False)
    ).one()
    
    return ArticleCategoryPublic.model_validate(category, update={"article_count": article_count})


@router.delete("/{id}")
def delete_category(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    category = session.get(ArticleCategory, id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if category.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    articles_count = session.exec(
        select(func.count())
        .select_from(Article)
        .where(Article.category_id == id)
    ).one()
    
    if articles_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete category with {articles_count} articles"
        )
    
    children_count = session.exec(
        select(func.count())
        .select_from(ArticleCategory)
        .where(ArticleCategory.parent_id == id)
    ).one()
    
    if children_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete category with {children_count} subcategories"
        )
    
    session.delete(category)
    session.commit()
    return Message(message="Category deleted successfully")
