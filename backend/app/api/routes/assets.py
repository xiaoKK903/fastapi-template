from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Asset,
    AssetCategory,
    AssetCreate,
    AssetPublic,
    AssetsPublic,
    AssetStatistics,
    AssetStatus,
    AssetUpdate,
    MaintenanceRecord,
    MaintenanceRecordCreate,
    MaintenanceRecordPublic,
    MaintenanceRecordsPublic,
    MaintenanceRecordUpdate,
    MaintenanceType,
    Message,
)

router = APIRouter(prefix="/assets", tags=["assets"])


@router.post("/", response_model=AssetPublic, status_code=201)
def create_asset(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    asset_in: AssetCreate,
) -> Any:
    asset = Asset.model_validate(
        asset_in, update={"owner_id": current_user.id}
    )
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return AssetPublic.model_validate(asset)


@router.get("/", response_model=AssetsPublic)
def list_assets(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: AssetCategory | None = None,
    status: AssetStatus | None = None,
    show_archived: bool = False,
    warranty_expiring: bool = False,
    warranty_expired: bool = False,
    search: str | None = None,
) -> Any:
    count_statement = (
        select(func.count())
        .select_from(Asset)
        .where(Asset.owner_id == current_user.id)
    )
    
    statement = (
        select(Asset)
        .where(Asset.owner_id == current_user.id)
        .order_by(col(Asset.updated_at).desc())
        .offset(skip)
        .limit(limit)
    )
    
    if not show_archived:
        count_statement = count_statement.where(Asset.is_archived == False)
        statement = statement.where(Asset.is_archived == False)
    
    if category:
        count_statement = count_statement.where(Asset.category == category)
        statement = statement.where(Asset.category == category)
    
    if status:
        count_statement = count_statement.where(Asset.status == status)
        statement = statement.where(Asset.status == status)
    
    today = date.today()
    if warranty_expiring:
        thirty_days_later = today + timedelta(days=30)
        count_statement = count_statement.where(
            Asset.warranty_expiry_date >= today,
            Asset.warranty_expiry_date <= thirty_days_later,
        )
        statement = statement.where(
            Asset.warranty_expiry_date >= today,
            Asset.warranty_expiry_date <= thirty_days_later,
        )
    
    if warranty_expired:
        count_statement = count_statement.where(Asset.warranty_expiry_date < today)
        statement = statement.where(Asset.warranty_expiry_date < today)
    
    if search:
        search_term = f"%{search}%"
        count_statement = count_statement.where(
            col(Asset.name).ilike(search_term)
            | col(Asset.brand).ilike(search_term)
            | col(Asset.model).ilike(search_term)
            | col(Asset.serial_number).ilike(search_term)
            | col(Asset.description).ilike(search_term)
        )
        statement = statement.where(
            col(Asset.name).ilike(search_term)
            | col(Asset.brand).ilike(search_term)
            | col(Asset.model).ilike(search_term)
            | col(Asset.serial_number).ilike(search_term)
            | col(Asset.description).ilike(search_term)
        )
    
    count = session.exec(count_statement).one()
    assets = session.exec(statement).all()
    
    assets_public = [AssetPublic.model_validate(a) for a in assets]
    return AssetsPublic(data=assets_public, count=count)


