from datetime import date, datetime, timedelta
from typing import Any
from collections import defaultdict

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select, and_

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Transaction,
    TransactionCreate,
    TransactionPublic,
    TransactionUpdate,
    TransactionType,
    TransactionWithCategory,
    TransactionsWithCategoryPublic,
    Category,
    MonthlySummary,
    CategoryMonthlySummary,
    CategoryMonthlySummaries,
    DailyTrend,
    DailyTrends,
    YearlySummary,
    Message,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])


def date_to_datetime(d: date) -> datetime:
    return datetime.combine(d, datetime.min.time())


def datetime_to_str(dt: datetime | date) -> str:
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d")
    return dt.strftime("%Y-%m-%d")


def truncate_datetime(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def round_amount(amount: float, decimals: int = 2) -> float:
    return round(amount, decimals)


@router.get("/", response_model=TransactionsWithCategoryPublic)
def read_transactions(
    session: SessionDep,
    current_user: CurrentUser,
    category_id: str | None = None,
    type: TransactionType | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    min_amount: float | None = None,
    max_amount: float | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    statement = (
        select(Transaction, Category)
        .join(Category, Transaction.category_id == Category.id)
        .where(Transaction.owner_id == current_user.id)
    )
    
    if category_id:
        statement = statement.where(Transaction.category_id == category_id)
    if type:
        statement = statement.where(Transaction.type == type)
    if start_date:
        statement = statement.where(Transaction.transaction_date >= start_date)
    if end_date:
        statement = statement.where(Transaction.transaction_date <= end_date)
    if min_amount is not None and min_amount > 0:
        statement = statement.where(Transaction.amount >= min_amount)
    if max_amount is not None and max_amount > 0:
        statement = statement.where(Transaction.amount <= max_amount)
    if search:
        statement = statement.where(
            col(Transaction.description).icontains(search) | 
            col(Category.name).icontains(search)
        )
    
    count_statement = select(func.count()).select_from(
        statement.with_only_columns(Transaction.id).subquery()
    )
    count = session.exec(count_statement).one()
    
    statement = statement.order_by(
        col(Transaction.transaction_date).desc(),
        col(Transaction.created_at).desc()
    ).offset(skip).limit(limit)
    
    results = session.exec(statement).all()
    
    transactions_with_category = []
    for transaction, category in results:
        transactions_with_category.append(
            TransactionWithCategory(
                id=transaction.id,
                amount=round_amount(transaction.amount),
                type=transaction.type,
                description=transaction.description,
                transaction_date=transaction.transaction_date,
                category_id=transaction.category_id,
                category_name=category.name,
                category_icon=category.icon,
                category_color=category.color,
                created_at=transaction.created_at,
            )
        )
    
    return TransactionsWithCategoryPublic(
        data=transactions_with_category,
        count=count
    )


@router.get("/{id}", response_model=TransactionWithCategory)
def read_transaction(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Any:
    result = session.exec(
        select(Transaction, Category)
        .join(Category, Transaction.category_id == Category.id)
        .where(Transaction.id == id)
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    transaction, category = result
    
    if transaction.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return TransactionWithCategory(
        id=transaction.id,
        amount=round_amount(transaction.amount),
        type=transaction.type,
        description=transaction.description,
        transaction_date=transaction.transaction_date,
        category_id=transaction.category_id,
        category_name=category.name,
        category_icon=category.icon,
        category_color=category.color,
        created_at=transaction.created_at,
    )


@router.post("/", response_model=TransactionPublic)
def create_transaction(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    transaction_in: TransactionCreate,
) -> Any:
    category = session.get(Category, transaction_in.category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if category.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    transaction = Transaction.model_validate(
        transaction_in,
        update={
            "owner_id": current_user.id,
            "amount": round_amount(transaction_in.amount),
        }
    )
    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return transaction


@router.patch("/{id}", response_model=TransactionPublic)
def update_transaction(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
    transaction_in: TransactionUpdate,
) -> Any:
    transaction = session.get(Transaction, id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if transaction.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    if transaction_in.category_id:
        category = session.get(Category, transaction_in.category_id)
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        if category.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
    
    update_dict = transaction_in.model_dump(exclude_unset=True)
    
    if "amount" in update_dict and update_dict["amount"] is not None:
        update_dict["amount"] = round_amount(update_dict["amount"])
    
    transaction.sqlmodel_update(update_dict)
    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return transaction


@router.delete("/{id}")
def delete_transaction(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    transaction = session.get(Transaction, id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if transaction.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    session.delete(transaction)
    session.commit()
    return Message(message="Transaction deleted successfully")


@router.get("/summary/monthly", response_model=MonthlySummary)
def get_monthly_summary(
    session: SessionDep,
    current_user: CurrentUser,
    year: int | None = None,
    month: int | None = None,
) -> Any:
    today = date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month
    
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Invalid month")
    
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)
    
    income_statement = (
        select(func.sum(Transaction.amount))
        .where(Transaction.owner_id == current_user.id)
        .where(Transaction.type == TransactionType.INCOME)
        .where(Transaction.transaction_date >= start_date)
        .where(Transaction.transaction_date < end_date)
    )
    income_amount = session.exec(income_statement).one() or 0.0
    
    expense_statement = (
        select(func.sum(Transaction.amount))
        .where(Transaction.owner_id == current_user.id)
        .where(Transaction.type == TransactionType.EXPENSE)
        .where(Transaction.transaction_date >= start_date)
        .where(Transaction.transaction_date < end_date)
    )
    expense_amount = session.exec(expense_statement).one() or 0.0
    
    income_count_statement = (
        select(func.count())
        .select_from(Transaction)
        .where(Transaction.owner_id == current_user.id)
        .where(Transaction.type == TransactionType.INCOME)
        .where(Transaction.transaction_date >= start_date)
        .where(Transaction.transaction_date < end_date)
    )
    income_count = session.exec(income_count_statement).one()
    
    expense_count_statement = (
        select(func.count())
        .select_from(Transaction)
        .where(Transaction.owner_id == current_user.id)
        .where(Transaction.type == TransactionType.EXPENSE)
        .where(Transaction.transaction_date >= start_date)
        .where(Transaction.transaction_date < end_date)
    )
    expense_count = session.exec(expense_count_statement).one()
    
    return MonthlySummary(
        month=month,
        year=year,
        total_income=round_amount(income_amount),
        total_expense=round_amount(expense_amount),
        balance=round_amount(income_amount - expense_amount),
        income_count=income_count,
        expense_count=expense_count,
    )


@router.get("/summary/categories", response_model=CategoryMonthlySummaries)
def get_category_monthly_summary(
    session: SessionDep,
    current_user: CurrentUser,
    year: int | None = None,
    month: int | None = None,
) -> Any:
    today = date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month
    
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Invalid month")
    
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)
    
    statement = (
        select(
            Category.id,
            Category.name,
            Category.icon,
            Category.color,
            Category.type,
            func.sum(Transaction.amount).label("total_amount"),
            func.count(Transaction.id).label("transaction_count"),
        )
        .join(Category, Transaction.category_id == Category.id)
        .where(Transaction.owner_id == current_user.id)
        .where(Transaction.transaction_date >= start_date)
        .where(Transaction.transaction_date < end_date)
        .group_by(Category.id, Category.name, Category.icon, Category.color, Category.type)
    )
    
    results = session.exec(statement).all()
    
    income_categories = []
    expense_categories = []
    total_income = 0.0
    total_expense = 0.0
    
    for result in results:
        category_id, name, icon, color, type_, total_amount, transaction_count = result
        total_amount = round_amount(total_amount or 0.0)
        
        if type_ == TransactionType.INCOME:
            total_income += total_amount
        else:
            total_expense += total_amount
        
        summary = CategoryMonthlySummary(
            category_id=category_id,
            category_name=name,
            category_icon=icon,
            category_color=color,
            type=type_,
            total_amount=total_amount,
            transaction_count=transaction_count,
            percentage=0.0,
        )
        
        if type_ == TransactionType.INCOME:
            income_categories.append(summary)
        else:
            expense_categories.append(summary)
    
    for category in income_categories:
        if total_income > 0:
            category.percentage = round_amount(category.total_amount / total_income * 100)
    
    for category in expense_categories:
        if total_expense > 0:
            category.percentage = round_amount(category.total_amount / total_expense * 100)
    
    income_categories.sort(key=lambda x: x.total_amount, reverse=True)
    expense_categories.sort(key=lambda x: x.total_amount, reverse=True)
    
    return CategoryMonthlySummaries(
        income_categories=income_categories,
        expense_categories=expense_categories,
        total_income=round_amount(total_income),
        total_expense=round_amount(total_expense),
    )


@router.get("/trend/daily", response_model=DailyTrends)
def get_daily_trend(
    session: SessionDep,
    current_user: CurrentUser,
    days: int = 30,
) -> Any:
    if days < 1 or days > 365:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 365")
    
    today = date.today()
    start_date = today - timedelta(days=days - 1)
    
    statement = (
        select(
            Transaction.transaction_date,
            Transaction.type,
            func.sum(Transaction.amount).label("total_amount"),
        )
        .where(Transaction.owner_id == current_user.id)
        .where(Transaction.transaction_date >= start_date)
        .group_by(Transaction.transaction_date, Transaction.type)
        .order_by(Transaction.transaction_date)
    )
    
    results = session.exec(statement).all()
    
    daily_data = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
    for transaction_date, type_, total_amount in results:
        date_key = datetime_to_str(transaction_date)
        amount = total_amount or 0.0
        if type_ == TransactionType.INCOME:
            daily_data[date_key]["income"] += amount
        else:
            daily_data[date_key]["expense"] += amount
    
    trend_days = []
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        date_key = datetime_to_str(current_date)
        day_data = daily_data.get(date_key, {"income": 0.0, "expense": 0.0})
        
        income = round_amount(day_data["income"])
        expense = round_amount(day_data["expense"])
        balance = round_amount(income - expense)
        
        trend_days.append(
            DailyTrend(
                date=date_key,
                income=income,
                expense=expense,
                balance=balance,
            )
        )
    
    return DailyTrends(days=trend_days)


@router.get("/summary/yearly", response_model=YearlySummary)
def get_yearly_summary(
    session: SessionDep,
    current_user: CurrentUser,
    year: int | None = None,
) -> Any:
    today = date.today()
    if year is None:
        year = today.year
    
    start_date = date(year, 1, 1)
    end_date = date(year + 1, 1, 1)
    
    income_statement = (
        select(func.sum(Transaction.amount))
        .where(Transaction.owner_id == current_user.id)
        .where(Transaction.type == TransactionType.INCOME)
        .where(Transaction.transaction_date >= start_date)
        .where(Transaction.transaction_date < end_date)
    )
    total_income = session.exec(income_statement).one() or 0.0
    
    expense_statement = (
        select(func.sum(Transaction.amount))
        .where(Transaction.owner_id == current_user.id)
        .where(Transaction.type == TransactionType.EXPENSE)
        .where(Transaction.transaction_date >= start_date)
        .where(Transaction.transaction_date < end_date)
    )
    total_expense = session.exec(expense_statement).one() or 0.0
    
    monthly_statement = (
        select(
            func.strftime("%m", Transaction.transaction_date).label("month"),
            Transaction.type,
            func.sum(Transaction.amount).label("total_amount"),
            func.count(Transaction.id).label("count"),
        )
        .where(Transaction.owner_id == current_user.id)
        .where(Transaction.transaction_date >= start_date)
        .where(Transaction.transaction_date < end_date)
        .group_by(func.strftime("%m", Transaction.transaction_date), Transaction.type)
        .order_by(func.strftime("%m", Transaction.transaction_date))
    )
    
    monthly_results = session.exec(monthly_statement).all()
    
    monthly_breakdown_dict = {}
    for month_str, type_, total_amount, count in monthly_results:
        month = int(month_str)
        if month not in monthly_breakdown_dict:
            monthly_breakdown_dict[month] = {
                "month": month,
                "income": 0.0,
                "expense": 0.0,
                "income_count": 0,
                "expense_count": 0,
            }
        
        total_amount = total_amount or 0.0
        if type_ == TransactionType.INCOME:
            monthly_breakdown_dict[month]["income"] += total_amount
            monthly_breakdown_dict[month]["income_count"] += count
        else:
            monthly_breakdown_dict[month]["expense"] += total_amount
            monthly_breakdown_dict[month]["expense_count"] += count
    
    monthly_breakdown = []
    for month in range(1, 13):
        if month in monthly_breakdown_dict:
            data = monthly_breakdown_dict[month]
            monthly_breakdown.append({
                "month": month,
                "income": round_amount(data["income"]),
                "expense": round_amount(data["expense"]),
                "balance": round_amount(data["income"] - data["expense"]),
                "income_count": data["income_count"],
                "expense_count": data["expense_count"],
            })
        else:
            monthly_breakdown.append({
                "month": month,
                "income": 0.0,
                "expense": 0.0,
                "balance": 0.0,
                "income_count": 0,
                "expense_count": 0,
            })
    
    return YearlySummary(
        year=year,
        total_income=round_amount(total_income),
        total_expense=round_amount(total_expense),
        balance=round_amount(total_income - total_expense),
        monthly_breakdown=monthly_breakdown,
    )
