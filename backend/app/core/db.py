from sqlmodel import Session, create_engine, select

from app import crud
from app.core.config import settings
from app.models import (
    ActionType,
    BuiltinRole,
    Permission,
    ResourceType,
    Role,
    RolePermissionLink,
    User,
    UserCreate,
    UserRoleLink,
)

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    from sqlmodel import SQLModel

    # This works because the models are already imported and registered from app.models
    SQLModel.metadata.create_all(engine)

    _init_permissions(session)
    _init_roles(session)
    _init_superuser(session)


def _init_permissions(session: Session) -> None:
    all_resources = [
        ResourceType.HABIT,
        ResourceType.HABIT_RECORD,
        ResourceType.TRANSACTION,
        ResourceType.CATEGORY,
        ResourceType.BUDGET,
        ResourceType.USER,
        ResourceType.ROLE,
        ResourceType.PERMISSION,
        ResourceType.OPERATION_LOG,
        ResourceType.TASK,
        ResourceType.FILE,
        ResourceType.FOLDER,
        ResourceType.FILE_TAG,
        ResourceType.FILE_SHARE,
    ]
    all_actions = [ActionType.CREATE, ActionType.READ, ActionType.UPDATE, ActionType.DELETE]

    for resource in all_resources:
        for action in all_actions:
            code = f"{resource.value}:{action.value}"
            name = f"{resource.value}_{action.value}"
            existing = session.exec(
                select(Permission).where(Permission.code == code)
            ).first()
            if not existing:
                perm = Permission(
                    name=name,
                    code=code,
                    resource=resource,
                    action=action,
                    description=f"Permission to {action.value} {resource.value}",
                )
                session.add(perm)
    session.commit()


def _init_roles(session: Session) -> None:
    builtin_roles = [
        {
            "code": BuiltinRole.ADMIN.value,
            "name": "管理员",
            "description": "系统管理员，拥有所有权限",
            "permissions": "*",
        },
        {
            "code": BuiltinRole.USER.value,
            "name": "普通用户",
            "description": "普通注册用户，拥有自己数据的读写权限",
            "permissions": [
                f"{ResourceType.HABIT.value}:*",
                f"{ResourceType.HABIT_RECORD.value}:*",
                f"{ResourceType.TRANSACTION.value}:*",
                f"{ResourceType.CATEGORY.value}:*",
                f"{ResourceType.BUDGET.value}:*",
                f"{ResourceType.TASK.value}:*",
                f"{ResourceType.FILE.value}:*",
                f"{ResourceType.FOLDER.value}:*",
                f"{ResourceType.FILE_TAG.value}:*",
                f"{ResourceType.FILE_SHARE.value}:*",
            ],
        },
        {
            "code": BuiltinRole.GUEST.value,
            "name": "访客",
            "description": "访客用户，只有只读权限",
            "permissions": [
                f"{ResourceType.HABIT.value}:{ActionType.READ.value}",
                f"{ResourceType.HABIT_RECORD.value}:{ActionType.READ.value}",
                f"{ResourceType.TRANSACTION.value}:{ActionType.READ.value}",
                f"{ResourceType.CATEGORY.value}:{ActionType.READ.value}",
                f"{ResourceType.BUDGET.value}:{ActionType.READ.value}",
                f"{ResourceType.TASK.value}:{ActionType.READ.value}",
                f"{ResourceType.FILE.value}:{ActionType.READ.value}",
                f"{ResourceType.FOLDER.value}:{ActionType.READ.value}",
            ],
        },
    ]

    for role_data in builtin_roles:
        existing = session.exec(
            select(Role).where(Role.code == role_data["code"])
        ).first()
        if not existing:
            role = Role(
                name=role_data["name"],
                code=role_data["code"],
                description=role_data["description"],
                is_builtin=True,
            )
            session.add(role)
            session.commit()
            session.refresh(role)

            if role_data["permissions"] == "*":
                all_perms = session.exec(select(Permission)).all()
                for perm in all_perms:
                    link = RolePermissionLink(role_id=role.id, permission_id=perm.id)
                    session.add(link)
            else:
                for perm_code in role_data["permissions"]:
                    resource_action = perm_code.split(":")
                    resource = resource_action[0]
                    action = resource_action[1] if len(resource_action) > 1 else None

                    if action == "*":
                        perms = session.exec(
                            select(Permission).where(Permission.resource == resource)
                        ).all()
                        for perm in perms:
                            link = RolePermissionLink(role_id=role.id, permission_id=perm.id)
                            session.add(link)
                    else:
                        perm = session.exec(
                            select(Permission).where(Permission.code == perm_code)
                        ).first()
                        if perm:
                            link = RolePermissionLink(role_id=role.id, permission_id=perm.id)
                            session.add(link)
            session.commit()


def _init_superuser(session: Session) -> None:
    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
        )
        user = crud.create_user(session=session, user_create=user_in)

        admin_role = session.exec(
            select(Role).where(Role.code == BuiltinRole.ADMIN.value)
        ).first()
        if admin_role:
            user_role_link = UserRoleLink(user_id=user.id, role_id=admin_role.id)
            session.add(user_role_link)
            session.commit()
