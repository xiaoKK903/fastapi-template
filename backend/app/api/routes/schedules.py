from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select, and_

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Schedule,
    ScheduleCreate,
    SchedulePublic,
    SchedulesPublic,
    ScheduleUpdate,
    Message,
    ScheduleCalendarView,
    ScheduleDayEvents,
    ScheduleColor,
    ScheduleCategory,
    ScheduleReminder,
)

router = APIRouter(prefix="/schedules", tags=["schedules"])


def get_datetime_now() -> datetime:
    return datetime.now(timezone.utc)


def enrich_schedule(schedule: Schedule) -> SchedulePublic:
    return SchedulePublic.model_validate(schedule)


@router.get("/", response_model=SchedulesPublic)
def read_schedules(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    from_date: date | None = None,
    to_date: date | None = None,
    category: ScheduleCategory | None = None,
    include_deleted: bool = False,
) -> Any:
    statement = (
        select(Schedule)
        .where(Schedule.owner_id == current_user.id)
        .where(Schedule.is_deleted == include_deleted)
    )

    if from_date:
        from_datetime = datetime.combine(from_date, datetime.min.time())
        statement = statement.where(Schedule.start_time >= from_datetime)
    if to_date:
        to_datetime = datetime.combine(to_date, datetime.max.time())
        statement = statement.where(Schedule.end_time <= to_datetime)
    if category is not None:
        statement = statement.where(Schedule.category == category)

    count_statement = select(func.count()).select_from(
        statement.with_only_columns(Schedule.id).subquery()
    )
    count = session.exec(count_statement).one()

    statement = statement.order_by(
        col(Schedule.start_time).asc(),
        col(Schedule.created_at).desc()
    ).offset(skip).limit(limit)

    schedules = session.exec(statement).all()
    
    schedules_public = [enrich_schedule(schedule) for schedule in schedules]
    return SchedulesPublic(data=schedules_public, count=count)


@router.get("/calendar", response_model=ScheduleCalendarView)
def get_calendar_view(
    session: SessionDep,
    current_user: CurrentUser,
    year: int,
    month: int,
) -> Any:
    if year < 2000 or year > 2100:
        raise HTTPException(status_code=400, detail="Year must be between 2000 and 2100")
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")

    first_day = date(year, month, 1)
    last_day = date(year, month + 1, 1) - timedelta(days=1) if month < 12 else date(year, 12, 31)
    
    start_datetime = datetime.combine(first_day, datetime.min.time())
    end_datetime = datetime.combine(last_day, datetime.max.time())

    statement = (
        select(Schedule)
        .where(Schedule.owner_id == current_user.id)
        .where(Schedule.is_deleted == False)
        .where(
            and_(
                Schedule.start_time <= end_datetime,
                Schedule.end_time >= start_datetime
            )
        )
        .order_by(col(Schedule.start_time).asc())
    )

    schedules = session.exec(statement).all()
    
    events_by_date: defaultdict[str, list[SchedulePublic]] = defaultdict(list)
    
    for schedule in schedules:
        schedule_public = enrich_schedule(schedule)
        
        if schedule.is_all_day:
            start_date = schedule.start_time.date()
            end_date = schedule.end_time.date()
            current = start_date
            while current <= end_date and current >= first_day and current <= last_day:
                date_str = current.strftime("%Y-%m-%d")
                events_by_date[date_str].append(schedule_public)
                current += timedelta(days=1)
        else:
            event_date = schedule.start_time.date()
            if first_day <= event_date <= last_day:
                date_str = event_date.strftime("%Y-%m-%d")
                events_by_date[date_str].append(schedule_public)

    days: list[ScheduleDayEvents] = []
    current = first_day
    while current <= last_day:
        date_str = current.strftime("%Y-%m-%d")
        days.append(ScheduleDayEvents(
            date=date_str,
            events=events_by_date.get(date_str, [])
        ))
        current += timedelta(days=1)

    return ScheduleCalendarView(year=year, month=month, days=days)


@router.get("/upcoming", response_model=SchedulesPublic)
def get_upcoming_schedules(
    session: SessionDep,
    current_user: CurrentUser,
    hours: int = 24,
) -> Any:
    now = get_datetime_now()
    end_time = now + timedelta(hours=hours)
    
    statement = (
        select(Schedule)
        .where(Schedule.owner_id == current_user.id)
        .where(Schedule.is_deleted == False)
        .where(
            and_(
                Schedule.start_time >= now,
                Schedule.start_time <= end_time
            )
        )
        .order_by(col(Schedule.start_time).asc())
        .limit(100)
    )

    schedules = session.exec(statement).all()
    schedules_public = [enrich_schedule(schedule) for schedule in schedules]
    
    return SchedulesPublic(data=schedules_public, count=len(schedules_public))


