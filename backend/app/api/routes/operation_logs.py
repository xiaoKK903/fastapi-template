from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, desc, func, or_

from app.api.deps import SessionDep, get_current_active_superuser
from app.models import (
    ActionType,
    LogStatsByAction,
    LogStatsByResource,
    LogStatsByUser,
    LogStatsSummary,
    Message,
    OperationLog,
    OperationLogPublic,
    OperationLogsPublic,
    ResourceType,
)

router = APIRouter(tags=["operation-logs"])


LOG_RETENTION_DAYS = 30


@router.get(
    "/operation-logs",
    response_model=OperationLogsPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_operation_logs(
    session: SessionDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: str | None = None,
    action: str | None = None,
    resource: str | None = None,
    success: bool | None = None,
    path: str | None = None,
    ip_address: str | None = None,
    min_duration_ms: int | None = None,
    max_duration_ms: int | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
) -> OperationLogsPublic:
    statement = select(OperationLog)

    if user_id:
        statement = statement.where(OperationLog.user_id == user_id)
    if action:
        statement = statement.where(OperationLog.action == action)
    if resource:
        statement = statement.where(OperationLog.resource == resource)
    if success is not None:
        statement = statement.where(OperationLog.success == success)
    if path:
        statement = statement.where(OperationLog.request_path.contains(path))
    if ip_address:
        statement = statement.where(OperationLog.ip_address == ip_address)
    if min_duration_ms is not None:
        statement = statement.where(OperationLog.duration_ms >= min_duration_ms)
    if max_duration_ms is not None:
        statement = statement.where(OperationLog.duration_ms <= max_duration_ms)
    if start_time:
        statement = statement.where(OperationLog.created_at >= start_time)
    if end_time:
        statement = statement.where(OperationLog.created_at <= end_time)

    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()

    statement = (
        statement.order_by(desc(OperationLog.created_at)).offset(skip).limit(limit)
    )
    logs = session.exec(statement).all()

    return OperationLogsPublic(data=logs, count=count)


@router.get(
    "/operation-logs/{log_id}",
    response_model=OperationLogPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_operation_log(log_id: str, session: SessionDep) -> OperationLogPublic:
    log = session.get(OperationLog, log_id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Operation log not found",
        )
    return log


@router.get(
    "/operation-logs/stats/summary",
    response_model=LogStatsSummary,
    dependencies=[Depends(get_current_active_superuser)],
)
def get_log_stats_summary(
    session: SessionDep,
    hours: int = Query(24, ge=1, le=168),
) -> LogStatsSummary:
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(hours=hours)

    total_stmt = select(func.count()).select_from(OperationLog).where(
        OperationLog.created_at >= start_time
    )
    total_logs = session.exec(total_stmt).one()

    success_stmt = select(func.count()).select_from(OperationLog).where(
        OperationLog.created_at >= start_time,
        OperationLog.success == True,
    )
    success_count = session.exec(success_stmt).one()

    failed_count = total_logs - success_count
    success_rate = (success_count / total_logs * 100) if total_logs > 0 else 0

    avg_duration_stmt = select(func.avg(OperationLog.duration_ms)).where(
        OperationLog.created_at >= start_time,
        OperationLog.duration_ms != None,
    )
    avg_duration = session.exec(avg_duration_stmt).one()

    resource_stmt = (
        select(
            OperationLog.resource,
            func.count().label("count"),
            func.avg(OperationLog.duration_ms).label("avg_duration"),
        )
        .where(OperationLog.created_at >= start_time)
        .group_by(OperationLog.resource)
        .order_by(desc("count"))
        .limit(10)
    )
    resource_results = session.exec(resource_stmt).all()
    top_resources = [
        LogStatsByResource(
            resource=r[0],
            count=r[1],
            avg_duration_ms=float(r[2]) if r[2] else None,
        )
        for r in resource_results
    ]

    action_stmt = (
        select(
            OperationLog.action,
            func.count().label("count"),
            func.avg(OperationLog.duration_ms).label("avg_duration"),
        )
        .where(OperationLog.created_at >= start_time)
        .group_by(OperationLog.action)
        .order_by(desc("count"))
    )
    action_results = session.exec(action_stmt).all()
    top_actions = [
        LogStatsByAction(
            action=r[0],
            count=r[1],
            avg_duration_ms=float(r[2]) if r[2] else None,
        )
        for r in action_results
    ]

    user_stmt = (
        select(
            OperationLog.user_id,
            OperationLog.user_email,
            func.count().label("count"),
        )
        .where(
            OperationLog.created_at >= start_time,
            OperationLog.user_id != None,
        )
        .group_by(OperationLog.user_id, OperationLog.user_email)
        .order_by(desc("count"))
        .limit(10)
    )
    user_results = session.exec(user_stmt).all()
    top_users = [
        LogStatsByUser(
            user_id=r[0],
            user_email=r[1],
            count=r[2],
        )
        for r in user_results
    ]

    failure_stmt = (
        select(OperationLog)
        .where(
            OperationLog.created_at >= start_time,
            OperationLog.success == False,
        )
        .order_by(desc(OperationLog.created_at))
        .limit(20)
    )
    recent_failures = session.exec(failure_stmt).all()

    return LogStatsSummary(
        total_logs=total_logs,
        success_count=success_count,
        failed_count=failed_count,
        success_rate=round(success_rate, 2),
        avg_duration_ms=float(avg_duration) if avg_duration else None,
        top_resources=top_resources,
        top_actions=top_actions,
        top_users=top_users,
        recent_failures=recent_failures,
    )


@router.get(
    "/operation-logs/stats/resources",
    response_model=list[LogStatsByResource],
    dependencies=[Depends(get_current_active_superuser)],
)
def get_resource_stats(
    session: SessionDep,
    hours: int = Query(24, ge=1, le=168),
) -> list[LogStatsByResource]:
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(hours=hours)

    stmt = (
        select(
            OperationLog.resource,
            func.count().label("count"),
            func.avg(OperationLog.duration_ms).label("avg_duration"),
        )
        .where(OperationLog.created_at >= start_time)
        .group_by(OperationLog.resource)
        .order_by(desc("count"))
    )
    results = session.exec(stmt).all()

    return [
        LogStatsByResource(
            resource=r[0],
            count=r[1],
            avg_duration_ms=float(r[2]) if r[2] else None,
        )
        for r in results
    ]


@router.get(
    "/operation-logs/stats/slow-endpoints",
    response_model=list[dict],
    dependencies=[Depends(get_current_active_superuser)],
)
def get_slow_endpoints(
    session: SessionDep,
    hours: int = Query(24, ge=1, le=168),
    min_duration_ms: int = Query(1000, ge=100),
    limit: int = Query(20, ge=1, le=100),
) -> list[dict]:
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(hours=hours)

    stmt = (
        select(
            OperationLog.request_path,
            OperationLog.request_method,
            func.count().label("count"),
            func.avg(OperationLog.duration_ms).label("avg_duration"),
            func.max(OperationLog.duration_ms).label("max_duration"),
        )
        .where(
            OperationLog.created_at >= start_time,
            OperationLog.duration_ms >= min_duration_ms,
        )
        .group_by(OperationLog.request_path, OperationLog.request_method)
        .order_by(desc("avg_duration"))
        .limit(limit)
    )
    results = session.exec(stmt).all()

    return [
        {
            "path": r[0],
            "method": r[1],
            "count": r[2],
            "avg_duration_ms": float(r[3]) if r[3] else None,
            "max_duration_ms": r[4],
        }
        for r in results
    ]


@router.get(
    "/operation-logs/errors",
    response_model=OperationLogsPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def get_error_logs(
    session: SessionDep,
    hours: int = Query(24, ge=1, le=168),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> OperationLogsPublic:
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(hours=hours)

    count_stmt = select(func.count()).select_from(OperationLog).where(
        OperationLog.created_at >= start_time,
        OperationLog.success == False,
    )
    count = session.exec(count_stmt).one()

    stmt = (
        select(OperationLog)
        .where(
            OperationLog.created_at >= start_time,
            OperationLog.success == False,
        )
        .order_by(desc(OperationLog.created_at))
        .offset(skip)
        .limit(limit)
    )
    logs = session.exec(stmt).all()

    return OperationLogsPublic(data=logs, count=count)


@router.delete(
    "/operation-logs/{log_id}",
    response_model=Message,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_operation_log(log_id: str, session: SessionDep) -> Message:
    log = session.get(OperationLog, log_id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Operation log not found",
        )
    session.delete(log)
    session.commit()
    return Message(message="Operation log deleted successfully")


@router.delete(
    "/operation-logs",
    response_model=Message,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_old_logs(
    session: SessionDep,
    older_than_days: int = Query(..., ge=1, le=365),
) -> Message:
    cutoff_time = datetime.now(timezone.utc) - timedelta(days=older_than_days)

    stmt = select(OperationLog).where(OperationLog.created_at < cutoff_time)
    logs = session.exec(stmt).all()
    count = len(logs)

    for log in logs:
        session.delete(log)
    session.commit()

    return Message(message=f"Deleted {count} operation logs older than {older_than_days} days")


@router.post(
    "/operation-logs/cleanup",
    response_model=Message,
    dependencies=[Depends(get_current_active_superuser)],
)
def cleanup_expired_logs(session: SessionDep) -> Message:
    cutoff_time = datetime.now(timezone.utc) - timedelta(days=LOG_RETENTION_DAYS)

    stmt = select(OperationLog).where(OperationLog.created_at < cutoff_time)
    logs = session.exec(stmt).all()
    count = len(logs)

    for log in logs:
        session.delete(log)
    session.commit()

    return Message(
        message=f"Cleaned up {count} operation logs older than {LOG_RETENTION_DAYS} days"
    )


@router.get(
    "/operation-logs/export",
    response_model=list[OperationLogPublic],
    dependencies=[Depends(get_current_active_superuser)],
)
def export_logs(
    session: SessionDep,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    success: bool | None = None,
) -> list[OperationLogPublic]:
    statement = select(OperationLog)

    if start_time:
        statement = statement.where(OperationLog.created_at >= start_time)
    if end_time:
        statement = statement.where(OperationLog.created_at <= end_time)
    if success is not None:
        statement = statement.where(OperationLog.success == success)

    statement = statement.order_by(desc(OperationLog.created_at)).limit(10000)
    logs = session.exec(statement).all()

    return logs
