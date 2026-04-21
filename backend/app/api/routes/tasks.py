from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import col, func, select, and_

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Task,
    TaskCreate,
    TaskPublic,
    TasksPublic,
    TaskUpdate,
    TaskStatistics,
    TaskTrend,
    TaskTrendDay,
    TaskStatus,
    TaskPriority,
    Message,
    TaskWithSubtasks,
    TasksWithSubtasksPublic,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_datetime_now() -> datetime:
    return datetime.now(timezone.utc)


def is_overdue(due_date: date | None, status: TaskStatus) -> bool:
    if due_date is None:
        return False
    if status == TaskStatus.DONE:
        return False
    today = date.today()
    return due_date < today


def enrich_task(task: Task) -> TaskPublic:
    task_public = TaskPublic.model_validate(task)
    task_public.is_overdue = is_overdue(task.due_date, task.status)
    return task_public


def enrich_task_with_subtasks(task: Task) -> TaskWithSubtasks:
    task_public = TaskWithSubtasks.model_validate(task)
    task_public.is_overdue = is_overdue(task.due_date, task.status)
    if task.children:
        task_public.children = [enrich_task_with_subtasks(child) for child in task.children]
    return task_public


@router.get("/", response_model=TasksPublic)
def read_tasks(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    status: TaskStatus | None = None,
    priority: TaskPriority | None = None,
    search: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    include_archived: bool = False,
    include_deleted: bool = False,
    parent_id: str | None = None,
) -> Any:
    statement = (
        select(Task)
        .where(Task.owner_id == current_user.id)
        .where(Task.is_deleted == include_deleted)
        .where(Task.is_archived == include_archived)
    )

    if status is not None:
        statement = statement.where(Task.status == status)
    if priority is not None:
        statement = statement.where(Task.priority == priority)
    if search:
        statement = statement.where(
            col(Task.title).icontains(search) | 
            col(Task.description).icontains(search)
        )
    if from_date:
        statement = statement.where(Task.due_date >= from_date)
    if to_date:
        statement = statement.where(Task.due_date <= to_date)
    if parent_id is not None:
        if parent_id == "root":
            statement = statement.where(Task.parent_id == None)
        else:
            statement = statement.where(Task.parent_id == parent_id)

    count_statement = select(func.count()).select_from(
        statement.with_only_columns(Task.id).subquery()
    )
    count = session.exec(count_statement).one()

    statement = statement.order_by(
        col(Task.priority).desc(),
        col(Task.created_at).desc()
    ).offset(skip).limit(limit)

    tasks = session.exec(statement).all()
    
    tasks_public = [enrich_task(task) for task in tasks]
    return TasksPublic(data=tasks_public, count=count)


@router.get("/tree", response_model=TasksWithSubtasksPublic)
def read_tasks_tree(
    session: SessionDep,
    current_user: CurrentUser,
    status: TaskStatus | None = None,
    priority: TaskPriority | None = None,
    search: str | None = None,
    include_archived: bool = False,
    include_deleted: bool = False,
) -> Any:
    statement = (
        select(Task)
        .where(Task.owner_id == current_user.id)
        .where(Task.is_deleted == include_deleted)
        .where(Task.is_archived == include_archived)
    )

    if status is not None:
        statement = statement.where(Task.status == status)
    if priority is not None:
        statement = statement.where(Task.priority == priority)
    if search:
        statement = statement.where(
            col(Task.title).icontains(search) | 
            col(Task.description).icontains(search)
        )

    statement = statement.order_by(
        col(Task.priority).desc(),
        col(Task.created_at).desc()
    )

    all_tasks = session.exec(statement).all()
    
    task_map: dict[str, TaskWithSubtasks] = {}
    for task in all_tasks:
        task_map[task.id] = enrich_task_with_subtasks(task)
    
    for task in all_tasks:
        if task.parent_id and task.parent_id in task_map:
            parent = task_map[task.parent_id]
            child = task_map[task.id]
            if child not in parent.children:
                parent.children.append(child)
    
    root_tasks = [task for task in task_map.values() if task.parent_id is None]
    root_tasks.sort(key=lambda t: (t.priority.value if hasattr(t.priority, 'value') else t.priority, t.created_at or ''), reverse=True)
    
    return TasksWithSubtasksPublic(data=root_tasks, count=len(root_tasks))


