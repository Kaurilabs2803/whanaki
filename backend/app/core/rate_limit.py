"""
Rate limiting via slowapi (Redis-backed in production, in-memory in dev).

Key function uses the Clerk user ID extracted from the JWT so limits are
per-user, not per-IP. Falls back to IP for unauthenticated endpoints.

Limits applied per endpoint:
  /v1/chat              — 30/minute  (GPU resource, expensive)
  /v1/documents/upload  — 20/minute  (storage + ingest pipeline)
  /v1/billing/webhook   — 100/minute (protect against webhook floods)
  default (all others)  — 200/minute (general API safety net)
"""
import jwt
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings
from app.core.auth import _verify_clerk_token

settings = get_settings()


def _user_or_ip(request: Request) -> str:
    """
    Extract the Clerk user ID (sub claim) from the Bearer token to rate-limit
    per-user rather than per-IP. Falls back to IP if no valid token is present.

    Note: we intentionally skip signature verification here — the auth layer
    enforces validity. We only need a stable key for bucketing.
    """
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            claims = _verify_clerk_token(auth[7:])
            sub = claims.get("sub")
            if sub:
                return sub
        except Exception:
            pass
    return get_remote_address(request)


# Use Redis as the rate-limit store in production so limits are shared across
# backend replicas when scaled (e.g. --scale backend=2). Falls back to in-memory
# for local dev if Redis URL is the default localhost address.
_storage_uri = settings.redis_url if settings.environment == "production" else "memory://"

limiter = Limiter(key_func=_user_or_ip, storage_uri=_storage_uri)
