import time
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import redis.asyncio as aioredis

from app.core.config import get_settings
from app.db.session import get_db
from app.schemas import HealthResponse, ServiceHealth

router = APIRouter()
settings = get_settings()


async def _check_postgres(db: AsyncSession) -> ServiceHealth:
    try:
        t0 = time.monotonic()
        await db.execute(text("SELECT 1"))
        ms = (time.monotonic() - t0) * 1000
        return ServiceHealth(status="ok", latency_ms=round(ms, 1))
    except Exception as e:
        return ServiceHealth(status="down", detail=str(e))


async def _check_redis() -> ServiceHealth:
    try:
        t0 = time.monotonic()
        r = aioredis.from_url(settings.redis_url)
        await r.ping()
        ms = (time.monotonic() - t0) * 1000
        await r.aclose()
        return ServiceHealth(status="ok", latency_ms=round(ms, 1))
    except Exception as e:
        return ServiceHealth(status="down", detail=str(e))


async def _check_ollama() -> ServiceHealth:
    try:
        t0 = time.monotonic()
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{settings.ollama_host}/api/tags")
        ms = (time.monotonic() - t0) * 1000
        if r.status_code == 200:
            models = [m["name"] for m in r.json().get("models", [])]
            return ServiceHealth(status="ok", latency_ms=round(ms, 1), detail=f"Models: {', '.join(models) or 'none pulled yet'}")
        return ServiceHealth(status="degraded", latency_ms=round(ms, 1), detail=f"HTTP {r.status_code}")
    except Exception as e:
        return ServiceHealth(status="down", detail=str(e))


async def _check_ragflow() -> ServiceHealth:
    try:
        t0 = time.monotonic()
        async with httpx.AsyncClient(timeout=5) as client:
            # RAGFlow v0.24+ has no /v1/health — any HTTP response means the server is up
            r = await client.get(f"{settings.ragflow_host}/v1/system/version")
        ms = (time.monotonic() - t0) * 1000
        # 200 = ok, 404 = server up but endpoint missing, 401 = server up but auth required
        if r.status_code < 500:
            return ServiceHealth(status="ok", latency_ms=round(ms, 1))
        return ServiceHealth(status="degraded", latency_ms=round(ms, 1), detail=f"HTTP {r.status_code}")
    except Exception as e:
        return ServiceHealth(status="down", detail=str(e))


@router.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Check the health of all dependent services.
    Returns 200 even if services are degraded — use status field to determine severity.
    """
    postgres, redis, ollama, ragflow = await _check_postgres(db), await _check_redis(), await _check_ollama(), await _check_ragflow()

    services = {
        "postgres": postgres,
        "redis": redis,
        "ollama": ollama,
        "ragflow": ragflow,
    }

    # Overall status: worst of critical services only (RAGFlow is optional)
    critical_statuses = [services["postgres"].status, services["redis"].status, services["ollama"].status]
    if "down" in critical_statuses or "degraded" in critical_statuses:
        overall = "degraded"
    else:
        overall = "ok"

    return HealthResponse(status=overall, services=services)


@router.get("/ping", tags=["system"])
async def ping():
    """Minimal liveness probe."""
    return {"pong": True}
