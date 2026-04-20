from datetime import date, datetime, timedelta
from typing import Any
from collections import defaultdict

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select, and_

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Habit,
    HabitRecord,
    HabitRecordCreate,
    HabitRecordPublic,
    HabitRecordsPublic,
    HabitCalendar,
    HabitCalendarDay,
    HabitTrend,
    HabitTrendDay,
    HabitStatistics,
    Message,
)

router = APIRouter(prefix="/habit-records", tags=["habit-records"])


def date_to_datetime(d: date) -> datetime:
    return datetime.combine(d, datetime.min.time())


def datetime_to_str(dt: datetime | date) -> str:
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d")
    return dt.strftime("%Y-%m-%d")


def truncate_datetime(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/", response_model=HabitRecordsPublic)
def read_habit_records(
    session: SessionDep,
    current_user: CurrentUser,
    habit_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    statement = select(HabitRecord).where(HabitRecord.owner_id == current_user.id)
    
    if habit_id:
        statement = statement.where(HabitRecord.habit_id == habit_id)
    if start_date:
        start_dt = date_to_datetime(start_date)
        statement = statement.where(HabitRecord.check_date >= start_dt)
    if end_date:
        end_dt = date_to_datetime(end_date) + timedelta(days=1)
        statement = statement.where(HabitRecord.check_date < end_dt)
    
    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()
    
    statement = statement.order_by(col(HabitRecord.check_date).desc()).offset(skip).limit(limit)
    records = session.exec(statement).all()
    
    return HabitRecordsPublic(data=records, count=count)


@router.get("/calendar", response_model=HabitCalendar)
def get_habit_calendar(
    session: SessionDep,
    current_user: CurrentUser,
    year: int,
    month: int,
) -> Any:
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Invalid month")
    
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)
    
    start_dt = date_to_datetime(start_date)
    end_dt = date_to_datetime(end_date)
    
    habits = session.exec(
        select(Habit).where(Habit.owner_id == current_user.id)
    ).all()
    
    records = session.exec(
        select(HabitRecord)
        .where(HabitRecord.owner_id == current_user.id)
        .where(HabitRecord.check_date >= start_dt)
        .where(HabitRecord.check_date < end_dt)
    ).all()
    
    records_by_date = defaultdict(list)
    for record in records:
        date_key = datetime_to_str(record.check_date)
        records_by_date[date_key].append(record)
    
    days_in_month = (end_date - start_date).days
    days: list[HabitCalendarDay] = []
    
    for day_offset in range(days_in_month):
        current_date = start_date + timedelta(days=day_offset)
        date_key = datetime_to_str(current_date)
        day_records = records_by_date.get(date_key, [])
        
        habit_ids = [r.habit_id for r in day_records]
        completed_count = len(day_records)
        total_count = len(habits)
        
        days.append(
            HabitCalendarDay(
                date=date_key,
                total_count=total_count,
                completed_count=completed_count,
                habit_ids=habit_ids,
            )
        )
    
    return HabitCalendar(year=year, month=month, days=days)


@router.get("/trend", response_model=HabitTrend)
def get_habit_trend(
    session: SessionDep,
    current_user: CurrentUser,
    days: int = 30,
) -> Any:
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 90")
    
    today = date.today()
    end_date = today + timedelta(days=1)
    start_date = today - timedelta(days=days - 1)
    
    start_dt = date_to_datetime(start_date)
    end_dt = date_to_datetime(end_date)
    
    habits = session.exec(
        select(Habit).where(Habit.owner_id == current_user.id)
    ).all()
    total_habits = len(habits)
    
    records = session.exec(
        select(HabitRecord)
        .where(HabitRecord.owner_id == current_user.id)
        .where(HabitRecord.check_date >= start_dt)
        .where(HabitRecord.check_date < end_dt)
    ).all()
    
    records_by_date = defaultdict(list)
    for record in records:
        date_key = datetime_to_str(record.check_date)
        records_by_date[date_key].append(record)
    
    trend_days: list[HabitTrendDay] = []
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        date_key = datetime_to_str(current_date)
        day_records = records_by_date.get(date_key, [])
        
        completed_count = len(day_records)
        
        trend_days.append(
            HabitTrendDay(
                date=date_key,
                completed_count=completed_count,
                total_habits=total_habits,
            )
        )
    
    return HabitTrend(days=trend_days)


@router.get("/statistics", response_model=HabitStatistics)
def get_habit_statistics(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    today = date.today()
    end_date = today + timedelta(days=1)
    start_date = today - timedelta(days=30)
    
    start_dt = date_to_datetime(start_date)
    end_dt = date_to_datetime(end_date)
    
    habits = session.exec(
        select(Habit).where(Habit.owner_id == current_user.id)
    ).all()
    total_habits = len(habits)
    
    records = session.exec(
        select(HabitRecord)
        .where(HabitRecord.owner_id == current_user.id)
        .where(HabitRecord.check_date >= start_dt)
        .where(HabitRecord.check_date < end_dt)
    ).all()
    
    total_checks_last_30_days = len(records)
    
    records_by_date = defaultdict(list)
    for record in records:
        date_key = datetime_to_str(record.check_date)
        records_by_date[date_key].append(record)
    
    active_days = len(records_by_date.keys())
    average_checks_per_day = total_checks_last_30_days / 30 if total_checks_last_30_days > 0 else 0
    
    most_active_day = None
    max_checks = 0
    for check_date, day_records in records_by_date.items():
        if len(day_records) > max_checks:
            max_checks = len(day_records)
            most_active_day = check_date
    
    streak_days = 0
    current_check_date = today
    while True:
        date_key = datetime_to_str(current_check_date)
        if date_key in records_by_date:
            streak_days += 1
            current_check_date -= timedelta(days=1)
        else:
            break
        if streak_days >= 365:
            break
    
    return HabitStatistics(
        total_habits=total_habits,
        total_checks_last_30_days=total_checks_last_30_days,
        average_checks_per_day=average_checks_per_day,
        most_active_day=most_active_day,
        streak_days=streak_days,
    )


@router.post("/", response_model=HabitRecordPublic)
def create_habit_record(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    record_in: HabitRecordCreate,
) -> Any:
    habit = session.get(Habit, record_in.habit_id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    if habit.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    check_date_start = date_to_datetime(record_in.check_date)
    check_date_end = check_date_start + timedelta(days=1)
    
    existing_records = session.exec(
        select(HabitRecord)
        .where(HabitRecord.habit_id == record_in.habit_id)
        .where(HabitRecord.check_date >= check_date_start)
        .where(HabitRecord.check_date < check_date_end)
    ).all()
    
    if existing_records:
        raise HTTPException(
            status_code=400, detail="Habit already checked for this date")
    
    record = HabitRecord(
        habit_id=record_in.habit_id,
        check_date=check_date_start,
        count=record_in.count,
        note=record_in.note,
        owner_id=current_user.id,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.delete("/{id}")
def delete_habit_record(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    record = session.get(HabitRecord, id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if record.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    session.delete(record)
    session.commit()
    return Message(message="Habit record deleted successfully")
