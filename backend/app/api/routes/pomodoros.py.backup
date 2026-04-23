from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    PomodoroDailyStats,
    PomodoroSession,
    PomodoroSessionCreate,
    PomodoroSessionPublic,
    PomodoroSessionsPublic,
    PomodoroSessionStatus,
    PomodoroSessionType,
    PomodoroSettings,
    PomodoroSettingsPublic,
    PomodoroWeeklyStats,
)

router = APIRouter(prefix="/pomodoros", tags=["pomodoros"])


def get_or_create_settings(session: SessionDep, current_user: CurrentUser) -> PomodoroSettings:
    statement = select(PomodoroSettings).where(PomodoroSettings.owner_id == current_user.id)
    settings = session.exec(statement).first()
    if not settings:
        settings = PomodoroSettings(owner_id=current_user.id)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


@router.get("/settings", response_model=PomodoroSettingsPublic)
def read_settings(session: SessionDep, current_user: CurrentUser) -> Any:
    return get_or_create_settings(session, current_user)


@router.patch("/settings", response_model=PomodoroSettingsPublic)
def update_settings(
    session: SessionDep,
    current_user: CurrentUser,
    focus_duration_minutes: int | None = None,
    short_break_duration_minutes: int | None = None,
    long_break_duration_minutes: int | None = None,
    sessions_before_long_break: int | None = None,
    auto_start_breaks: bool | None = None,
    auto_start_focus: bool | None = None,
    sound_enabled: bool | None = None,
    notification_enabled: bool | None = None,
) -> Any:
    settings = get_or_create_settings(session, current_user)
    
    update_data = {}
    if focus_duration_minutes is not None:
        update_data["focus_duration_minutes"] = focus_duration_minutes
    if short_break_duration_minutes is not None:
        update_data["short_break_duration_minutes"] = short_break_duration_minutes
    if long_break_duration_minutes is not None:
        update_data["long_break_duration_minutes"] = long_break_duration_minutes
    if sessions_before_long_break is not None:
        update_data["sessions_before_long_break"] = sessions_before_long_break
    if auto_start_breaks is not None:
        update_data["auto_start_breaks"] = auto_start_breaks
    if auto_start_focus is not None:
        update_data["auto_start_focus"] = auto_start_focus
    if sound_enabled is not None:
        update_data["sound_enabled"] = sound_enabled
    if notification_enabled is not None:
        update_data["notification_enabled"] = notification_enabled
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        for key, value in update_data.items():
            setattr(settings, key, value)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    
    return settings


@router.post("/sessions", response_model=PomodoroSessionPublic)
def create_session(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    session_in: PomodoroSessionCreate,
) -> Any:
    pomodoro_session = PomodoroSession.model_validate(
        session_in, update={"owner_id": current_user.id}
    )
    session.add(pomodoro_session)
    session.commit()
    session.refresh(pomodoro_session)
    return pomodoro_session


@router.get("/sessions", response_model=PomodoroSessionsPublic)
def read_sessions(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    session_type: PomodoroSessionType | None = None,
    status: PomodoroSessionStatus | None = None,
) -> Any:
    count_statement = (
        select(func.count())
        .select_from(PomodoroSession)
        .where(PomodoroSession.owner_id == current_user.id)
    )
    
    if session_type:
        count_statement = count_statement.where(PomodoroSession.session_type == session_type)
    if status:
        count_statement = count_statement.where(PomodoroSession.status == status)
    
    count = session.exec(count_statement).one()

    statement = (
        select(PomodoroSession)
        .where(PomodoroSession.owner_id == current_user.id)
        .order_by(col(PomodoroSession.created_at).desc())
        .offset(skip)
        .limit(limit)
    )
    
    if session_type:
        statement = statement.where(PomodoroSession.session_type == session_type)
    if status:
        statement = statement.where(PomodoroSession.status == status)
    
    sessions = session.exec(statement).all()

    sessions_public = [PomodoroSessionPublic.model_validate(s) for s in sessions]
    return PomodoroSessionsPublic(data=sessions_public, count=count)


