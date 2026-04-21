from datetime import date, datetime, timedelta
from typing import Any
from collections import defaultdict

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select, and_

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Budget,
    BudgetCreate,
    BudgetPublic,
    BudgetUpdate,
    BudgetsPublic,
    BudgetWithCategory,
    BudgetsWithCategoryPublic,
    Transaction,
    TransactionType,
    Category,
    Message,
)

router = APIRouter(prefix="/budgets", tags=["budgets"])


def date_to_datetime(d: date) -> datetime:
    return datetime.combine(d, datetime.min.time())


def round_amount(amount: float, decimals: int = 2) -> float:
    return round(amount, decimals)


def calculate_spent(
    session: SessionDep,
    user_id: str,
    month: int,
    year: int,
    category_id: str | None = None,
) -> float:
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)
    
    statement = (
        select(func.sum(Transaction.amount))
        .where(Transaction.owner_id == user_id)
        .where(Transaction.type == TransactionType.EXPENSE)
        .where(Transaction.transaction_date >= start_date)
        .where(Transaction.transaction_date < end_date)
    )
    
    if category_id:
        statement = statement.where(Transaction.category_id == category_id)
    else:
        statement = statement.where(
            Transaction.category_id.not_in(
                select(Category.id).where(
                    Category.owner_id == user_id,
                    Category.type == TransactionType.INCOME
                )
            )
        )
    
    spent = session.exec(statement).one() or 0.0
    return round_amount(spent)


@router.get("/", response_model=BudgetsWithCategoryPublic)
def read_budgets(
    session: SessionDep,
    current_user: CurrentUser,
    month: int | None = None,
    year: int | None = None,
) -> Any:
    today = date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month
    
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Invalid month")
    
    statement = (
        select(Budget, Category)
        .outerjoin(Category, Budget.category_id == Category.id)
        .where(Budget.owner_id == current_user.id)
        .where(Budget.month == month)
        .where(Budget.year == year)
        .order_by(col(Budget.created_at).desc())
    )
    
    results = session.exec(statement).all()
    
    count_statement = (
        select(func.count())
        .select_from(Budget)
        .where(Budget.owner_id == current_user.id)
        .where(Budget.month == month)
        .where(Budget.year == year)
    )
    count = session.exec(count_statement).one()
    
    budgets_with_category = []
    for budget, category in results:
        spent = calculate_spent(
            session=session,
            user_id=current_user.id,
            month=month,
            year=year,
            category_id=budget.category_id,
        )
        
        remaining = round_amount(budget.amount - spent)
        percentage = round_amount((spent / budget.amount * 100) if budget.amount > 0 else 0.0)
        
        budgets_with_category.append(
            BudgetWithCategory(
                id=budget.id,
                amount=round_amount(budget.amount),
                month=budget.month,
                year=budget.year,
                category_id=budget.category_id,
                category_name=category.name if category else None,
                category_icon=category.icon if category else None,
                category_color=category.color if category else None,
                spent=spent,
                remaining=remaining,
                percentage=percentage,
            )
        )
    
    return BudgetsWithCategoryPublic(
        data=budgets_with_category,
        count=count
    )


@router.get("/{id}", response_model=BudgetWithCategory)
def read_budget(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Any:
    result = session.exec(
        select(Budget, Category)
        .outerjoin(Category, Budget.category_id == Category.id)
        .where(Budget.id == id)
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    budget, category = result
    
    if budget.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    spent = calculate_spent(
        session=session,
        user_id=current_user.id,
        month=budget.month,
        year=budget.year,
        category_id=budget.category_id,
    )
    
    remaining = round_amount(budget.amount - spent)
    percentage = round_amount((spent / budget.amount * 100) if budget.amount > 0 else 0.0)
    
    return BudgetWithCategory(
        id=budget.id,
        amount=round_amount(budget.amount),
        month=budget.month,
        year=budget.year,
        category_id=budget.category_id,
        category_name=category.name if category else None,
        category_icon=category.icon if category else None,
        category_color=category.color if category else None,
        spent=spent,
        remaining=remaining,
        percentage=percentage,
    )


@router.post("/", response_model=BudgetPublic)
def create_budget(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    budget_in: BudgetCreate,
) -> Any:
    if budget_in.category_id:
        category = session.get(Category, budget_in.category_id)
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        if category.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        if category.type == TransactionType.INCOME:
            raise HTTPException(
                status_code=400,
                detail="Cannot create budget for income category"
            )
    
    existing_budget = session.exec(
        select(Budget)
        .where(Budget.owner_id == current_user.id)
        .where(Budget.month == budget_in.month)
        .where(Budget.year == budget_in.year)
        .where(Budget.category_id == budget_in.category_id)
    ).first()
    
    if existing_budget:
        raise HTTPException(
            status_code=400,
            detail="Budget already exists for this category and month"
        )
    
    budget = Budget.model_validate(
        budget_in,
        update={
            "owner_id": current_user.id,
            "amount": round_amount(budget_in.amount),
        }
    )
    session.add(budget)
    session.commit()
    session.refresh(budget)
    return budget


@router.patch("/{id}", response_model=BudgetPublic)
def update_budget(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
    budget_in: BudgetUpdate,
) -> Any:
    budget = session.get(Budget, id)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    if budget.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    if budget_in.category_id:
        category = session.get(Category, budget_in.category_id)
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        if category.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        if category.type == TransactionType.INCOME:
            raise HTTPException(
                status_code=400,
                detail="Cannot create budget for income category"
            )
    
    update_dict = budget_in.model_dump(exclude_unset=True)
    
    if "amount" in update_dict and update_dict["amount"] is not None:
        update_dict["amount"] = round_amount(update_dict["amount"])
    
    budget.sqlmodel_update(update_dict)
    session.add(budget)
    session.commit()
    session.refresh(budget)
    return budget


@router.delete("/{id}")
def delete_budget(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    budget = session.get(Budget, id)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    if budget.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    session.delete(budget)
    session.commit()
    return Message(message="Budget deleted successfully")


@router.get("/check/overbudget")
def check_overbudget(
    session: SessionDep,
    current_user: CurrentUser,
    month: int | None = None,
    year: int | None = None,
) -> Any:
    today = date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month
    
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Invalid month")
    
    statement = (
        select(Budget, Category)
        .outerjoin(Category, Budget.category_id == Category.id)
        .where(Budget.owner_id == current_user.id)
        .where(Budget.month == month)
        .where(Budget.year == year)
    )
    
    results = session.exec(statement).all()
    
    overbudget_items = []
    for budget, category in results:
        spent = calculate_spent(
            session=session,
            user_id=current_user.id,
            month=month,
            year=year,
            category_id=budget.category_id,
        )
        
        remaining = round_amount(budget.amount - spent)
        percentage = round_amount((spent / budget.amount * 100) if budget.amount > 0 else 0.0)
        
        if remaining < 0 or percentage >= 100:
            overbudget_items.append({
                "id": budget.id,
                "amount": round_amount(budget.amount),
                "spent": spent,
                "remaining": remaining,
                "percentage": percentage,
                "category_id": budget.category_id,
                "category_name": category.name if category else None,
                "category_icon": category.icon if category else None,
                "category_color": category.color if category else None,
                "is_overbudget": remaining < 0,
                "is_near_budget": 80 <= percentage < 100,
            })
    
    return {
        "month": month,
        "year": year,
        "overbudget_items": overbudget_items,
        "has_overbudget": any(item["is_overbudget"] for item in overbudget_items),
        "has_near_budget": any(item["is_near_budget"] for item in overbudget_items),
    }
