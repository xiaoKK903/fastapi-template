import uuid
from datetime import date, datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import EmailStr
from sqlalchemy import DateTime as SA_DateTime, JSON as SA_JSON
from sqlmodel import Column, Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(timezone.utc)


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Frequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class BuiltinRole(str, Enum):
    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"


class TaskRepeatType(str, Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class ResourceType(str, Enum):
    HABIT = "habit"
    HABIT_RECORD = "habit_record"
    TRANSACTION = "transaction"
    CATEGORY = "category"
    BUDGET = "budget"
    USER = "user"
    ROLE = "role"
    PERMISSION = "permission"
    OPERATION_LOG = "operation_log"
    TASK = "task"


class ActionType(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"


class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    is_banned: bool = False
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


class TransactionType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"


class CategoryBase(SQLModel):
    name: str = Field(min_length=1, max_length=100)
    type: TransactionType = Field(default=TransactionType.EXPENSE)
    icon: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=20)
    description: str | None = Field(default=None, max_length=255)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    type: TransactionType | None = None
    icon: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=20)
    description: str | None = Field(default=None, max_length=255)


class CategoryPublic(CategoryBase):
    id: str
    owner_id: str
    created_at: datetime | None = None


class CategoriesPublic(SQLModel):
    data: list[CategoryPublic]
    count: int


class TransactionBase(SQLModel):
    amount: float = Field(gt=0, default=0.0)
    type: TransactionType = Field(default=TransactionType.EXPENSE)
    description: str | None = Field(default=None, max_length=500)
    transaction_date: date | None = Field(default_factory=lambda: date.today())


class TransactionCreate(TransactionBase):
    category_id: str


class TransactionUpdate(SQLModel):
    amount: float | None = Field(default=None, gt=0)
    type: TransactionType | None = None
    description: str | None = Field(default=None, max_length=500)
    category_id: str | None = None
    transaction_date: date | None = None


class TransactionPublic(TransactionBase):
    id: str
    category_id: str
    owner_id: str
    created_at: datetime | None = None


class TransactionsPublic(SQLModel):
    data: list[TransactionPublic]
    count: int


class TransactionWithCategory(SQLModel):
    id: str
    amount: float
    type: TransactionType
    description: str | None
    transaction_date: date | None
    category_id: str
    category_name: str | None
    category_icon: str | None
    category_color: str | None
    created_at: datetime | None


class TransactionsWithCategoryPublic(SQLModel):
    data: list[TransactionWithCategory]
    count: int


class BudgetBase(SQLModel):
    amount: float = Field(gt=0, default=0.0)
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2020, le=2100)


class BudgetCreate(BudgetBase):
    category_id: str | None = Field(default=None)


class BudgetUpdate(SQLModel):
    amount: float | None = Field(default=None, gt=0)
    category_id: str | None = None


class BudgetPublic(BudgetBase):
    id: str
    category_id: str | None
    owner_id: str
    created_at: datetime | None = None


class BudgetsPublic(SQLModel):
    data: list[BudgetPublic]
    count: int


class BudgetWithCategory(SQLModel):
    id: str
    amount: float
    month: int
    year: int
    category_id: str | None
    category_name: str | None
    category_icon: str | None
    category_color: str | None
    spent: float
    remaining: float
    percentage: float


class BudgetsWithCategoryPublic(SQLModel):
    data: list[BudgetWithCategory]
    count: int


class MonthlySummary(SQLModel):
    month: int
    year: int
    total_income: float
    total_expense: float
    balance: float
    income_count: int
    expense_count: int


class CategoryMonthlySummary(SQLModel):
    category_id: str
    category_name: str
    category_icon: str | None
    category_color: str | None
    type: TransactionType
    total_amount: float
    transaction_count: int
    percentage: float


class CategoryMonthlySummaries(SQLModel):
    income_categories: list[CategoryMonthlySummary]
    expense_categories: list[CategoryMonthlySummary]
    total_income: float
    total_expense: float