@router.get("/sessions/today", response_model=PomodoroSessionsPublic)
def read_today_sessions(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_start = today_start.replace(tzinfo=timezone.utc)
    today_end = today_start + timedelta(days=1)

    count_statement = (
        select(func.count())
        .select_from(PomodoroSession)
        .where(PomodoroSession.owner_id == current_user.id)
        .where(PomodoroSession.created_at >= today_start)
        .where(PomodoroSession.created_at < today_end)
    )
    count = session.exec(count_statement).one()

    statement = (
        select(PomodoroSession)
        .where(PomodoroSession.owner_id == current_user.id)
        .where(PomodoroSession.created_at >= today_start)
        .where(PomodoroSession.created_at < today_end)
        .order_by(col(PomodoroSession.created_at).desc())
    )
    sessions = session.exec(statement).all()

    sessions_public = [PomodoroSessionPublic.model_validate(s) for s in sessions]
    return PomodoroSessionsPublic(data=sessions_public, count=count)


@router.get("/sessions/{session_id}", response_model=PomodoroSessionPublic)
def read_session(
    session: SessionDep,
    current_user: CurrentUser,
    session_id: str,
) -> Any:
    pomodoro_session = session.get(PomodoroSession, session_id)
    if not pomodoro_session:
        raise HTTPException(status_code=404, detail="Session not found")
    if pomodoro_session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return pomodoro_session


@router.patch("/sessions/{session_id}", response_model=PomodoroSessionPublic)
def update_session(
    session: SessionDep,
    current_user: CurrentUser,
    session_id: str,
    status: PomodoroSessionStatus | None = None,
    actual_duration_seconds: int | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    title: str | None = None,
    description: str | None = None,
) -> Any:
    pomodoro_session = session.get(PomodoroSession, session_id)
    if not pomodoro_session:
        raise HTTPException(status_code=404, detail="Session not found")
    if pomodoro_session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    if status is not None:
        pomodoro_session.status = status
    if actual_duration_seconds is not None:
        pomodoro_session.actual_duration_seconds = actual_duration_seconds
    if start_time is not None:
        pomodoro_session.start_time = start_time
    if end_time is not None:
        pomodoro_session.end_time = end_time
    if title is not None:
        pomodoro_session.title = title
    if description is not None:
        pomodoro_session.description = description
    
    session.add(pomodoro_session)
    session.commit()
    session.refresh(pomodoro_session)
    return pomodoro_session


@router.post("/sessions/{session_id}/start", response_model=PomodoroSessionPublic)
def start_session(
    session: SessionDep,
    current_user: CurrentUser,
    session_id: str,
) -> Any:
    pomodoro_session = session.get(PomodoroSession, session_id)
    if not pomodoro_session:
        raise HTTPException(status_code=404, detail="Session not found")
    if pomodoro_session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    pomodoro_session.status = PomodoroSessionStatus.RUNNING
    pomodoro_session.start_time = datetime.now(timezone.utc)
    session.add(pomodoro_session)
    session.commit()
    session.refresh(pomodoro_session)
    return pomodoro_session


@router.post("/sessions/{session_id}/pause", response_model=PomodoroSessionPublic)
def pause_session(
    session: SessionDep,
    current_user: CurrentUser,
    session_id: str,
) -> Any:
    pomodoro_session = session.get(PomodoroSession, session_id)
    if not pomodoro_session:
        raise HTTPException(status_code=404, detail="Session not found")
    if pomodoro_session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if pomodoro_session.status != PomodoroSessionStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Session is not running")
    
    pomodoro_session.status = PomodoroSessionStatus.PAUSED
    session.add(pomodoro_session)
    session.commit()
    session.refresh(pomodoro_session)
    return pomodoro_session


@router.post("/sessions/{session_id}/resume", response_model=PomodoroSessionPublic)
def resume_session(
    session: SessionDep,
    current_user: CurrentUser,
    session_id: str,
) -> Any:
    pomodoro_session = session.get(PomodoroSession, session_id)
    if not pomodoro_session:
        raise HTTPException(status_code=404, detail="Session not found")
    if pomodoro_session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if pomodoro_session.status != PomodoroSessionStatus.PAUSED:
        raise HTTPException(status_code=400, detail="Session is not paused")
    
    pomodoro_session.status = PomodoroSessionStatus.RUNNING
    session.add(pomodoro_session)
    session.commit()
    session.refresh(pomodoro_session)
    return pomodoro_session


@router.post("/sessions/{session_id}/complete", response_model=PomodoroSessionPublic)
def complete_session(
    session: SessionDep,
    current_user: CurrentUser,
    session_id: str,
    actual_duration_seconds: int | None = None,
) -> Any:
    pomodoro_session = session.get(PomodoroSession, session_id)
    if not pomodoro_session:
        raise HTTPException(status_code=404, detail="Session not found")
    if pomodoro_session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    pomodoro_session.status = PomodoroSessionStatus.COMPLETED
    pomodoro_session.end_time = datetime.now(timezone.utc)
    
    if actual_duration_seconds is not None:
        pomodoro_session.actual_duration_seconds = actual_duration_seconds
    elif pomodoro_session.start_time:
        actual_duration = (pomodoro_session.end_time - pomodoro_session.start_time).total_seconds()
        pomodoro_session.actual_duration_seconds = int(actual_duration)
    
    session.add(pomodoro_session)
    session.commit()
    session.refresh(pomodoro_session)
    return pomodoro_session


@router.post("/sessions/{session_id}/cancel", response_model=PomodoroSessionPublic)
def cancel_session(
    session: SessionDep,
    current_user: CurrentUser,
    session_id: str,
) -> Any:
    pomodoro_session = session.get(PomodoroSession, session_id)
    if not pomodoro_session:
        raise HTTPException(status_code=404, detail="Session not found")
    if pomodoro_session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    pomodoro_session.status = PomodoroSessionStatus.CANCELLED
    pomodoro_session.end_time = datetime.now(timezone.utc)
    session.add(pomodoro_session)
    session.commit()
    session.refresh(pomodoro_session)
    return pomodoro_session


@router.delete("/sessions/{session_id}")
def delete_session(
    session: SessionDep,
    current_user: CurrentUser,
    session_id: str,
) -> Message:
    pomodoro_session = session.get(PomodoroSession, session_id)
    if not pomodoro_session:
        raise HTTPException(status_code=404, detail="Session not found")
    if pomodoro_session.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    session.delete(pomodoro_session)
    session.commit()
    return Message(message="Session deleted successfully")


@router.get("/stats/daily", response_model=PomodoroDailyStats)
def read_daily_stats(
    session: SessionDep,
    current_user: CurrentUser,
    date_str: str | None = None,
) -> Any:
    if date_str:
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        target_date = date.today()
    
    day_start = datetime.combine(target_date, datetime.min.time())
    day_start = day_start.replace(tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    statement = select(PomodoroSession).where(
        PomodoroSession.owner_id == current_user.id,
        PomodoroSession.status == PomodoroSessionStatus.COMPLETED,
        PomodoroSession.created_at >= day_start,
        PomodoroSession.created_at < day_end,
    )
    sessions = session.exec(statement).all()

    total_focus_sessions = 0
    total_focus_minutes = 0.0
    total_break_sessions = 0
    total_break_minutes = 0.0

    for s in sessions:
        duration = s.actual_duration_seconds or (s.duration_minutes * 60)
        duration_minutes = duration / 60

        if s.session_type == PomodoroSessionType.FOCUS:
            total_focus_sessions += 1
            total_focus_minutes += duration_minutes
        else:
            total_break_sessions += 1
            total_break_minutes += duration_minutes

    return PomodoroDailyStats(
        date=target_date.isoformat(),
        total_focus_sessions=total_focus_sessions,
        total_focus_minutes=round(total_focus_minutes, 1),
        total_break_sessions=total_break_sessions,
        total_break_minutes=round(total_break_minutes, 1),
    )


@router.get("/stats/weekly", response_model=PomodoroWeeklyStats)
def read_weekly_stats(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    
    days: list[PomodoroDailyStats] = []
    total_focus_sessions = 0
    total_focus_minutes = 0.0

    for i in range(7):
        target_date = week_start + timedelta(days=i)
        day_start = datetime.combine(target_date, datetime.min.time())
        day_start = day_start.replace(tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)

        statement = select(PomodoroSession).where(
            PomodoroSession.owner_id == current_user.id,
            PomodoroSession.status == PomodoroSessionStatus.COMPLETED,
            PomodoroSession.created_at >= day_start,
            PomodoroSession.created_at < day_end,
        )
        sessions = session.exec(statement).all()

        daily_focus_sessions = 0
        daily_focus_minutes = 0.0
        daily_break_sessions = 0
        daily_break_minutes = 0.0

        for s in sessions:
            duration = s.actual_duration_seconds or (s.duration_minutes * 60)
            duration_minutes = duration / 60

            if s.session_type == PomodoroSessionType.FOCUS:
                daily_focus_sessions += 1
                daily_focus_minutes += duration_minutes
            else:
                daily_break_sessions += 1
                daily_break_minutes += duration_minutes

        days.append(
            PomodoroDailyStats(
                date=target_date.isoformat(),
                total_focus_sessions=daily_focus_sessions,
                total_focus_minutes=round(daily_focus_minutes, 1),
                total_break_sessions=daily_break_sessions,
                total_break_minutes=round(daily_break_minutes, 1),
            )
        )

        total_focus_sessions += daily_focus_sessions
        total_focus_minutes += daily_focus_minutes

    return PomodoroWeeklyStats(
        days=days,
        total_focus_sessions=total_focus_sessions,
        total_focus_minutes=round(total_focus_minutes, 1),
    )
