from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, desc, func, and_

from app.api.deps import SessionDep, get_current_active_superuser
from app.models import ActionType, OperationLog, OperationLogsPublic, ResourceType

router = APIRouter(tags=["operation-logs"])


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
    action: ActionType | None = None,
    resource: ResourceType | None = None,
    success: bool | None = None,
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

    count_statement = select(func.count(OperationLog.id)).where(
        statement.whereclause
    )
    count = session.exec(count_statement).one()

    statement = (
        statement.order_by(desc(OperationLog.created_at)).offset(skip).limit(limit)
    )
    logs = session.exec(statement).all()

    return OperationLogsPublic(data=logs, count=count)


@router.get(
    "/operation-logs/{log_id}",
    response_model=OperationLog,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_operation_log(log_id: str, session: SessionDep) -> OperationLog:
    log = session.get(OperationLog, log_id)
    if not log:
        raise ValueError("Operation log not found")
    return log


@router.get(
    "/operation-logs/stats",
    dependencies=[Depends(get_current_active_superuser)],
)
def get_log_stats(session: SessionDep) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)

    total_count = session.exec(select(func.count(OperationLog.id))).one()
    success_count = session.exec(
        select(func.count(OperationLog.id)).where(OperationLog.success == True)
    ).one()
    error_count = total_count - success_count

    avg_duration = session.exec(
        select(func.avg(OperationLog.duration_ms)).where(
            OperationLog.duration_ms.isnot(None)
        )
    ).one()

    resource_stats = session.exec(
        select(OperationLog.resource, func.count(OperationLog.id).label("count"))
        .group_by(OperationLog.resource)
        .order_by(desc("count"))
        .limit(10)
    ).all()
    top_resources = [
        {"resource": str(r), "count": int(c)} for r, c in resource_stats if r
    ]

    action_stats = session.exec(
        select(OperationLog.action, func.count(OperationLog.id).label("count"))
        .group_by(OperationLog.action)
        .order_by(desc("count"))
    ).all()
    top_actions = [
        {"action": str(a), "count": int(c)} for a, c in action_stats if a
    ]

    recent_errors = session.exec(
        select(OperationLog)
        .where(OperationLog.success == False)
        .order_by(desc(OperationLog.created_at))
        .limit(10)
    ).all()

    return {
        "total_count": int(total_count),
        "success_count": int(success_count),
        "error_count": int(error_count),
        "avg_duration_ms": int(avg_duration) if avg_duration else 0,
        "top_resources": top_resources,
        "top_actions": top_actions,
        "recent_errors": recent_errors,
    }


@router.delete(
    "/operation-logs/clean",
    dependencies=[Depends(get_current_active_superuser)],
)
def clean_old_logs(
    session: SessionDep,
    days_to_keep: int = Query(30, ge=1, le=365),
) -> dict[str, Any]:
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_to_keep)

    count_statement = select(func.count(OperationLog.id)).where(
        OperationLog.created_at < cutoff_date
    )
    delete_count = session.exec(count_statement).one()

    delete_statement = OperationLog.__table__.delete().where(
        OperationLog.created_at < cutoff_date
    )
    session.execute(delete_statement)
    session.commit()

    return {"deleted_count": int(delete_count)}


@router.delete(
    "/operation-logs/{log_id}",
    dependencies=[Depends(get_current_active_superuser)],
    status_code=204,
)
def delete_log(log_id: str, session: SessionDep) -> None:
    log = session.get(OperationLog, log_id)
    if log:
        session.delete(log)
        session.commit()
