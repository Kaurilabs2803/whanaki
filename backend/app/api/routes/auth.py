"""
Onboarding: called once after a user signs up via Clerk.
Creates their Tenant + User record and provisions a RAGFlow dataset.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta

import jwt
import httpx
import structlog

from app.core.config import get_settings
from app.core.auth import get_current_user, bearer_scheme, require_admin, _verify_clerk_token
from app.db.session import get_db
from app.models import Tenant, User, UserRole
from app.schemas import (
    OnboardRequest, OnboardResponse, UserResponse,
    TenantResponse, TenantUpdate,
)
from app.services.ragflow_client import get_ragflow_client

router = APIRouter()
settings = get_settings()
log = structlog.get_logger()


@router.post("/onboard", response_model=OnboardResponse, tags=["auth"])
async def onboard(
    body: OnboardRequest,
    credentials=Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Called once after Clerk signup.
    Creates Tenant + admin User and provisions a RAGFlow dataset atomically.
    Safe to call multiple times (idempotent via 409).
    """
    claims = _verify_clerk_token(credentials.credentials)
    clerk_id = claims.get("sub")

    # Check if already onboarded
    existing = await db.execute(select(User).where(User.clerk_id == clerk_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already onboarded")

    # Check slug uniqueness
    slug_check = await db.execute(select(Tenant).where(Tenant.slug == body.slug))
    if slug_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already taken")

    # Get email from Clerk
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://api.clerk.com/v1/users/{clerk_id}",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            timeout=10,
        )
    clerk_user = r.json()
    email = clerk_user["email_addresses"][0]["email_address"]

    # Stage Tenant (flushed but not committed — rolled back automatically if anything below fails)
    tenant = Tenant(
        name=body.organisation_name,
        slug=body.slug,
        trial_ends_at=datetime.utcnow() + timedelta(days=14),
        monthly_query_limit=200,
    )
    db.add(tenant)
    await db.flush()  # Assigns tenant.id without committing

    # Provision RAGFlow dataset if available — non-blocking so workspace creation
    # succeeds even when RAGFlow is down. Dataset can be created lazily later.
    ragflow = get_ragflow_client()
    try:
        dataset_id = await ragflow.create_dataset(str(tenant.id), body.slug)
        tenant.ragflow_dataset_id = dataset_id
        log.info("ragflow_dataset_provisioned", tenant_id=str(tenant.id), dataset_id=dataset_id)
    except Exception as e:
        tenant.ragflow_dataset_id = None
        log.warning("ragflow_provision_failed", tenant_id=str(tenant.id), error=str(e))

    # Create User (as tenant_admin — first user owns the tenant)
    user = User(
        clerk_id=clerk_id,
        tenant_id=tenant.id,
        email=email,
        full_name=body.full_name,
        role=UserRole.tenant_admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(tenant)
    await db.refresh(user)

    return OnboardResponse(
        user=UserResponse.model_validate(user),
        tenant=TenantResponse.model_validate(tenant),
    )


@router.get("/me", response_model=UserResponse, tags=["auth"])
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return UserResponse.model_validate(current_user)


# ── Tenant management ──────────────────────────────────────────────────────────

@router.get("/tenant", response_model=TenantResponse, tags=["auth"])
async def get_tenant(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's tenant details."""
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return TenantResponse.model_validate(tenant)


@router.patch("/tenant", response_model=TenantResponse, tags=["auth"])
async def update_tenant(
    body: TenantUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update workspace name and branding. Admin only."""
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if body.name is not None:
        tenant.name = body.name
    if body.primary_color is not None:
        tenant.primary_color = body.primary_color
    await db.commit()
    await db.refresh(tenant)
    log.info("tenant_updated", tenant_id=str(tenant.id))
    return TenantResponse.model_validate(tenant)


@router.delete("/tenant", status_code=status.HTTP_204_NO_CONTENT, tags=["auth"])
async def delete_tenant(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Permanently delete the workspace, all documents, conversations, and users.
    Cascades via FK constraints. Admin only. Cannot be undone.
    """
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Best-effort RAGFlow dataset cleanup
    if tenant.ragflow_dataset_id:
        ragflow = get_ragflow_client()
        try:
            await ragflow._client.delete(f"/api/v1/datasets/{tenant.ragflow_dataset_id}")
        except Exception as e:
            log.warning("ragflow_dataset_delete_failed", tenant_id=str(tenant.id), error=str(e))

    await db.delete(tenant)
    await db.commit()
    log.info("tenant_deleted", tenant_id=str(tenant.id))


# ── User management ────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse], tags=["auth"])
async def list_users(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all users in the current tenant. Admin only."""
    result = await db.execute(
        select(User)
        .where(User.tenant_id == current_user.tenant_id)
        .order_by(User.created_at)
    )
    return [UserResponse.model_validate(u) for u in result.scalars().all()]


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["auth"])
async def remove_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a user from the tenant. Cannot remove yourself. Admin only."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from the workspace")
    user = await db.get(User, user_id)
    if not user or user.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    log.info("user_removed", removed_user_id=str(user_id), by=str(current_user.id))
