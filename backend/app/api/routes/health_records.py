from datetime import datetime, timezone, date
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    HealthRecord,
    HealthRecordCreate,
    HealthRecordPublic,
    HealthRecordsPublic,
    HealthRecordUpdate,
    Message,
)

router = APIRouter(prefix="/health", tags=["health"])


@router.post("/records", response_model=HealthRecordPublic, status_code=201)
def create_health_record(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    record_in: HealthRecordCreate,
) -> Any:
    record = HealthRecord.model_validate(
        record_in, update={"owner_id": current_user.id}
    )
    
    session.add(record)
    session.commit()
    session.refresh(record)
    
    return HealthRecordPublic.model_validate(record)


@router.get("/records", response_model=HealthRecordsPublic)
def list_health_records(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    start_date: date | None = None,
    end_date: date | None = None,
    tag: str | None = None,
) -> Any:
    count_statement = (
        select(func.count())
        .select_from(HealthRecord)
        .where(HealthRecord.owner_id == current_user.id)
    )
    
    statement = (
        select(HealthRecord)
        .where(HealthRecord.owner_id == current_user.id)
        .order_by(col(HealthRecord.record_date).desc())
        .offset(skip)
        .limit(limit)
    )
    
    if start_date:
        count_statement = count_statement.where(HealthRecord.record_date >= start_date)
        statement = statement.where(HealthRecord.record_date >= start_date)
    
    if end_date:
        count_statement = count_statement.where(HealthRecord.record_date <= end_date)
        statement = statement.where(HealthRecord.record_date <= end_date)
    
    if tag:
        search_term = f"%{tag}%"
        count_statement = count_statement.where(
            col(HealthRecord.tags).ilike(search_term)
        )
        statement = statement.where(
            col(HealthRecord.tags).ilike(search_term)
        )
    
    count = session.exec(count_statement).one()
    records = session.exec(statement).all()
    
    records_public = [HealthRecordPublic.model_validate(r) for r in records]
    return HealthRecordsPublic(data=records_public, count=count)


@router.get("/records/{record_id}", response_model=HealthRecordPublic)
def get_health_record(
    session: SessionDep,
    current_user: CurrentUser,
    record_id: str,
) -> Any:
    record = session.get(HealthRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Health record not found")
    if record.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return HealthRecordPublic.model_validate(record)


@router.patch("/records/{record_id}", response_model=HealthRecordPublic)
def update_health_record(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    record_id: str,
    record_in: HealthRecordUpdate,
) -> Any:
    record = session.get(HealthRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Health record not found")
    if record.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    update_data = record_in.model_dump(exclude_unset=True)
    
    record.updated_at = datetime.now(timezone.utc)
    
    for key, value in update_data.items():
        setattr(record, key, value)
    
    session.add(record)
    session.commit()
    session.refresh(record)
    
    return HealthRecordPublic.model_validate(record)


@router.delete("/records/{record_id}", response_model=Message)
def delete_health_record(
    session: SessionDep,
    current_user: CurrentUser,
    record_id: str,
) -> Message:
    record = session.get(HealthRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Health record not found")
    if record.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    session.delete(record)
    session.commit()
    
    return Message(message="Health record deleted successfully")
