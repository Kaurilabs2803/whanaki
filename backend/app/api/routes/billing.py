"""
Stripe integration:
- /billing/portal — customer portal redirect
- /billing/checkout — create checkout session
- /billing/webhook — Stripe webhook handler (subscription lifecycle)
"""
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.core.rate_limit import limiter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import User, Tenant, TenantPlan, BillingEvent

import structlog

router = APIRouter()
settings = get_settings()
log = structlog.get_logger()

stripe.api_key = settings.stripe_secret_key

PLAN_PRICE_MAP = {
    TenantPlan.starter: settings.stripe_price_starter,
    TenantPlan.professional: settings.stripe_price_professional,
    TenantPlan.enterprise: settings.stripe_price_enterprise,
}

PLAN_LIMITS = {
    "starter":      {"queries": 200,  "pages": 500},
    "professional": {"queries": 1000, "pages": 2000},
    "enterprise":   {"queries": -1,   "pages": -1},
}


@router.post("/billing/checkout", tags=["billing"])
async def create_checkout(
    plan: TenantPlan,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout session for plan upgrade."""
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404)

    price_id = PLAN_PRICE_MAP.get(plan)
    if not price_id:
        raise HTTPException(status_code=400, detail="Invalid plan")

    # Create or reuse Stripe customer
    if not tenant.stripe_customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=tenant.name,
            metadata={"tenant_id": str(tenant.id)},
        )
        tenant.stripe_customer_id = customer.id
        await db.commit()

    session = stripe.checkout.Session.create(
        customer=tenant.stripe_customer_id,
        payment_method_types=["card"],
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.app_url}/dashboard?upgraded=true",
        cancel_url=f"{settings.app_url}/billing",
        metadata={"tenant_id": str(tenant.id), "plan": plan.value},
    )

    return {"checkout_url": session.url}


@router.post("/billing/portal", tags=["billing"])
async def customer_portal(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Redirect to Stripe Customer Portal for invoice history, card management."""
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant or not tenant.stripe_customer_id:
        raise HTTPException(status_code=404, detail="No billing account yet")

    session = stripe.billing_portal.Session.create(
        customer=tenant.stripe_customer_id,
        return_url=f"{settings.app_url}/billing",
    )

    return {"portal_url": session.url}


@router.post("/billing/webhook", tags=["billing"], include_in_schema=False)
@limiter.limit("100/minute")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Handle Stripe webhook events.
    Stripe sends signed events — we verify the signature before processing.
    """
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    data = event["data"]["object"]

    log.info("stripe_webhook", event_type=event_type, event_id=event["id"])

    if event_type == "checkout.session.completed":
        tenant_id = data["metadata"]["tenant_id"]
        plan_str = data["metadata"]["plan"]
        plan = TenantPlan(plan_str)

        limits = PLAN_LIMITS[plan_str]
        await db.execute(
            update(Tenant)
            .where(Tenant.id == tenant_id)
            .values(
                plan=plan,
                stripe_subscription_id=data.get("subscription"),
                monthly_query_limit=limits["queries"],
                monthly_document_page_limit=limits["pages"],
            )
        )

    elif event_type == "customer.subscription.deleted":
        sub_id = data["id"]
        await db.execute(
            update(Tenant)
            .where(Tenant.stripe_subscription_id == sub_id)
            .values(
                plan=TenantPlan.starter,
                monthly_query_limit=PLAN_LIMITS["starter"]["queries"],
                monthly_document_page_limit=PLAN_LIMITS["starter"]["pages"],
            )
        )

    elif event_type in ("invoice.paid", "invoice.payment_failed"):
        # Log for audit trail
        result = await db.execute(
            select(Tenant).where(Tenant.stripe_customer_id == data.get("customer"))
        )
        tenant = result.scalar_one_or_none()
        if tenant:
            log_entry = BillingEvent(
                tenant_id=tenant.id,
                stripe_event_id=event["id"],
                event_type=event_type,
                amount_cents=data.get("amount_paid") or data.get("amount_due"),
                currency=data.get("currency", "nzd"),
            )
            db.add(log_entry)

    await db.commit()
    return {"received": True}
