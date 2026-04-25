from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    BillingCycle,
    Message,
    Subscription,
    SubscriptionCategory,
    SubscriptionCreate,
    SubscriptionPublic,
    SubscriptionsPublic,
    SubscriptionStatistics,
    SubscriptionUpdate,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.post("/", response_model=SubscriptionPublic, status_code=201)
def create_subscription(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    subscription_in: SubscriptionCreate,
) -> Any:
    subscription = Subscription.model_validate(
        subscription_in, update={"owner_id": current_user.id}
    )
    session.add(subscription)
    session.commit()
    session.refresh(subscription)
    return SubscriptionPublic.model_validate(subscription)


@router.get("/", response_model=SubscriptionsPublic)
def list_subscriptions(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: SubscriptionCategory | None = None,
    billing_cycle: BillingCycle | None = None,
    is_active: bool | None = None,
    auto_renewal: bool | None = None,
    expiring_soon: bool = False,
    expired: bool = False,
    search: str | None = None,
) -> Any:
    count_statement = (
        select(func.count())
        .select_from(Subscription)
        .where(Subscription.owner_id == current_user.id)
    )

    statement = (
        select(Subscription)
        .where(Subscription.owner_id == current_user.id)
        .order_by(col(Subscription.updated_at).desc())
        .offset(skip)
        .limit(limit)
    )

    if is_active is not None:
        count_statement = count_statement.where(Subscription.is_active == is_active)
        statement = statement.where(Subscription.is_active == is_active)

    if category:
        count_statement = count_statement.where(Subscription.category == category)
        statement = statement.where(Subscription.category == category)

    if billing_cycle:
        count_statement = count_statement.where(
            Subscription.billing_cycle == billing_cycle
        )
        statement = statement.where(Subscription.billing_cycle == billing_cycle)

    if auto_renewal is not None:
        count_statement = count_statement.where(
            Subscription.auto_renewal == auto_renewal
        )
        statement = statement.where(Subscription.auto_renewal == auto_renewal)

    today = date.today()
    if expiring_soon:
        thirty_days_later = today + timedelta(days=30)
        count_statement = count_statement.where(
            Subscription.next_billing_date >= today,
            Subscription.next_billing_date <= thirty_days_later,
        )
        statement = statement.where(
            Subscription.next_billing_date >= today,
            Subscription.next_billing_date <= thirty_days_later,
        )

    if expired:
        count_statement = count_statement.where(Subscription.is_active == False)
        statement = statement.where(Subscription.is_active == False)

    if search:
        search_term = f"%{search}%"
        count_statement = count_statement.where(
            col(Subscription.name).ilike(search_term)
            | col(Subscription.service_provider).ilike(search_term)
            | col(Subscription.description).ilike(search_term)
            | col(Subscription.account_email).ilike(search_term)
        )
        statement = statement.where(
            col(Subscription.name).ilike(search_term)
            | col(Subscription.service_provider).ilike(search_term)
            | col(Subscription.description).ilike(search_term)
            | col(Subscription.account_email).ilike(search_term)
        )

    count = session.exec(count_statement).one()
    subscriptions = session.exec(statement).all()

    subscriptions_public = [SubscriptionPublic.model_validate(s) for s in subscriptions]
    return SubscriptionsPublic(data=subscriptions_public, count=count)


@router.get("/stats", response_model=SubscriptionStatistics)
def get_subscription_stats(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    total_subscriptions = session.exec(
        select(func.count())
        .select_from(Subscription)
        .where(Subscription.owner_id == current_user.id)
    ).one()

    active_count = session.exec(
        select(func.count())
        .select_from(Subscription)
        .where(
            Subscription.owner_id == current_user.id,
            Subscription.is_active == True,
        )
    ).one()

    expired_count = session.exec(
        select(func.count())
        .select_from(Subscription)
        .where(
            Subscription.owner_id == current_user.id,
            Subscription.is_active == False,
        )
    ).one()

    auto_renewal_count = session.exec(
        select(func.count())
        .select_from(Subscription)
        .where(
            Subscription.owner_id == current_user.id,
            Subscription.is_active == True,
            Subscription.auto_renewal == True,
        )
    ).one()

    manual_renewal_count = session.exec(
        select(func.count())
        .select_from(Subscription)
        .where(
            Subscription.owner_id == current_user.id,
            Subscription.is_active == True,
            Subscription.auto_renewal == False,
        )
    ).one()

    today = date.today()
    thirty_days_later = today + timedelta(days=30)

    expiring_soon_count = session.exec(
        select(func.count())
        .select_from(Subscription)
        .where(
            Subscription.owner_id == current_user.id,
            Subscription.is_active == True,
            Subscription.next_billing_date >= today,
            Subscription.next_billing_date <= thirty_days_later,
        )
    ).one()

    all_subscriptions = session.exec(
        select(Subscription).where(
            Subscription.owner_id == current_user.id,
            Subscription.is_active == True,
        )
    ).all()

    total_monthly_cost = 0.0
    total_yearly_cost = 0.0

    for sub in all_subscriptions:
        if sub.price is None or sub.price == 0:
            continue

        if sub.billing_cycle == BillingCycle.MONTHLY:
            total_monthly_cost += sub.price
            total_yearly_cost += sub.price * 12
        elif sub.billing_cycle == BillingCycle.QUARTERLY:
            total_monthly_cost += sub.price / 3
            total_yearly_cost += sub.price * 4
        elif sub.billing_cycle == BillingCycle.YEARLY:
            total_monthly_cost += sub.price / 12
            total_yearly_cost += sub.price
        elif sub.billing_cycle == BillingCycle.LIFETIME:
            pass
        elif sub.billing_cycle == BillingCycle.ONE_TIME:
            pass

    return SubscriptionStatistics(
        total_subscriptions=total_subscriptions,
        active_count=active_count,
        expired_count=expired_count,
        auto_renewal_count=auto_renewal_count,
        manual_renewal_count=manual_renewal_count,
        total_monthly_cost=total_monthly_cost if total_monthly_cost > 0 else None,
        total_yearly_cost=total_yearly_cost if total_yearly_cost > 0 else None,
        expiring_soon_count=expiring_soon_count,
        expired_count=expired_count,
    )


@router.get("/{subscription_id}", response_model=SubscriptionPublic)
def get_subscription(
    session: SessionDep,
    current_user: CurrentUser,
    subscription_id: str,
) -> Any:
    subscription = session.get(Subscription, subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if subscription.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return SubscriptionPublic.model_validate(subscription)


@router.patch("/{subscription_id}", response_model=SubscriptionPublic)
def update_subscription(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    subscription_id: str,
    subscription_in: SubscriptionUpdate,
) -> Any:
    subscription = session.get(Subscription, subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if subscription.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    update_data = subscription_in.model_dump(exclude_unset=True)
    subscription.updated_at = datetime.now(timezone.utc)

    for key, value in update_data.items():
        setattr(subscription, key, value)

    session.add(subscription)
    session.commit()
    session.refresh(subscription)

    return SubscriptionPublic.model_validate(subscription)


@router.delete("/{subscription_id}", response_model=Message)
def delete_subscription(
    session: SessionDep,
    current_user: CurrentUser,
    subscription_id: str,
) -> Message:
    subscription = session.get(Subscription, subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if subscription.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    session.delete(subscription)
    session.commit()

    return Message(message="Subscription deleted successfully")
