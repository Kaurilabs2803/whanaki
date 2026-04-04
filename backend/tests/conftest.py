"""
Shared fixtures for Whānaki backend tests.

Uses FastAPI's TestClient with dependency_overrides so tests run without
a live PostgreSQL, Redis, or external services.
"""
import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user, require_admin
from app.db.session import get_db
from app.models import User, UserRole, Tenant, TenantPlan, TenantStatus

# ── Stable IDs shared across fixtures ─────────────────────────────────────────

TEST_TENANT_ID = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
TEST_USER_ID   = uuid.UUID("bbbbbbbb-0000-0000-0000-000000000001")


# ── ORM mocks ─────────────────────────────────────────────────────────────────

def _make_tenant() -> MagicMock:
    t = MagicMock(spec=Tenant)
    t.id = TEST_TENANT_ID
    t.name = "Test Org"
    t.slug = "test-org"
    t.plan = TenantPlan.starter
    t.status = TenantStatus.active
    t.monthly_query_limit = 200
    t.ragflow_dataset_id = "ds_test_123"
    t.logo_url = None
    t.primary_color = "#0f6e56"
    t.trial_ends_at = None
    t.created_at = None
    return t


def _make_user(role: UserRole = UserRole.tenant_admin) -> MagicMock:
    u = MagicMock(spec=User)
    u.id = TEST_USER_ID
    u.tenant_id = TEST_TENANT_ID
    u.clerk_id = "user_test_abc123"
    u.email = "test@example.com"
    u.full_name = "Test User"
    u.role = role
    u.is_active = True
    u.created_at = datetime.datetime.utcnow()
    return u


# ── DB session mock ────────────────────────────────────────────────────────────

@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.__aenter__ = AsyncMock(return_value=db)
    db.__aexit__ = AsyncMock(return_value=False)
    return db


# ── TestClient fixtures ────────────────────────────────────────────────────────

@pytest.fixture
def admin_client(mock_db):
    """Authenticated client with tenant_admin role."""
    user = _make_user(UserRole.tenant_admin)
    tenant = _make_tenant()

    async def _get_db():
        yield mock_db

    async def _get_user():
        return user

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = _get_user
    app.dependency_overrides[require_admin] = _get_user

    with TestClient(app, raise_server_exceptions=False) as c:
        c.tenant = tenant
        c.user = user
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def viewer_client(mock_db):
    """Authenticated client with viewer role (limited permissions)."""
    user = _make_user(UserRole.viewer)

    async def _get_db():
        yield mock_db

    async def _get_user():
        return user

    # Do NOT override require_admin — viewer should be rejected by it
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = _get_user

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def unauthed_client():
    """Client with no auth overrides — exercises real 401/403 paths."""
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
