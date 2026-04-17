import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import Habit, HabitCreate, HabitPublic, HabitsPublic, HabitUpdate, Message

router = APIRouter(prefix="/habits", tags=["habits"])


@router.get("/", response_model=HabitsPublic)
def read_habits(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve habits.
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

    habits_public = [HabitPublic.model_validate(habit) for habit in habits]
    return HabitsPublic(data=habits_public, count=count)


@router.get("/{id}", response_model=HabitPublic)
def read_habit(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get habit by ID.
    """
    habit = session.get(Habit, id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    if habit.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return habit


@router.post("/", response_model=HabitPublic)
def create_habit(
    *, session: SessionDep, current_user: CurrentUser, habit_in: HabitCreate
) -> Any:
    """
    Create new habit.
    """
    habit = Habit.model_validate(habit_in, update={"owner_id": current_user.id})
    session.add(habit)
    session.commit()
    session.refresh(habit)
    return habit


@router.patch("/{id}", response_model=HabitPublic)
def update_habit(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    habit_in: HabitUpdate,
) -> Any:
    """
    Update a habit.
    """
    habit = session.get(Habit, id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    if habit.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    update_dict = habit_in.model_dump(exclude_unset=True)
    habit.sqlmodel_update(update_dict)
    session.add(habit)
    session.commit()
    session.refresh(habit)
    return habit


@router.delete("/{id}")
def delete_habit(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    """
    Delete a habit.
    """
    habit = session.get(Habit, id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    if habit.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    session.delete(habit)
    session.commit()
    return Message(message="Habit deleted successfully")
