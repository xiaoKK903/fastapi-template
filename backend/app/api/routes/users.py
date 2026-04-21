from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import col, delete, func, select

from app import crud
from app.api.deps import (
    CurrentUser,
    SessionDep,
    get_current_active_superuser,
    get_current_user,
    get_user_roles,
    get_user_permissions,
)
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models import (
    BuiltinRole,
    Item,
    Message,
    Role,
    RolePublic,
    UpdatePassword,
    User,
    UserCreate,
    UserPublic,
    UserRegister,
    UserRoleLink,
    UsersPublic,
    UserUpdate,
    UserUpdateMe,
    UserWithRoles,
)
from app.utils import generate_new_account_email, send_email

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/",
    response_model=UsersPublic,
)
def read_users(session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100) -> Any:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges"
        )
    
    count_statement = select(func.count()).select_from(User)
    count = session.exec(count_statement).one()

    statement = (
        select(User).order_by(col(User.created_at).desc()).offset(skip).limit(limit)
    )
    users = session.exec(statement).all()

    users_public = [UserPublic.model_validate(user) for user in users]
    return UsersPublic(data=users_public, count=count)


@router.post(
    "/", dependencies=[Depends(get_current_active_superuser)], response_model=UserPublic
)
def create_user(*, session: SessionDep, user_in: UserCreate) -> Any:
    user = crud.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    user = crud.create_user(session=session, user_create=user_in)

    default_role = session.exec(
        select(Role).where(Role.code == BuiltinRole.USER.value)
    ).first()
    if default_role:
        user_role_link = UserRoleLink(user_id=user.id, role_id=default_role.id)
        session.add(user_role_link)
        session.commit()
        session.refresh(user)

    if settings.emails_enabled and user_in.email:
        email_data = generate_new_account_email(
            email_to=user_in.email, username=user_in.email, password=user_in.password
        )
        send_email(
            email_to=user_in.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
    return user


@router.patch("/me", response_model=UserPublic)
def update_user_me(
    *, session: SessionDep, user_in: UserUpdateMe, current_user: CurrentUser
) -> Any:
    if user_in.email:
        existing_user = crud.get_user_by_email(session=session, email=user_in.email)
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            )
    user_data = user_in.model_dump(exclude_unset=True)
    current_user.sqlmodel_update(user_data)
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@router.patch("/me/password", response_model=Message)
def update_password_me(
    *, session: SessionDep, body: UpdatePassword, current_user: CurrentUser
) -> Any:
    verified, _ = verify_password(body.current_password, current_user.hashed_password)
    if not verified:
        raise HTTPException(status_code=400, detail="Incorrect password")
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400, detail="New password cannot be the same as the current one"
        )
    hashed_password = get_password_hash(body.new_password)
    current_user.hashed_password = hashed_password
    session.add(current_user)
    session.commit()
    return Message(message="Password updated successfully")


@router.get("/me", response_model=UserPublic)
def read_user_me(current_user: CurrentUser) -> Any:
    return current_user


@router.delete("/me", response_model=Message)
def delete_user_me(session: SessionDep, current_user: CurrentUser) -> Any:
    if current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    session.delete(current_user)
    session.commit()
    return Message(message="User deleted successfully")


@router.get("/me/roles", response_model=list[RolePublic])
def read_my_roles(session: SessionDep, current_user: CurrentUser) -> list[Role]:
    statement = (
        select(Role)
        .join(UserRoleLink, UserRoleLink.role_id == Role.id)
        .where(UserRoleLink.user_id == current_user.id)
    )
    roles = session.exec(statement).all()
    return roles


@router.get("/me/permissions", response_model=list[str])
def read_my_permissions(session: SessionDep, current_user: CurrentUser) -> list[str]:
    permissions = get_user_permissions(session, current_user)
    return sorted(list(permissions))