class DailyTrend(SQLModel):
    date: str
    income: float
    expense: float
    balance: float


class DailyTrends(SQLModel):
    days: list[DailyTrend]


class YearlySummary(SQLModel):
    year: int
    total_income: float
    total_expense: float
    balance: float
    monthly_breakdown: list[dict[str, float | int]]


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

    record_ids: dict[str, str]


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


class RoleBase(SQLModel):
    name: str = Field(unique=True, max_length=100, index=True)
    code: str = Field(unique=True, max_length=50, index=True)
    description: str | None = Field(default=None, max_length=255)
    is_builtin: bool = False


class RoleCreate(RoleBase):
    pass


class RoleUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=255)


class RolePublic(RoleBase):
    id: str
    created_at: datetime | None = None


class RolesPublic(SQLModel):
    data: list[RolePublic]
    count: int


class RoleWithPermissions(RolePublic):
    permissions: list["PermissionPublic"] = []


class PermissionBase(SQLModel):
    name: str = Field(unique=True, max_length=100, index=True)
    code: str = Field(unique=True, max_length=100, index=True)
    resource: ResourceType
    action: ActionType
    description: str | None = Field(default=None, max_length=255)


class PermissionCreate(PermissionBase):
    pass


class PermissionUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=255)


class PermissionPublic(PermissionBase):
    id: str
    created_at: datetime | None = None


class PermissionsPublic(SQLModel):
    data: list[PermissionPublic]
    count: int


class UserRoleLink(SQLModel, table=True):
    user_id: str = Field(
        foreign_key="user.id", primary_key=True, ondelete="CASCADE"
    )
    role_id: str = Field(
        foreign_key="role.id", primary_key=True, ondelete="CASCADE"
    )


class RolePermissionLink(SQLModel, table=True):
    role_id: str = Field(
        foreign_key="role.id", primary_key=True, ondelete="CASCADE"
    )
    permission_id: str = Field(
        foreign_key="permission.id", primary_key=True, ondelete="CASCADE"
    )


class Permission(PermissionBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=SA_DateTime(timezone=True),
    )
    roles: list["Role"] = Relationship(
        back_populates="permissions", link_model=RolePermissionLink
    )


class Role(RoleBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=SA_DateTime(timezone=True),
    )
    users: list["User"] = Relationship(back_populates="roles", link_model=UserRoleLink)
    permissions: list["Permission"] = Relationship(
        back_populates="roles", link_model=RolePermissionLink
    )


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
    categories: list["Category"] = Relationship(back_populates="owner", cascade_delete=True)
    transactions: list["Transaction"] = Relationship(back_populates="owner", cascade_delete=True)
    budgets: list["Budget"] = Relationship(back_populates="owner", cascade_delete=True)
    tasks: list["Task"] = Relationship(back_populates="owner", cascade_delete=True)
    roles: list["Role"] = Relationship(back_populates="users", link_model=UserRoleLink)


class Category(CategoryBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    owner_id: str = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=SA_DateTime(timezone=True),
    )
    owner: User | None = Relationship(back_populates="categories")
    transactions: list["Transaction"] = Relationship(back_populates="category")
    budgets: list["Budget"] = Relationship(back_populates="category")


class Transaction(TransactionBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    category_id: str = Field(
        foreign_key="category.id", nullable=False, ondelete="CASCADE"
    )
    owner_id: str = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=SA_DateTime(timezone=True),
    )
    owner: User | None = Relationship(back_populates="transactions")
    category: Category | None = Relationship(back_populates="transactions")


class Budget(BudgetBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    category_id: str | None = Field(
        default=None, foreign_key="category.id", nullable=True, ondelete="CASCADE"
    )
    owner_id: str = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=SA_DateTime(timezone=True),
    )
    owner: User | None = Relationship(back_populates="budgets")
    category: Category | None = Relationship(back_populates="budgets")


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





