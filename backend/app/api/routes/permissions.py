from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.api.deps import SessionDep, get_current_active_superuser
from app.models import PermissionsPublic, Permission

router = APIRouter(tags=["permissions"])


@router.get(
    "/permissions",
    response_model=PermissionsPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_permissions(
    session: SessionDep, skip: int = 0, limit: int = 100
) -> PermissionsPublic:
    count_statement = select(Permission)
    count = len(session.exec(count_statement).all())
    statement = select(Permission).offset(skip).limit(limit)
    permissions = session.exec(statement).all()
    return PermissionsPublic(data=permissions, count=count)
