from datetime import date, datetime, timedelta
from typing import Any
from collections import defaultdict

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select, and_

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Category,
    CategoryCreate,
    CategoryPublic,
    CategoriesPublic,
    CategoryUpdate,
    Transaction,
    TransactionType,
    Message,
)

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=CategoriesPublic)
def read_categories(
    session: SessionDep,
    current_user: CurrentUser,
    type: TransactionType | None = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    statement = select(Category).where(Category.owner_id == current_user.id)
    
    if type:
        statement = statement.where(Category.type == type)
    
    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()
    
    statement = statement.order_by(col(Category.created_at).desc()).offset(skip).limit(limit)
    categories = session.exec(statement).all()
    
    categories_public = [CategoryPublic.model_validate(category) for category in categories]
    return CategoriesPublic(data=categories_public, count=count)


@router.get("/{id}", response_model=CategoryPublic)
def read_category(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Any:
    category = session.get(Category, id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if category.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return category


@router.post("/", response_model=CategoryPublic)
def create_category(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    category_in: CategoryCreate,
) -> Any:
    category = Category.model_validate(category_in, update={"owner_id": current_user.id})
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.patch("/{id}", response_model=CategoryPublic)
def update_category(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
    category_in: CategoryUpdate,
) -> Any:
    category = session.get(Category, id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if category.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    update_dict = category_in.model_dump(exclude_unset=True)
    category.sqlmodel_update(update_dict)
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.delete("/{id}")
def delete_category(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    category = session.get(Category, id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if category.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    transactions_count = session.exec(
        select(func.count())
        .select_from(Transaction)
        .where(Transaction.category_id == id)
    ).one()
    
    if transactions_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete category with {transactions_count} transactions"
        )
    
    session.delete(category)
    session.commit()
    return Message(message="Category deleted successfully")
