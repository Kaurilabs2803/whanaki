"""
Tests for auth / onboarding routes.

Covers:
- Schema validation (slug format, required fields)
- Protected endpoints reject unauthenticated requests
- PATCH /v1/tenant updates name and primary_color
- GET /v1/users returns tenant members (admin only)
- DELETE /v1/users/:id rejects self-removal
"""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import UserRole
from app.schemas import OnboardRequest


# ── Schema / validation unit tests ────────────────────────────────────────────

class TestOnboardRequestSchema:
    def test_valid_slug_accepted(self):
        req = OnboardRequest(
            organisation_name="Smith Legal",
            slug="smith-legal",
            full_name="Jane Smith",
        )
        assert req.slug == "smith-legal"

    def test_slug_uppercase_rejected(self):
        with pytest.raises(ValueError, match="lowercase"):
            OnboardRequest(
                organisation_name="Smith Legal",
                slug="Smith-Legal",
                full_name="Jane Smith",
            )

    def test_slug_spaces_rejected(self):
        with pytest.raises(ValueError):
            OnboardRequest(
                organisation_name="Smith Legal",
                slug="smith legal",
                full_name="Jane Smith",
            )

    def test_slug_special_chars_rejected(self):
        with pytest.raises(ValueError):
            OnboardRequest(
                organisation_name="Acme",
                slug="acme@co",
                full_name="John",
            )

    def test_slug_numbers_and_hyphens_accepted(self):
        req = OnboardRequest(
            organisation_name="Acme 2024",
            slug="acme-2024",
            full_name="John",
        )
        assert req.slug == "acme-2024"


# ── Auth rejection tests ───────────────────────────────────────────────────────

class TestUnauthenticated:
    def test_get_me_requires_auth(self, unauthed_client):
        resp = unauthed_client.get("/v1/me")
        assert resp.status_code == 403

    def test_get_tenant_requires_auth(self, unauthed_client):
        resp = unauthed_client.get("/v1/tenant")
        assert resp.status_code == 403

    def test_patch_tenant_requires_auth(self, unauthed_client):
        resp = unauthed_client.patch("/v1/tenant", json={"name": "New Name"})
        assert resp.status_code == 403

    def test_list_users_requires_auth(self, unauthed_client):
        resp = unauthed_client.get("/v1/users")
        assert resp.status_code == 403

    def test_delete_tenant_requires_auth(self, unauthed_client):
        resp = unauthed_client.delete("/v1/tenant")
        assert resp.status_code == 403


# ── GET /v1/me ─────────────────────────────────────────────────────────────────

class TestGetMe:
    def test_returns_user_fields(self, admin_client):
        resp = admin_client.get("/v1/me")
        assert resp.status_code == 200
        body = resp.json()
        assert "id" in body
        assert "email" in body
        assert "role" in body


# ── PATCH /v1/tenant ──────────────────────────────────────────────────────────

class TestPatchTenant:
    def test_update_name(self, admin_client, mock_db):
        from app.models import Tenant, TenantPlan, TenantStatus
        import uuid, datetime

        tenant = MagicMock(spec=Tenant)
        tenant.id = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
        tenant.name = "Old Name"
        tenant.slug = "old-slug"
        tenant.plan = TenantPlan.starter
        tenant.status = TenantStatus.active
        tenant.monthly_query_limit = 200
        tenant.ragflow_dataset_id = "ds_123"
        tenant.logo_url = None
        tenant.primary_color = "#0f6e56"
        tenant.trial_ends_at = None
        tenant.created_at = datetime.datetime.utcnow()

        mock_db.get = AsyncMock(return_value=tenant)
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        resp = admin_client.patch("/v1/tenant", json={"name": "New Name"})
        assert resp.status_code == 200
        assert tenant.name == "New Name"

    def test_update_primary_color(self, admin_client, mock_db):
        from app.models import Tenant, TenantPlan, TenantStatus
        import uuid, datetime

        tenant = MagicMock(spec=Tenant)
        tenant.id = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
        tenant.name = "Test Org"
        tenant.slug = "test-org"
        tenant.plan = TenantPlan.starter
        tenant.status = TenantStatus.active
        tenant.monthly_query_limit = 200
        tenant.ragflow_dataset_id = "ds_123"
        tenant.logo_url = None
        tenant.primary_color = "#0f6e56"
        tenant.trial_ends_at = None
        tenant.created_at = datetime.datetime.utcnow()

        mock_db.get = AsyncMock(return_value=tenant)
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        resp = admin_client.patch("/v1/tenant", json={"primary_color": "#ff0000"})
        assert resp.status_code == 200
        assert tenant.primary_color == "#ff0000"

    def test_viewer_cannot_update_tenant(self, viewer_client):
        resp = viewer_client.patch("/v1/tenant", json={"name": "Hacked"})
        assert resp.status_code == 403


# ── DELETE /v1/users/:id ──────────────────────────────────────────────────────

class TestRemoveUser:
    def test_cannot_remove_self(self, admin_client, mock_db):
        """Admin cannot delete themselves."""
        self_id = admin_client.user.id
        resp = admin_client.delete(f"/v1/users/{self_id}")
        assert resp.status_code == 400
        assert "Cannot remove yourself" in resp.json()["detail"]

    def test_remove_nonexistent_user_returns_404(self, admin_client, mock_db):
        mock_db.get = AsyncMock(return_value=None)
        other_id = uuid.uuid4()
        resp = admin_client.delete(f"/v1/users/{other_id}")
        assert resp.status_code == 404

    def test_viewer_cannot_remove_users(self, viewer_client):
        resp = viewer_client.delete(f"/v1/users/{uuid.uuid4()}")
        assert resp.status_code == 403
