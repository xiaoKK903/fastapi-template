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


DEFAULT_CATEGORIES = [
    {"name": "餐饮", "type": TransactionType.EXPENSE, "icon": "Utensils", "color": "#ef4444"},
    {"name": "交通", "type": TransactionType.EXPENSE, "icon": "Car", "color": "#f97316"},
    {"name": "购物", "type": TransactionType.EXPENSE, "icon": "ShoppingBag", "color": "#eab308"},
    {"name": "住房", "type": TransactionType.EXPENSE, "icon": "Home", "color": "#22c55e"},
    {"name": "医疗", "type": TransactionType.EXPENSE, "icon": "Heart", "color": "#3b82f6"},
    {"name": "教育", "type": TransactionType.EXPENSE, "icon": "School", "color": "#8b5cf6"},
    {"name": "娱乐", "type": TransactionType.EXPENSE, "icon": "Gamepad2", "color": "#ec4899"},
    {"name": "工资", "type": TransactionType.INCOME, "icon": "DollarSign", "color": "#22c55e"},
    {"name": "投资", "type": TransactionType.INCOME, "icon": "TrendingUp", "color": "#3b82f6"},
    {"name": "红包", "type": TransactionType.INCOME, "icon": "Gift", "color": "#ef4444"},
    {"name": "兼职", "type": TransactionType.INCOME, "icon": "CreditCard", "color": "#f97316"},
]


@router.post("/init-defaults", response_model=CategoriesPublic)
def init_default_categories(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    existing_count = session.exec(
        select(func.count()).select_from(Category).where(Category.owner_id == current_user.id)
    ).one()
    
    if existing_count > 0:
        existing_categories = session.exec(
            select(Category).where(Category.owner_id == current_user.id)
        ).all()
        categories_public = [CategoryPublic.model_validate(cat) for cat in existing_categories]
        return CategoriesPublic(data=categories_public, count=len(categories_public))
    
    created_categories = []
    for cat_data in DEFAULT_CATEGORIES:
        category = Category.model_validate(cat_data, update={"owner_id": current_user.id})
        session.add(category)
        session.flush()
        created_categories.append(category)
    
    session.commit()
    
    categories_public = [CategoryPublic.model_validate(cat) for cat in created_categories]
    return CategoriesPublic(data=categories_public, count=len(categories_public))