@router.get("/stats", response_model=AssetStatistics)
def get_asset_stats(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    count_statement = (
        select(func.count())
        .select_from(Asset)
        .where(Asset.owner_id == current_user.id, Asset.is_archived == False)
    )
    
    total_assets = session.exec(count_statement).one()
    
    in_use_count = session.exec(
        count_statement.where(Asset.status == AssetStatus.IN_USE)
    ).one()
    idle_count = session.exec(
        count_statement.where(Asset.status == AssetStatus.IDLE)
    ).one()
    scrapped_count = session.exec(
        count_statement.where(Asset.status == AssetStatus.SCRAPPED)
    ).one()
    maintenance_count = session.exec(
        count_statement.where(Asset.status == AssetStatus.MAINTENANCE)
    ).one()
    
    electronics_count = session.exec(
        count_statement.where(Asset.category == AssetCategory.ELECTRONICS)
    ).one()
    home_appliance_count = session.exec(
        count_statement.where(Asset.category == AssetCategory.HOME_APPLIANCE)
    ).one()
    daily_use_count = session.exec(
        count_statement.where(Asset.category == AssetCategory.DAILY_USE)
    ).one()
    
    value_statement = (
        select(func.sum(Asset.purchase_price))
        .where(
            Asset.owner_id == current_user.id,
            Asset.is_archived == False,
            Asset.purchase_price != None,
        )
    )
    total_purchase_value = session.exec(value_statement).one()
    
    today = date.today()
    thirty_days_later = today + timedelta(days=30)
    
    warranty_expiring_statement = count_statement.where(
        Asset.warranty_expiry_date >= today,
        Asset.warranty_expiry_date <= thirty_days_later,
    )
    warranty_expiring_soon = session.exec(warranty_expiring_statement).one()
    
    warranty_expired_statement = count_statement.where(Asset.warranty_expiry_date < today)
    warranty_expired = session.exec(warranty_expired_statement).one()
    
    return AssetStatistics(
        total_assets=total_assets,
        in_use_count=in_use_count,
        idle_count=idle_count,
        scrapped_count=scrapped_count,
        maintenance_count=maintenance_count,
        electronics_count=electronics_count,
        home_appliance_count=home_appliance_count,
        daily_use_count=daily_use_count,
        total_purchase_value=total_purchase_value,
        warranty_expiring_soon=warranty_expiring_soon,
        warranty_expired=warranty_expired,
    )


@router.get("/archived", response_model=AssetsPublic)
def list_archived_assets(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    count_statement = (
        select(func.count())
        .select_from(Asset)
        .where(Asset.owner_id == current_user.id, Asset.is_archived == True)
    )
    
    statement = (
        select(Asset)
        .where(Asset.owner_id == current_user.id, Asset.is_archived == True)
        .order_by(col(Asset.updated_at).desc())
        .offset(skip)
        .limit(limit)
    )
    
    count = session.exec(count_statement).one()
    assets = session.exec(statement).all()
    
    assets_public = [AssetPublic.model_validate(a) for a in assets]
    return AssetsPublic(data=assets_public, count=count)


@router.get("/{asset_id}", response_model=AssetPublic)
def get_asset(
    session: SessionDep,
    current_user: CurrentUser,
    asset_id: str,
) -> Any:
    asset = session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return AssetPublic.model_validate(asset)


@router.patch("/{asset_id}", response_model=AssetPublic)
def update_asset(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    asset_id: str,
    asset_in: AssetUpdate,
) -> Any:
    asset = session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    update_data = asset_in.model_dump(exclude_unset=True)
    asset.updated_at = datetime.now(timezone.utc)
    
    for key, value in update_data.items():
        setattr(asset, key, value)
    
    session.add(asset)
    session.commit()
    session.refresh(asset)
    
    return AssetPublic.model_validate(asset)


@router.delete("/{asset_id}", response_model=Message)
def delete_asset(
    session: SessionDep,
    current_user: CurrentUser,
    asset_id: str,
) -> Message:
    asset = session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    session.delete(asset)
    session.commit()
    
    return Message(message="Asset deleted successfully")


@router.post("/{asset_id}/maintenance", response_model=MaintenanceRecordPublic, status_code=201)
def create_maintenance_record(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    asset_id: str,
    record_in: MaintenanceRecordCreate,
) -> Any:
    asset = session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    record = MaintenanceRecord.model_validate(
        record_in, update={"owner_id": current_user.id, "asset_id": asset_id}
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    
    return MaintenanceRecordPublic.model_validate(record)


@router.get("/{asset_id}/maintenance", response_model=MaintenanceRecordsPublic)
def list_maintenance_records(
    session: SessionDep,
    current_user: CurrentUser,
    asset_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    asset = session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    count_statement = (
        select(func.count())
        .select_from(MaintenanceRecord)
        .where(MaintenanceRecord.asset_id == asset_id)
    )
    
    statement = (
        select(MaintenanceRecord)
        .where(MaintenanceRecord.asset_id == asset_id)
        .order_by(col(MaintenanceRecord.maintenance_date).desc(), col(MaintenanceRecord.created_at).desc())
        .offset(skip)
        .limit(limit)
    )
    
    count = session.exec(count_statement).one()
    records = session.exec(statement).all()
    
    records_public = [MaintenanceRecordPublic.model_validate(r) for r in records]
    return MaintenanceRecordsPublic(data=records_public, count=count)


@router.get("/maintenance/{record_id}", response_model=MaintenanceRecordPublic)
def get_maintenance_record(
    session: SessionDep,
    current_user: CurrentUser,
    record_id: str,
) -> Any:
    record = session.get(MaintenanceRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    if record.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return MaintenanceRecordPublic.model_validate(record)


@router.patch("/maintenance/{record_id}", response_model=MaintenanceRecordPublic)
def update_maintenance_record(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    record_id: str,
    record_in: MaintenanceRecordUpdate,
) -> Any:
    record = session.get(MaintenanceRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    if record.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    update_data = record_in.model_dump(exclude_unset=True)
    record.updated_at = datetime.now(timezone.utc)
    
    for key, value in update_data.items():
        setattr(record, key, value)
    
    session.add(record)
    session.commit()
    session.refresh(record)
    
    return MaintenanceRecordPublic.model_validate(record)


@router.delete("/maintenance/{record_id}", response_model=Message)
def delete_maintenance_record(
    session: SessionDep,
    current_user: CurrentUser,
    record_id: str,
) -> Message:
    record = session.get(MaintenanceRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    if record.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    session.delete(record)
    session.commit()
    
    return Message(message="Maintenance record deleted successfully")
