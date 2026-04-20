import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import EmailStr
from sqlalchemy import DateTime
from sqlmodel import Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(timezone.utc)


class Frequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore[assignment]
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)
    habits: list["Habit"] = Relationship(back_populates="owner", cascade_delete=True)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class HabitBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    frequency: Frequency = Field(default=Frequency.DAILY)
    target_count: int = Field(default=1, ge=1)
    description: str | None = Field(default=None, max_length=500)


# Properties to receive on habit creation
class HabitCreate(HabitBase):
    pass


# Properties to receive on habit update
class HabitUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    frequency: Frequency | None = None
    target_count: int | None = Field(default=None, ge=1)
    description: str | None = Field(default=None, max_length=500)


# Database model, database table inferred from class name
class Habit(HabitBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="habits")
    checkin_records: list["CheckinRecord"] = Relationship(
        back_populates="habit", cascade_delete=True
    )


# Properties to return via API, id is always required
class HabitPublic(HabitBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class HabitPublicWithStats(HabitPublic):
    total_checkins: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    completion_rate: float = 0.0
    is_checked_today: bool = False


class HabitsPublic(SQLModel):
    data: list[HabitPublic]
    count: int


class HabitsPublicWithStats(SQLModel):
    data: list[HabitPublicWithStats]
    count: int


# Checkin Record models
class CheckinRecordBase(SQLModel):
    pass


class CheckinRecordCreate(CheckinRecordBase):
    habit_id: uuid.UUID


class CheckinRecordPublic(CheckinRecordBase):
    id: uuid.UUID
    habit_id: uuid.UUID
    user_id: uuid.UUID
    checkin_date: datetime
    created_at: datetime | None = None


class CheckinRecordsPublic(SQLModel):
    data: list[CheckinRecordPublic]
    count: int


class CheckinCalendarDay(SQLModel):
    date: str
    has_checkin: bool
    checkin_count: int = 0


class CheckinCalendarMonth(SQLModel):
    year: int
    month: int
    days: list[CheckinCalendarDay]


# Database model
class CheckinRecord(CheckinRecordBase, table=True):
    __table_args__ = (
        {"sqlite_autoincrement": True},
    )
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    checkin_date: datetime = Field(
        sa_type=DateTime(timezone=True),
        index=True,
    )
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )
    habit_id: uuid.UUID = Field(
        foreign_key="habit.id", nullable=False, ondelete="CASCADE", index=True
    )
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )
    habit: Habit | None = Relationship(back_populates="checkin_records")


# Dashboard Stats models
class HabitStats(SQLModel):
    habit_id: uuid.UUID
    habit_name: str
    total_checkins: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    completion_rate: float = 0.0


class WeeklyStats(SQLModel):
    total_checkins: int = 0
    habits_with_checkins: int = 0
    completion_rate: float = 0.0


class MonthlyStats(SQLModel):
    total_checkins: int = 0
    habits_with_checkins: int = 0
    completion_rate: float = 0.0


class DashboardStats(SQLModel):
    weekly: WeeklyStats
    monthly: MonthlyStats
    top_habits: list[HabitStats]
    longest_streak: int
    longest_streak_habit_name: str | None = None
    total_habits: int = 0


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)
