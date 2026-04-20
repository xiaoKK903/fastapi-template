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
        statement = statement.where(HabitRecord.check_date >= start_date)
    if end_date:
        statement = statement.where(HabitRecord.check_date <= end_date)
    
    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()
    
    statement = statement.order_by(col(HabitRecord.check_date).desc()).offset(skip).limit(limit)
    records = session.exec(statement).all()
    
    records_public = [HabitRecordPublic.model_validate(record) for record in records]
    return HabitRecordsPublic(data=records_public, count=count)


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
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)
    
    habits = session.exec(
        select(Habit).where(Habit.owner_id == current_user.id)
    ).all()
    
    records = session.exec(
        select(HabitRecord)
        .where(HabitRecord.owner_id == current_user.id)
        .where(HabitRecord.check_date >= start_date)
        .where(HabitRecord.check_date <= end_date)
    ).all()
    
    records_by_date = defaultdict(list)
    for record in records:
        records_by_date[record.check_date].append(record)
    
    days: list[HabitCalendarDay] = []
    for day in range(1, end_date.day + 1):
        current_date = date(year, month, day)
        day_records = records_by_date.get(current_date, [])
        
        habit_ids = [r.habit_id for r in day_records]
        completed_count = len(day_records)
        total_count = len(habits)
        
        days.append(
            HabitCalendarDay(
                date=current_date,
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
    
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)
    
    habits = session.exec(
        select(Habit).where(Habit.owner_id == current_user.id)
    ).all()
    total_habits = len(habits)
    
    records = session.exec(
        select(HabitRecord)
        .where(HabitRecord.owner_id == current_user.id)
        .where(HabitRecord.check_date >= start_date)
        .where(HabitRecord.check_date <= end_date)
    ).all()
    
    records_by_date = defaultdict(list)
    for record in records:
        records_by_date[record.check_date].append(record)
    
    trend_days: list[HabitTrendDay] = []
    for i in range(days):
        current_date = end_date - timedelta(days=days - 1 - i)
        day_records = records_by_date.get(current_date, [])
        
        completed_count = len(day_records)
        
        trend_days.append(
            HabitTrendDay(
                date=current_date,
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
    end_date = date.today()
    start_date = end_date - timedelta(days=30)
    
    habits = session.exec(
        select(Habit).where(Habit.owner_id == current_user.id)
    ).all()
    total_habits = len(habits)
    
    records = session.exec(
        select(HabitRecord)
        .where(HabitRecord.owner_id == current_user.id)
        .where(HabitRecord.check_date >= start_date)
        .where(HabitRecord.check_date <= end_date)
    ).all()
    
    total_checks_last_30_days = len(records)
    
    records_by_date = defaultdict(list)
    for record in records:
        records_by_date[record.check_date].append(record)
    
    active_days = len(records_by_date.keys())
    average_checks_per_day = total_checks_last_30_days / 30 if total_checks_last_30_days > 0 else 0
    
    most_active_day = None
    max_checks = 0
    for check_date, day_records in records_by_date.items():
        if len(day_records) > max_checks:
            max_checks = len(day_records)
            most_active_day = check_date.strftime("%Y-%m-%d")
    
    streak_days = 0
    current_date = end_date
    while True:
        if current_date in records_by_date:
            streak_days += 1
            current_date -= timedelta(days=1)
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
    
    existing_records = session.exec(
        select(HabitRecord)
        .where(HabitRecord.habit_id == record_in.habit_id)
        .where(HabitRecord.check_date == record_in.check_date)
    ).all()
    
    if existing_records:
        raise HTTPException(
            status_code=400, detail="Habit already checked for this date")
    
    record = HabitRecord(
        habit_id=record_in.habit_id,
        check_date=record_in.check_date,
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
