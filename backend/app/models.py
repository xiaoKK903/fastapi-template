import uuid
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import EmailStr
from sqlalchemy import DateTime as SA_DateTime
from sqlmodel import Column, Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(timezone.utc)


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Frequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class User(UserBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=SA_DateTime(timezone=True),
    )
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)
    habits: list["Habit"] = Relationship(back_populates="owner", cascade_delete=True)
    habit_records: list["HabitRecord"] = Relationship(back_populates="owner", cascade_delete=True)


class UserPublic(UserBase):
    id: str
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


class HabitBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    frequency: Frequency = Field(default=Frequency.DAILY)
    target_count: int = Field(default=1, ge=1)
    description: str | None = Field(default=None, max_length=500)


class HabitCreate(HabitBase):
    pass


class HabitUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    frequency: Frequency | None = None
    target_count: int | None = Field(default=None, ge=1)
    description: str | None = Field(default=None, max_length=500)


class Habit(HabitBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=SA_DateTime(timezone=True),
    )
    owner_id: str = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="habits")
    records: list["HabitRecord"] = Relationship(back_populates="habit", cascade_delete=True)


class HabitPublic(HabitBase):
    id: str
    owner_id: str
    created_at: datetime | None = None


class HabitsPublic(SQLModel):
    data: list[HabitPublic]
    count: int


class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


class ItemCreate(ItemBase):
    pass


class ItemUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)


class Item(ItemBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=SA_DateTime(timezone=True),
    )
    owner_id: str = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


class ItemPublic(ItemBase):
    id: str
    owner_id: str
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


class HabitRecordBase(SQLModel):
    count: int = Field(default=1, ge=1)
    note: str | None = Field(default=None, max_length=500)


class HabitRecordCreate(HabitRecordBase):
    habit_id: str
    check_date: date


class HabitRecord(HabitRecordBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    habit_id: str = Field(
        foreign_key="habit.id", nullable=False, ondelete="CASCADE"
    )
    check_date: datetime = Field(sa_column=Column(SA_DateTime, nullable=False))
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=SA_DateTime(timezone=True),
    )
    owner_id: str = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    habit: Habit | None = Relationship(back_populates="records")
    owner: User | None = Relationship(back_populates="habit_records")


class HabitRecordPublic(HabitRecordBase):
    id: str
    habit_id: str
    owner_id: str
    check_date: datetime
    created_at: datetime | None = None


class HabitRecordsPublic(SQLModel):
    data: list[HabitRecordPublic]
    count: int


class HabitCalendarDay(SQLModel):
    date: str
    total_count: int
    completed_count: int
    habit_ids: list[str]


class HabitCalendar(SQLModel):
    year: int
    month: int
    days: list[HabitCalendarDay]


class HabitTrendDay(SQLModel):
    date: str
    completed_count: int
    total_habits: int


class HabitTrend(SQLModel):
    days: list[HabitTrendDay]


class HabitStatistics(SQLModel):
    total_habits: int
    total_checks_last_30_days: int
    average_checks_per_day: float
    most_active_day: str | None
    streak_days: int


class Message(SQLModel):
    message: str


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)