@router.post("/", response_model=SchedulePublic)
def create_schedule(
    *, session: SessionDep, current_user: CurrentUser, schedule_in: ScheduleCreate
) -> Any:
    schedule_data = schedule_in.model_dump(exclude_unset=True)
    schedule_data["owner_id"] = current_user.id
    schedule_data["created_at"] = get_datetime_now()
    schedule_data["updated_at"] = get_datetime_now()
    
    schedule = Schedule.model_validate(schedule_data)
    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    
    if schedule_in.reminder_minutes is not None and schedule_in.reminder_minutes > 0:
        reminder_time = schedule.start_time - timedelta(minutes=schedule_in.reminder_minutes)
        reminder = ScheduleReminder(
            schedule_id=schedule.id,
            owner_id=current_user.id,
            reminder_time=reminder_time,
        )
        session.add(reminder)
        session.commit()
    
    return enrich_schedule(schedule)


@router.get("/{id}", response_model=SchedulePublic)
def read_schedule(session: SessionDep, current_user: CurrentUser, id: str) -> Any:
    schedule = session.get(Schedule, id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if schedule.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return enrich_schedule(schedule)


@router.patch("/{id}", response_model=SchedulePublic)
def update_schedule(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
    schedule_in: ScheduleUpdate,
) -> Any:
    schedule = session.get(Schedule, id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if schedule.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    update_dict = schedule_in.model_dump(exclude_unset=True)
    update_dict["updated_at"] = get_datetime_now()
    schedule.sqlmodel_update(update_dict)
    
    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    
    if schedule_in.reminder_minutes is not None:
        old_reminders = session.exec(
            select(ScheduleReminder).where(ScheduleReminder.schedule_id == id)
        ).all()
        for reminder in old_reminders:
            session.delete(reminder)
        
        if schedule_in.reminder_minutes > 0:
            reminder_time = schedule.start_time - timedelta(minutes=schedule_in.reminder_minutes)
            new_reminder = ScheduleReminder(
                schedule_id=schedule.id,
                owner_id=current_user.id,
                reminder_time=reminder_time,
            )
            session.add(new_reminder)
    
    session.commit()
    
    return enrich_schedule(schedule)


@router.patch("/{id}/soft-delete", response_model=Message)
def soft_delete_schedule(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    schedule = session.get(Schedule, id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if schedule.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    schedule.is_deleted = True
    schedule.updated_at = get_datetime_now()
    
    session.add(schedule)
    session.commit()
    
    return Message(message="Schedule moved to trash successfully")


@router.patch("/{id}/restore", response_model=Message)
def restore_schedule(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    schedule = session.get(Schedule, id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if schedule.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    schedule.is_deleted = False
    schedule.updated_at = get_datetime_now()
    
    session.add(schedule)
    session.commit()
    
    return Message(message="Schedule restored successfully")


@router.delete("/{id}", response_model=Message)
def delete_schedule(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    schedule = session.get(Schedule, id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if schedule.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    session.delete(schedule)
    session.commit()
    
    return Message(message="Schedule deleted permanently")


@router.get("/reminders/pending", response_model=SchedulesPublic)
def get_pending_reminders(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    now = get_datetime_now()
    
    statement = (
        select(Schedule)
        .join(ScheduleReminder, ScheduleReminder.schedule_id == Schedule.id)
        .where(Schedule.owner_id == current_user.id)
        .where(Schedule.is_deleted == False)
        .where(ScheduleReminder.is_sent == False)
        .where(ScheduleReminder.reminder_time <= now)
        .order_by(col(ScheduleReminder.reminder_time).asc())
    )
    
    schedules = session.exec(statement).all()
    schedules_public = [enrich_schedule(schedule) for schedule in schedules]
    
    for schedule in schedules:
        reminders = session.exec(
            select(ScheduleReminder).where(
                ScheduleReminder.schedule_id == schedule.id,
                ScheduleReminder.is_sent == False
            )
        ).all()
        for reminder in reminders:
            reminder.is_sent = True
            reminder.sent_at = now
            session.add(reminder)
    
    session.commit()
    
    return SchedulesPublic(data=schedules_public, count=len(schedules_public))