@router.get("/trash", response_model=TasksPublic)
def read_trash(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    statement = (
        select(Task)
        .where(Task.owner_id == current_user.id)
        .where(Task.is_deleted == True)
        .order_by(col(Task.updated_at).desc())
        .offset(skip)
        .limit(limit)
    )

    count_statement = select(func.count()).select_from(
        select(Task.id).where(
            Task.owner_id == current_user.id,
            Task.is_deleted == True
        ).subquery()
    )
    count = session.exec(count_statement).one()

    tasks = session.exec(statement).all()
    
    tasks_public = [enrich_task(task) for task in tasks]
    return TasksPublic(data=tasks_public, count=count)


@router.delete("/trash/empty", response_model=Message)
def empty_trash(
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    statement = select(Task).where(
        Task.owner_id == current_user.id,
        Task.is_deleted == True
    )
    
    tasks = session.exec(statement).all()
    
    for task in tasks:
        session.delete(task)
    
    session.commit()
    
    return Message(message=f"Deleted {len(tasks)} tasks from trash")


@router.get("/archived", response_model=TasksPublic)
def read_archived(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    statement = (
        select(Task)
        .where(Task.owner_id == current_user.id)
        .where(Task.is_archived == True)
        .where(Task.is_deleted == False)
        .order_by(col(Task.updated_at).desc())
        .offset(skip)
        .limit(limit)
    )

    count_statement = select(func.count()).select_from(
        select(Task.id).where(
            Task.owner_id == current_user.id,
            Task.is_archived == True,
            Task.is_deleted == False
        ).subquery()
    )
    count = session.exec(count_statement).one()

    tasks = session.exec(statement).all()
    
    tasks_public = [enrich_task(task) for task in tasks]
    return TasksPublic(data=tasks_public, count=count)


@router.get("/statistics", response_model=TaskStatistics)
def get_task_statistics(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    today = date.today()
    
    base_statement = select(Task).where(
        Task.owner_id == current_user.id,
        Task.is_deleted == False,
        Task.is_archived == False
    )
    
    total_count = session.exec(
        select(func.count()).select_from(base_statement.with_only_columns(Task.id).subquery())
    ).one()
    
    todo_count = session.exec(
        select(func.count()).select_from(
            base_statement.where(Task.status == TaskStatus.TODO).with_only_columns(Task.id).subquery()
        )
    ).one()
    
    in_progress_count = session.exec(
        select(func.count()).select_from(
            base_statement.where(Task.status == TaskStatus.IN_PROGRESS).with_only_columns(Task.id).subquery()
        )
    ).one()
    
    done_count = session.exec(
        select(func.count()).select_from(
            base_statement.where(Task.status == TaskStatus.DONE).with_only_columns(Task.id).subquery()
        )
    ).one()
    
    cancelled_count = session.exec(
        select(func.count()).select_from(
            base_statement.where(Task.status == TaskStatus.CANCELLED).with_only_columns(Task.id).subquery()
        )
    ).one()
    
    on_hold_count = session.exec(
        select(func.count()).select_from(
            base_statement.where(Task.status == TaskStatus.ON_HOLD).with_only_columns(Task.id).subquery()
        )
    ).one()
    
    overdue_count = session.exec(
        select(func.count()).select_from(
            base_statement.where(
                Task.due_date < today,
                Task.status != TaskStatus.DONE
            ).with_only_columns(Task.id).subquery()
        )
    ).one()
    
    high_count = session.exec(
        select(func.count()).select_from(
            base_statement.where(Task.priority == TaskPriority.HIGH).with_only_columns(Task.id).subquery()
        )
    ).one()
    
    urgent_count = session.exec(
        select(func.count()).select_from(
            base_statement.where(Task.priority == TaskPriority.URGENT).with_only_columns(Task.id).subquery()
        )
    ).one()
    
    archived_count = session.exec(
        select(func.count()).select_from(
            select(Task.id).where(
                Task.owner_id == current_user.id,
                Task.is_archived == True,
                Task.is_deleted == False
            ).subquery()
        )
    ).one()
    
    deleted_count = session.exec(
        select(func.count()).select_from(
            select(Task.id).where(
                Task.owner_id == current_user.id,
                Task.is_deleted == True
            ).subquery()
        )
    ).one()
    
    completion_rate = 0.0
    if total_count > 0:
        completion_rate = (done_count / total_count) * 100
    
    return TaskStatistics(
        total_tasks=total_count,
        todo_tasks=todo_count,
        in_progress_tasks=in_progress_count,
        done_tasks=done_count,
        cancelled_tasks=cancelled_count,
        on_hold_tasks=on_hold_count,
        overdue_tasks=overdue_count,
        high_priority_tasks=high_count,
        urgent_priority_tasks=urgent_count,
        completion_rate=round(completion_rate, 2),
        archived_tasks=archived_count,
        deleted_tasks=deleted_count,
    )


@router.get("/trend/{days}", response_model=TaskTrend)
def get_task_trend(
    session: SessionDep,
    current_user: CurrentUser,
    days: int = 7,
) -> Any:
    if days < 1 or days > 365:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 365")
    
    today = date.today()
    start_date = today - timedelta(days=days - 1)
    
    date_format = "%Y-%m-%d"
    
    created_data = defaultdict(int)
    completed_data = defaultdict(int)
    
    created_statement = select(
        func.strftime("%Y-%m-%d", Task.created_at).label("date"),
        func.count().label("count")
    ).where(
        Task.owner_id == current_user.id,
        Task.created_at >= datetime.combine(start_date, datetime.min.time())
    ).group_by("date").order_by("date")
    
    created_results = session.exec(created_statement).all()
    for result in created_results:
        created_data[result.date] = result.count
    
    completed_statement = select(
        func.strftime("%Y-%m-%d", Task.completed_at).label("date"),
        func.count().label("count")
    ).where(
        Task.owner_id == current_user.id,
        Task.completed_at >= datetime.combine(start_date, datetime.min.time()),
        Task.status == TaskStatus.DONE
    ).group_by("date").order_by("date")
    
    completed_results = session.exec(completed_statement).all()
    for result in completed_results:
        completed_data[result.date] = result.count
    
    today_date = date.today()
    overdue_count = session.exec(
        select(func.count()).select_from(
            select(Task.id).where(
                Task.owner_id == current_user.id,
                Task.due_date < today_date,
                Task.status != TaskStatus.DONE,
                Task.is_deleted == False
            ).subquery()
        )
    ).one()
    
    trend_days = []
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        date_str = current_date.strftime(date_format)
        
        created_count = created_data.get(date_str, 0)
        completed_count = completed_data.get(date_str, 0)
        
        is_today = current_date == today
        overdue_count_day = overdue_count if is_today else 0
        
        trend_days.append(TaskTrendDay(
            date=date_str,
            created_count=created_count,
            completed_count=completed_count,
            overdue_count=overdue_count_day,
        ))
    
    return TaskTrend(days=trend_days)


@router.post("/", response_model=TaskPublic)
def create_task(
    *, session: SessionDep, current_user: CurrentUser, task_in: TaskCreate
) -> Any:
    if task_in.parent_id:
        parent_task = session.get(Task, task_in.parent_id)
        if not parent_task or parent_task.owner_id != current_user.id:
            raise HTTPException(status_code=400, detail="Parent task not found")

    task_data = task_in.model_dump(exclude_unset=True)
    task_data["owner_id"] = current_user.id
    task_data["created_at"] = get_datetime_now()
    task_data["updated_at"] = get_datetime_now()
    
    task = Task.model_validate(task_data)
    session.add(task)
    session.commit()
    session.refresh(task)
    
    return enrich_task(task)


@router.get("/{id}", response_model=TaskPublic)
def read_task(session: SessionDep, current_user: CurrentUser, id: str) -> Any:
    task = session.get(Task, id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return enrich_task(task)


@router.patch("/{id}", response_model=TaskPublic)
def update_task(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
    task_in: TaskUpdate,
) -> Any:
    task = session.get(Task, id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    update_dict = task_in.model_dump(exclude_unset=True)
    
    if task_in.parent_id:
        parent_task = session.get(Task, task_in.parent_id)
        if not parent_task or parent_task.owner_id != current_user.id:
            raise HTTPException(status_code=400, detail="Parent task not found")
        if parent_task.id == task.id:
            raise HTTPException(status_code=400, detail="Cannot set parent to self")
    
    if "status" in update_dict:
        if update_dict["status"] == TaskStatus.DONE and task.status != TaskStatus.DONE:
            update_dict["completed_at"] = get_datetime_now()
        elif update_dict["status"] != TaskStatus.DONE:
            update_dict["completed_at"] = None
    
    update_dict["updated_at"] = get_datetime_now()
    task.sqlmodel_update(update_dict)
    
    session.add(task)
    session.commit()
    session.refresh(task)
    
    return enrich_task(task)


@router.patch("/{id}/status/{status}", response_model=TaskPublic)
def update_task_status(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
    status: TaskStatus,
) -> Any:
    task = session.get(Task, id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    if status == TaskStatus.DONE and task.status != TaskStatus.DONE:
        task.completed_at = get_datetime_now()
    elif status != TaskStatus.DONE:
        task.completed_at = None
    
    task.status = status
    task.updated_at = get_datetime_now()
    
    session.add(task)
    session.commit()
    session.refresh(task)
    
    return enrich_task(task)


@router.patch("/{id}/soft-delete", response_model=Message)
def soft_delete_task(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    task = session.get(Task, id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    task.is_deleted = True
    task.updated_at = get_datetime_now()
    
    session.add(task)
    session.commit()
    
    return Message(message="Task moved to trash successfully")


@router.patch("/{id}/restore", response_model=Message)
def restore_task(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    task = session.get(Task, id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    task.is_deleted = False
    task.updated_at = get_datetime_now()
    
    session.add(task)
    session.commit()
    
    return Message(message="Task restored successfully")


@router.patch("/{id}/archive", response_model=Message)
def archive_task(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    task = session.get(Task, id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    task.is_archived = True
    task.updated_at = get_datetime_now()
    
    session.add(task)
    session.commit()
    
    return Message(message="Task archived successfully")


@router.patch("/{id}/unarchive", response_model=Message)
def unarchive_task(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    task = session.get(Task, id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    task.is_archived = False
    task.updated_at = get_datetime_now()
    
    session.add(task)
    session.commit()
    
    return Message(message="Task unarchived successfully")


@router.delete("/{id}", response_model=Message)
def delete_task(
    session: SessionDep,
    current_user: CurrentUser,
    id: str,
) -> Message:
    task = session.get(Task, id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    session.delete(task)
    session.commit()
    
    return Message(message="Task deleted permanently")
