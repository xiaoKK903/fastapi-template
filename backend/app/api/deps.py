from collections.abc import Generator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlmodel import Session, select

from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.models import (
    ActionType,
    BuiltinRole,
    Permission,
    ResourceType,
    Role,
    TokenPayload,
    User,
    UserRoleLink,
)

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]


def get_current_user(session: SessionDep, token: TokenDep, request: Request) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    if token_data.sub is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = session.get(User, token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    if user.is_banned:
        raise HTTPException(status_code=403, detail="User is banned")
    
    request.state.current_user = user
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user


def get_user_permissions(session: Session, user: User) -> set[str]:
    if user.is_superuser:
        return {"*:*"}

    statement = (
        select(Role)
        .join(UserRoleLink, UserRoleLink.role_id == Role.id)
        .where(UserRoleLink.user_id == user.id)
    )
    roles = session.exec(statement).all()

    permissions = set()
    for role in roles:
        for perm in role.permissions:
            permissions.add(f"{perm.resource.value}:{perm.action.value}")

    return permissions


def has_permission(
    session: Session, user: User, resource: ResourceType, action: ActionType
) -> bool:
    if user.is_superuser:
        return True

    user_permissions = get_user_permissions(session, user)

    if "*:*" in user_permissions:
        return True

    if f"{resource.value}:*" in user_permissions:
        return True

    required_permission = f"{resource.value}:{action.value}"
    return required_permission in user_permissions


def require_permission(resource: ResourceType, action: ActionType):
    async def permission_checker(
        session: SessionDep, current_user: CurrentUser
    ) -> User:
        if not has_permission(session, current_user, resource, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Not authorized to {action.value} {resource.value}",
            )
        return current_user

    return permission_checker


def get_user_roles(session: Session, user: User) -> list[str]:
    if user.is_superuser:
        return [BuiltinRole.ADMIN.value]

    statement = (
        select(Role.code)
        .join(UserRoleLink, UserRoleLink.role_id == Role.id)
        .where(UserRoleLink.user_id == user.id)
    )
    roles = session.exec(statement).all()
    return [r for r in roles] if roles else []
