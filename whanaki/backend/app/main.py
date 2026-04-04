"""
WHĀNAKI — FastAPI backend entry point.
"""
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.rate_limit import limiter
from app.api.routes import health, auth, billing, models, chat, documents, usage

log = structlog.get_logger()
settings = get_settings()


_REQUIRED_IN_PROD = {
    "secret_key":         ("SECRET_KEY",          "change-me-in-production"),
    "clerk_secret_key":   ("CLERK_SECRET_KEY",     ""),
    "stripe_secret_key":  ("STRIPE_SECRET_KEY",    ""),
    "ragflow_api_key":    ("RAGFLOW_API_KEY",       ""),
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(settings.environment, settings.log_level)

    if settings.environment == "production":
        missing = []
        for attr, (env_name, insecure_default) in _REQUIRED_IN_PROD.items():
            value = getattr(settings, attr, "")
            if not value or value == insecure_default:
                missing.append(env_name)
        if missing:
            raise RuntimeError(
                f"Production startup blocked — the following env vars are missing or still set "
                f"to insecure defaults: {', '.join(missing)}"
            )

    log.info("whanaki_starting", environment=settings.environment)
    yield
    log.info("whanaki_shutdown")


app = FastAPI(
    title="Whānaki API",
    description="NZ Knowledge AI — backend API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url=None,
)

# ── Rate limiting ──────────────────────────────────────────────────────────────
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded. {exc.detail}"},
        headers={"Retry-After": str(getattr(exc, "retry_after", 60))},
    )

# ── CORS ──────────────────────────────────────────────────────────────────────
# Origins are read from ALLOWED_ORIGINS env var (comma-separated).
# Never use wildcards — list each domain explicitly.
_allowed_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(auth.router,    prefix="/v1")
app.include_router(billing.router, prefix="/v1")
app.include_router(models.router,    prefix="/v1")
app.include_router(chat.router,      prefix="/v1")
app.include_router(documents.router, prefix="/v1")
app.include_router(usage.router,     prefix="/v1")
