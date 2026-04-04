"""
Clerk authentication for FastAPI.

Verifies the JWT from Clerk and resolves the user from the DB.
Every protected route depends on get_current_user().
"""
import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from functools import lru_cache

from app.core.config import get_settings
from app.db.session import get_db
from app.models import User, UserRole

settings = get_settings()
bearer_scheme = HTTPBearer()


@lru_cache
def _get_clerk_jwks() -> dict:
    """Fetch Clerk's public JWKS for JWT verification. Cached at startup."""
    url = f"https://api.clerk.com/v1/jwks"
    headers = {"Authorization": f"Bearer {settings.clerk_secret_key}"}
    response = httpx.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    return response.json()


def _verify_clerk_token(token: str) -> dict:
    """Verify a Clerk JWT and return its claims."""
    try:
        jwks = _get_clerk_jwks()
        public_keys = jwt.PyJWKSet.from_dict(jwks)
        header = jwt.get_unverified_header(token)
        key = next(k for k in public_keys.keys if k.key_id == header["kid"])
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except (jwt.InvalidTokenError, StopIteration, Exception) as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency: verifies Clerk JWT, returns User ORM object."""
    claims = _verify_clerk_token(credentials.credentials)
    clerk_id = claims.get("sub")
    if not clerk_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No subject in token")

    result = await db.execute(select(User).where(User.clerk_id == clerk_id, User.is_active == True))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not found. Complete onboarding first."
        )

    return user


def require_role(*roles: UserRole):
    """Dependency factory: raise 403 if user doesn't have one of the required roles."""
    async def check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {[r.value for r in roles]}"
            )
        return user
    return check


# Shorthand dependencies
require_admin = require_role(UserRole.tenant_admin, UserRole.super_admin)
require_editor = require_role(UserRole.tenant_admin, UserRole.super_admin, UserRole.editor)
require_super_admin = require_role(UserRole.super_admin)
