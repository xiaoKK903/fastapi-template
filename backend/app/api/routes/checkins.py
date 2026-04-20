import uuid
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    CheckinCalendarDay,
    CheckinCalendarMonth,
    CheckinRecord,
    CheckinRecordCreate,
    CheckinRecordPublic,
    CheckinRecordsPublic,
    DashboardStats,
    Habit,
    HabitPublicWithStats,
    HabitsPublicWithStats,
    HabitStats,
    Message,
    MonthlyStats,
    WeeklyStats,
)

router = APIRouter(prefix="/checkins", tags=["checkins"])


def get_start_of_day(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def get_end_of_day(dt: datetime) -> datetime:
    return dt.replace(hour=23, minute=59, second=59, microsecond=999999)


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


def is_same_day(dt1: datetime, dt2: datetime) -> bool:
    return dt1.date() == dt2.date()


def calculate_streak(checkin_dates: list[datetime], end_date: datetime | None = None) -> int:
    if not checkin_dates:
        return 0

    sorted_dates = sorted(set(d.date() for d in checkin_dates), reverse=True)
    if not sorted_dates:
        return 0

    if end_date is None:
        end_date = get_utc_now().date()

    streak = 0
    current_date = end_date

    for check_date in sorted_dates:
        if check_date == current_date:
            streak += 1
            current_date -= timedelta(days=1)
        elif check_date == current_date - timedelta(days=1):
            streak += 1
            current_date = check_date
        else:
            break

    return streak


def calculate_longest_streak(checkin_dates: list[datetime]) -> int:
    if not checkin_dates:
        return 0

    sorted_dates = sorted(set(d.date() for d in checkin_dates))
    if not sorted_dates:
        return 0

    longest_streak = 1
    current_streak = 1

    for i in range(1, len(sorted_dates)):
        if sorted_dates[i] - sorted_dates[i - 1] == timedelta(days=1):
            current_streak += 1
            longest_streak = max(longest_streak, current_streak)
        else:
            current_streak = 1

    return longest_streak


def calculate_completion_rate(
    checkin_dates: list[datetime],
    habit_created_at: datetime | None,
    frequency: str,
) -> float:
    if not checkin_dates:
        return 0.0

    now = get_utc_now()

    if habit_created_at is None:
        start_date = now - timedelta(days=30)
    else:
        start_date = max(habit_created_at, now - timedelta(days=365))

    unique_dates = set(d.date() for d in checkin_dates)
    total_checkins = len(unique_dates)

    if frequency == "daily":
        days_since_start = (now.date() - start_date.date()).days + 1
        total_possible = max(1, days_since_start)
        return round((total_checkins / total_possible) * 100, 1)
    elif frequency == "weekly":
        weeks_since_start = max(1, ((now.date() - start_date.date()).days // 7) + 1)
        total_possible = weeks_since_start
        return round((total_checkins / total_possible) * 100, 1)
    elif frequency == "monthly":
        months_since_start = (
            (now.year - start_date.year) * 12 + (now.month - start_date.month) + 1
        )
        total_possible = max(1, months_since_start)
        return round((total_checkins / total_possible) * 100, 1)

    return 0.0


@router.post("/", response_model=CheckinRecordPublic)
def create_checkin(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    checkin_in: CheckinRecordCreate,
) -> Any:
    """
    Create a new checkin. Same habit can only be checked once per day.
    """
    habit = session.get(Habit, checkin_in.habit_id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    if habit.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    now = get_utc_now()
    start_of_today = get_start_of_day(now)
    end_of_today = get_end_of_day(now)

    existing_checkin = session.exec(
        select(CheckinRecord).where(
            CheckinRecord.habit_id == habit.id,
            CheckinRecord.user_id == current_user.id,
            CheckinRecord.checkin_date >= start_of_today,
            CheckinRecord.checkin_date <= end_of_today,
        )
    ).first()

    if existing_checkin:
        raise HTTPException(
            status_code=400, detail="Already checked in for this habit today"
        )

    checkin = CheckinRecord(
        habit_id=habit.id,
        user_id=current_user.id,
        checkin_date=now,
    )
    session.add(checkin)
    session.commit()
    session.refresh(checkin)
    return checkin


@router.delete("/cancel", response_model=Message)
def cancel_checkin(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    habit_id: uuid.UUID,
    date: str | None = None,
) -> Any:
    """
    Cancel a checkin. If date is not provided, cancels today's checkin.
    Date format: YYYY-MM-DD
    """
    habit = session.get(Habit, habit_id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    if habit.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    now = get_utc_now()

    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(
                status_code=400, detail="Invalid date format. Use YYYY-MM-DD"
            )
    else:
        target_date = now

    start_of_day = get_start_of_day(target_date)
    end_of_day = get_end_of_day(target_date)

    checkin = session.exec(
        select(CheckinRecord).where(
            CheckinRecord.habit_id == habit.id,
            CheckinRecord.user_id == current_user.id,
            CheckinRecord.checkin_date >= start_of_day,
            CheckinRecord.checkin_date <= end_of_day,
        )
    ).first()

    if not checkin:
        raise HTTPException(status_code=404, detail="Checkin not found for this date")

    session.delete(checkin)
    session.commit()
    return Message(message="Checkin cancelled successfully")


@router.get("/habit/{habit_id}", response_model=CheckinRecordsPublic)
def get_checkins_by_habit(
    session: SessionDep,
    current_user: CurrentUser,
    habit_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Get all checkins for a specific habit.
    """
    habit = session.get(Habit, habit_id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    if habit.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    count_statement = (
        select(func.count())
        .select_from(CheckinRecord)
        .where(CheckinRecord.habit_id == habit_id, CheckinRecord.user_id == current_user.id)
    )
    count = session.exec(count_statement).one()

    statement = (
        select(CheckinRecord)
        .where(CheckinRecord.habit_id == habit_id, CheckinRecord.user_id == current_user.id)
        .order_by(col(CheckinRecord.checkin_date).desc())
        .offset(skip)
        .limit(limit)
    )
    checkins = session.exec(statement).all()

    checkins_public = [CheckinRecordPublic.model_validate(c) for c in checkins]
    return CheckinRecordsPublic(data=checkins_public, count=count)


@router.get("/calendar/{habit_id}", response_model=CheckinCalendarMonth)
def get_checkin_calendar(
    session: SessionDep,
    current_user: CurrentUser,
    habit_id: uuid.UUID,
    year: int | None = None,
    month: int | None = None,
) -> Any:
    """
    Get checkin calendar for a specific habit and month.
    If year/month not provided, uses current month.
    """
    habit = session.get(Habit, habit_id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    if habit.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    now = get_utc_now()
    if year is None:
        year = now.year
    if month is None:
        month = now.month

    _, days_in_month = monthrange(year, month)

    start_of_month = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
    end_of_month = datetime(year, month, days_in_month, 23, 59, 59, tzinfo=timezone.utc)

    statement = select(CheckinRecord).where(
        CheckinRecord.habit_id == habit_id,
        CheckinRecord.user_id == current_user.id,
        CheckinRecord.checkin_date >= start_of_month,
        CheckinRecord.checkin_date <= end_of_month,
    )
    checkins = session.exec(statement).all()

    checkin_dates = {c.checkin_date.date() for c in checkins}

    calendar_days = []
    for day in range(1, days_in_month + 1):
        day_date = date(year, month, day)
        has_checkin = day_date in checkin_dates
        calendar_days.append(
            CheckinCalendarDay(
                date=day_date.isoformat(),
                has_checkin=has_checkin,
                checkin_count=1 if has_checkin else 0,
            )
        )

    return CheckinCalendarMonth(year=year, month=month, days=calendar_days)


@router.get("/habits-with-stats", response_model=HabitsPublicWithStats)
def get_habits_with_stats(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Get habits with checkin statistics.
    """
    count_statement = (
        select(func.count())
        .select_from(Habit)
        .where(Habit.owner_id == current_user.id)
    )
    count = session.exec(count_statement).one()

    statement = (
        select(Habit)
        .where(Habit.owner_id == current_user.id)
        .order_by(col(Habit.created_at).desc())
        .offset(skip)
        .limit(limit)
    )
    habits = session.exec(statement).all()

    habits_with_stats = []
    now = get_utc_now()
    start_of_today = get_start_of_day(now)
    end_of_today = get_end_of_day(now)

    for habit in habits:
        checkins_statement = select(CheckinRecord).where(
            CheckinRecord.habit_id == habit.id,
            CheckinRecord.user_id == current_user.id,
        )
        checkins = session.exec(checkins_statement).all()
        checkin_dates = [c.checkin_date for c in checkins]

        today_checkin = session.exec(
            select(CheckinRecord).where(
                CheckinRecord.habit_id == habit.id,
                CheckinRecord.user_id == current_user.id,
                CheckinRecord.checkin_date >= start_of_today,
                CheckinRecord.checkin_date <= end_of_today,
            )
        ).first()

        habit_public = HabitPublicWithStats.model_validate(habit)
        habit_public.total_checkins = len(checkin_dates)
        habit_public.current_streak = calculate_streak(checkin_dates)
        habit_public.longest_streak = calculate_longest_streak(checkin_dates)
        habit_public.completion_rate = calculate_completion_rate(
            checkin_dates, habit.created_at, habit.frequency.value
        )
        habit_public.is_checked_today = today_checkin is not None

        habits_with_stats.append(habit_public)

    return HabitsPublicWithStats(data=habits_with_stats, count=count)


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_stats(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Get dashboard statistics for current user.
    """
    now = get_utc_now()

    habits_statement = select(Habit).where(Habit.owner_id == current_user.id)
    habits = session.exec(habits_statement).all()
    total_habits = len(habits)

    week_start = now - timedelta(days=now.weekday())
    week_start = get_start_of_day(week_start)
    week_end = get_end_of_day(now)

    month_start = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=timezone.utc)
    month_end = get_end_of_day(now)

    weekly_checkins_statement = select(CheckinRecord).where(
        CheckinRecord.user_id == current_user.id,
        CheckinRecord.checkin_date >= week_start,
        CheckinRecord.checkin_date <= week_end,
    )
    weekly_checkins = session.exec(weekly_checkins_statement).all()
    weekly_habit_ids = {c.habit_id for c in weekly_checkins}

    monthly_checkins_statement = select(CheckinRecord).where(
        CheckinRecord.user_id == current_user.id,
        CheckinRecord.checkin_date >= month_start,
        CheckinRecord.checkin_date <= month_end,
    )
    monthly_checkins = session.exec(monthly_checkins_statement).all()
    monthly_habit_ids = {c.habit_id for c in monthly_checkins}

    days_in_week = 7
    weekly_completion_rate = 0.0
    if total_habits > 0:
        weekly_completion_rate = round(
            (len(weekly_checkins) / (total_habits * days_in_week)) * 100, 1
        )

    days_in_month = now.day
    monthly_completion_rate = 0.0
    if total_habits > 0:
        monthly_completion_rate = round(
            (len(monthly_checkins) / (total_habits * days_in_month)) * 100, 1
        )

    habit_stats_list = []
    longest_streak_overall = 0
    longest_streak_habit_name = None

    for habit in habits:
        checkins_statement = select(CheckinRecord).where(
            CheckinRecord.habit_id == habit.id,
            CheckinRecord.user_id == current_user.id,
        )
        checkins = session.exec(checkins_statement).all()
        checkin_dates = [c.checkin_date for c in checkins]

        current_streak = calculate_streak(checkin_dates)
        longest_streak = calculate_longest_streak(checkin_dates)
        completion_rate = calculate_completion_rate(
            checkin_dates, habit.created_at, habit.frequency.value
        )

        habit_stats = HabitStats(
            habit_id=habit.id,
            habit_name=habit.name,
            total_checkins=len(checkin_dates),
            current_streak=current_streak,
            longest_streak=longest_streak,
            completion_rate=completion_rate,
        )
        habit_stats_list.append(habit_stats)

        if longest_streak > longest_streak_overall:
            longest_streak_overall = longest_streak
            longest_streak_habit_name = habit.name

    top_habits = sorted(habit_stats_list, key=lambda h: h.completion_rate, reverse=True)[:5]

    weekly_stats = WeeklyStats(
        total_checkins=len(weekly_checkins),
        habits_with_checkins=len(weekly_habit_ids),
        completion_rate=weekly_completion_rate,
    )

    monthly_stats = MonthlyStats(
        total_checkins=len(monthly_checkins),
        habits_with_checkins=len(monthly_habit_ids),
        completion_rate=monthly_completion_rate,
    )

    return DashboardStats(
        weekly=weekly_stats,
        monthly=monthly_stats,
        top_habits=top_habits,
        longest_streak=longest_streak_overall,
        longest_streak_habit_name=longest_streak_habit_name,
        total_habits=total_habits,
    )