class UserWithRoles(UserPublic):
    roles: list["RolePublic"] = []


class OperationLogBase(SQLModel):
    user_id: str | None = Field(default=None, index=True)
    user_email: str | None = Field(default=None, max_length=255)
    action: ActionType
    resource: ResourceType
    resource_id: str | None = None
    resource_name: str | None = None
    request_path: str | None = None
    request_method: str | None = None
    request_data: str | None = None
    response_status: int | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    success: bool = True
    error_message: str | None = None


class OperationLogCreate(OperationLogBase):
    pass


class OperationLogPublic(OperationLogBase):
    id: str
    created_at: datetime | None = None


class OperationLogsPublic(SQLModel):
    data: list[OperationLogPublic]
    count: int


class OperationLog(OperationLogBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=SA_DateTime(timezone=True),
    )


class TaskBase(SQLModel):
    title: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=2000)
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM)
    status: TaskStatus = Field(default=TaskStatus.TODO)
    due_date: date | None = None
    completed_at: datetime | None = None
    progress: int = Field(default=0, ge=0, le=100)
    tags: list[str] | None = Field(default=None, sa_column=Column(SA_JSON))
    parent_id: str | None = Field(default=None, foreign_key="task.id", nullable=True)
    repeat_type: TaskRepeatType = Field(default=TaskRepeatType.NONE)
    repeat_interval: int | None = Field(default=None, ge=1)
    repeat_days: list[int] | None = Field(default=None, sa_column=Column(SA_JSON))
    repeat_end_date: date | None = None
    is_deleted: bool = False
    is_archived: bool = False


class TaskCreate(SQLModel):
    title: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=2000)
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM)
    status: TaskStatus = Field(default=TaskStatus.TODO)
    due_date: date | None = None
    progress: int = Field(default=0, ge=0, le=100)
    tags: list[str] | None = None
    parent_id: str | None = None
    repeat_type: TaskRepeatType = Field(default=TaskRepeatType.NONE)
    repeat_interval: int | None = Field(default=None, ge=1)
    repeat_days: list[int] | None = None
    repeat_end_date: date | None = None


class TaskUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=2000)
    priority: TaskPriority | None = None
    status: TaskStatus | None = None
    due_date: date | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    tags: list[str] | None = None
    parent_id: str | None = None
    repeat_type: TaskRepeatType | None = None
    repeat_interval: int | None = None
    repeat_days: list[int] | None = None
    repeat_end_date: date | None = None


class TaskPublic(TaskBase):
    id: str
    owner_id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    is_overdue: bool | None = None


class TasksPublic(SQLModel):
    data: list[TaskPublic]
    count: int


class TaskWithSubtasks(TaskPublic):
    children: list["TaskWithSubtasks"] = []


class TasksWithSubtasksPublic(SQLModel):
    data: list[TaskWithSubtasks]
    count: int


class TaskStatistics(SQLModel):
    total_tasks: int = 0
    todo_tasks: int = 0
    in_progress_tasks: int = 0
    done_tasks: int = 0
    cancelled_tasks: int = 0
    on_hold_tasks: int = 0
    overdue_tasks: int = 0
    high_priority_tasks: int = 0
    urgent_priority_tasks: int = 0
    completion_rate: float = 0.0
    archived_tasks: int = 0
    deleted_tasks: int = 0


class TaskTrendDay(SQLModel):
    date: str
    created_count: int
    completed_count: int
    overdue_count: int


class TaskTrend(SQLModel):
    days: list[TaskTrendDay]


class Task(TaskBase, table=True):
    id: str = Field(default_factory=generate_uuid, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=SA_DateTime(timezone=True),
    )
    updated_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=SA_DateTime(timezone=True),
    )
    owner_id: str = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: "User" = Relationship(back_populates="tasks")
    parent: Optional["Task"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "Task.id"}
    )
    children: List["Task"] = Relationship(back_populates="parent", cascade_delete=True)
