from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import User, Tenant
from app.services.quota import get_usage_summary, get_monthly_query_count

router = APIRouter()


@router.get("/usage", tags=["usage"])
async def usage_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return this month's usage summary for the current tenant."""
    tenant = await db.get(Tenant, current_user.tenant_id)
    summary = await get_usage_summary(db, current_user.tenant_id)

    used = summary["query_count"]
    limit = tenant.monthly_query_limit
    remaining = max(0, limit - used) if limit != -1 else -1

    return {
        **summary,
        "queries_included": limit,
        "queries_remaining": remaining,
        "plan": tenant.plan.value,
        "percentage_used": round((used / limit * 100), 1) if limit > 0 else 0,
    }