@router.get("/me/full-info", response_model=UserWithRoles)
def read_my_full_info(session: SessionDep, current_user: CurrentUser) -> UserWithRoles:
    statement = (
        select(Role)
        .join(UserRoleLink, UserRoleLink.role_id == Role.id)
        .where(UserRoleLink.user_id == current_user.id)
    )
    roles = session.exec(statement).all()

    user_dict = current_user.model_dump()
    user_dict["roles"] = [RolePublic.model_validate(r) for r in roles]
    return UserWithRoles.model_validate(user_dict)


@router.post("/signup", response_model=UserPublic)
def register_user(session: SessionDep, user_in: UserRegister) -> Any:
    user = crud.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system",
        )
    user_create = UserCreate.model_validate(user_in)
    user = crud.create_user(session=session, user_create=user_create)

    default_role = session.exec(
        select(Role).where(Role.code == BuiltinRole.USER.value)
    ).first()
    if default_role:
        user_role_link = UserRoleLink(user_id=user.id, role_id=default_role.id)
        session.add(user_role_link)
        session.commit()
        session.refresh(user)

    return user


@router.get("/{user_id}", response_model=UserPublic)
def read_user_by_id(
    user_id: str, session: SessionDep, current_user: CurrentUser
) -> Any:
    user = session.get(User, user_id)
    if user == current_user:
        return user
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges",
        )
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch(
    "/{user_id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UserPublic,
)
def update_user(
    *,
    session: SessionDep,
    user_id: str,
    user_in: UserUpdate,
) -> Any:
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    if user_in.email:
        existing_user = crud.get_user_by_email(session=session, email=user_in.email)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            )

    db_user = crud.update_user(session=session, db_user=db_user, user_in=user_in)
    return db_user


@router.delete("/{user_id}", dependencies=[Depends(get_current_active_superuser)])
def delete_user(
    session: SessionDep, current_user: CurrentUser, user_id: str
) -> Message:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user == current_user:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    statement = delete(Item).where(col(Item.owner_id) == user_id)
    session.exec(statement)
    session.delete(user)
    session.commit()
    return Message(message="User deleted successfully")


@router.post(
    "/{user_id}/ban",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UserPublic,
)
def ban_user(session: SessionDep, user_id: str) -> User:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_superuser:
        raise HTTPException(
            status_code=403, detail="Cannot ban a superuser"
        )
    user.is_banned = True
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post(
    "/{user_id}/unban",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UserPublic,
)
def unban_user(session: SessionDep, user_id: str) -> User:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_banned = False
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post(
    "/{user_id}/reset-password",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=Message,
)
def reset_user_password(
    session: SessionDep, user_id: str, new_password: str
) -> Message:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    hashed_password = get_password_hash(new_password)
    user.hashed_password = hashed_password
    session.add(user)
    session.commit()
    return Message(message="Password reset successfully")


@router.get(
    "/{user_id}/roles",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=list[RolePublic],
)
def get_user_roles_detail(session: SessionDep, user_id: str) -> list[Role]:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    statement = (
        select(Role)
        .join(UserRoleLink, UserRoleLink.role_id == Role.id)
        .where(UserRoleLink.user_id == user_id)
    )
    roles = session.exec(statement).all()
    return roles


@router.post(
    "/{user_id}/roles/{role_id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=Message,
)
def assign_role_to_user(
    session: SessionDep, user_id: str, role_id: str
) -> Message:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    existing = session.exec(
        select(UserRoleLink).where(
            UserRoleLink.user_id == user_id,
            UserRoleLink.role_id == role_id,
        )
    ).first()
    if existing:
        return Message(message="Role already assigned to user")

    link = UserRoleLink(user_id=user_id, role_id=role_id)
    session.add(link)
    session.commit()
    return Message(message="Role assigned to user successfully")


@router.delete(
    "/{user_id}/roles/{role_id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=Message,
)
def remove_role_from_user(
    session: SessionDep, user_id: str, role_id: str
) -> Message:
    link = session.exec(
        select(UserRoleLink).where(
            UserRoleLink.user_id == user_id,
            UserRoleLink.role_id == role_id,
        )
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Role not assigned to user")

    session.delete(link)
    session.commit()
    return Message(message="Role removed from user successfully")
