"""
Quota enforcement — checks tenant usage limits before allowing queries.
Raises HTTP 429 if the tenant has exceeded their monthly allowance.
"""
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.models import UsageLog, Tenant, TenantPlan
import structlog

log = structlog.get_logger()


async def get_monthly_query_count(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    """Count queries used this calendar month for a tenant."""
    result = await db.execute(
        text("""
            SELECT COUNT(*)
            FROM usage_logs
            WHERE tenant_id = :tenant_id
              AND date_trunc('month', created_at) = date_trunc('month', NOW())
        """),
        {"tenant_id": str(tenant_id)},
    )
    return result.scalar() or 0


async def enforce_query_quota(db: AsyncSession, tenant: Tenant) -> None:
    """
    Raise HTTP 429 if the tenant has hit their monthly query limit.
    -1 limit = unlimited (Enterprise plan).
    """
    if tenant.monthly_query_limit == -1:
        return  # Unlimited

    used = await get_monthly_query_count(db, tenant.id)
    if used >= tenant.monthly_query_limit:
        log.warning(
            "quota_exceeded",
            tenant_id=str(tenant.id),
            plan=tenant.plan.value,
            used=used,
            limit=tenant.monthly_query_limit,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "monthly_limit_reached",
                "used": used,
                "limit": tenant.monthly_query_limit,
                "plan": tenant.plan.value,
                "message": (
                    f"You've used all {tenant.monthly_query_limit} queries for this month. "
                    "Upgrade your plan or wait until next month."
                ),
            },
        )


async def get_usage_summary(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
    """Return this month's usage summary for the tenant dashboard."""
    result = await db.execute(
        text("""
            SELECT
                COUNT(*) as query_count,
                COALESCE(SUM(input_tokens), 0) as input_tokens,
                COALESCE(SUM(output_tokens), 0) as output_tokens,
                model
            FROM usage_logs
            WHERE tenant_id = :tenant_id
              AND date_trunc('month', created_at) = date_trunc('month', NOW())
            GROUP BY model
        """),
        {"tenant_id": str(tenant_id)},
    )
    rows = result.fetchall()

    total_queries = sum(r.query_count for r in rows)
    total_input = sum(r.input_tokens for r in rows)
    total_output = sum(r.output_tokens for r in rows)
    model_breakdown = {r.model: r.query_count for r in rows}

    return {
        "month": datetime.utcnow().strftime("%Y-%m"),
        "query_count": total_queries,
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "model_breakdown": model_breakdown,
    }
