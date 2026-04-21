from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import (
    CurrentUser,
    SessionDep,
    get_current_active_superuser,
)
from app.models import (
    Message,
    Permission,
    PermissionPublic,
    Role,
    RoleCreate,
    RolePermissionLink,
    RolePublic,
    RoleUpdate,
    RoleWithPermissions,
    RolesPublic,
)

router = APIRouter(tags=["roles"])


@router.get(
    "/roles",
    response_model=RolesPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_roles(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> RolesPublic:
    count_statement = select(Role)
    count = len(session.exec(count_statement).all())
    statement = select(Role).offset(skip).limit(limit)
    roles = session.exec(statement).all()
    return RolesPublic(data=roles, count=count)


@router.get(
    "/roles/{role_id}",
    response_model=RoleWithPermissions,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_role(role_id: str, session: SessionDep) -> RoleWithPermissions:
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    perm_statement = (
        select(Permission)
        .join(RolePermissionLink, RolePermissionLink.permission_id == Permission.id)
        .where(RolePermissionLink.role_id == role_id)
    )
    permissions = session.exec(perm_statement).all()

    role_dict = role.model_dump()
    role_dict["permissions"] = [
        PermissionPublic.model_validate(p) for p in permissions
    ]
    return RoleWithPermissions.model_validate(role_dict)


@router.post(
    "/roles",
    response_model=RolePublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_role(*, session: SessionDep, role_in: RoleCreate) -> Role:
    existing = session.exec(
        select(Role).where(Role.code == role_in.code)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role with this code already exists",
        )
    role = Role.model_validate(role_in, update={"is_builtin": False})
    session.add(role)
    session.commit()
    session.refresh(role)
    return role


@router.put(
    "/roles/{role_id}",
    response_model=RolePublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_role(
    *, session: SessionDep, role_id: str, role_in: RoleUpdate
) -> Role:
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_builtin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update built-in roles",
        )
    update_data = role_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(role, key, value)
    session.add(role)
    session.commit()
    session.refresh(role)
    return role


@router.delete(
    "/roles/{role_id}",
    response_model=Message,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_role(session: SessionDep, role_id: str) -> Message:
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_builtin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete built-in roles",
        )
    session.delete(role)
    session.commit()
    return Message(message="Role deleted successfully")


@router.post(
    "/roles/{role_id}/permissions/{permission_id}",
    response_model=Message,
    dependencies=[Depends(get_current_active_superuser)],
)
def assign_permission_to_role(
    session: SessionDep, role_id: str, permission_id: str
) -> Message:
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    permission = session.get(Permission, permission_id)
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")

    existing = session.exec(
        select(RolePermissionLink).where(
            RolePermissionLink.role_id == role_id,
            RolePermissionLink.permission_id == permission_id,
        )
    ).first()
    if existing:
        return Message(message="Permission already assigned to role")

    link = RolePermissionLink(role_id=role_id, permission_id=permission_id)
    session.add(link)
    session.commit()
    return Message(message="Permission assigned to role successfully")


@router.delete(
    "/roles/{role_id}/permissions/{permission_id}",
    response_model=Message,
    dependencies=[Depends(get_current_active_superuser)],
)
def remove_permission_from_role(
    session: SessionDep, role_id: str, permission_id: str
) -> Message:
    link = session.exec(
        select(RolePermissionLink).where(
            RolePermissionLink.role_id == role_id,
            RolePermissionLink.permission_id == permission_id,
        )
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Permission not assigned to role")

    session.delete(link)
    session.commit()
    return Message(message="Permission removed from role successfully")
