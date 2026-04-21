from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, desc

from app.api.deps import SessionDep, get_current_active_superuser
from app.models import OperationLog, OperationLogsPublic

router = APIRouter(tags=["operation-logs"])


@router.get(
    "/operation-logs",
    response_model=OperationLogsPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_operation_logs(
    session: SessionDep,
    skip: int = 0,
    limit: int = 100,
    user_id: str | None = None,
    action: str | None = None,
    resource: str | None = None,
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

    count_statement = statement
    count = len(session.exec(count_statement).all())

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
