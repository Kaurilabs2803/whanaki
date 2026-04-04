"""
Tests for GET /health.

The health endpoint checks DB, Redis, Ollama, and RAGFlow.
We verify the response structure without requiring live services.
"""
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def _patch_all_healthy():
    """Context manager: patch every external service to report healthy."""
    return [
        patch("app.api.routes.health.get_db", return_value=_async_db_gen()),
        patch("app.api.routes.health.get_ragflow_client", return_value=_mock_ragflow(True)),
    ]


async def _async_db_gen():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=AsyncMock(scalar=lambda: 1))
    yield db


def _mock_ragflow(healthy: bool):
    rf = AsyncMock()
    rf.health = AsyncMock(return_value=(healthy, 12.3))
    return rf


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_health_endpoint_exists(client):
    """Health endpoint must be reachable without authentication."""
    resp = client.get("/health")
    # May be degraded (services not running) but must not be a 404 or 500
    assert resp.status_code in (200, 503), f"Unexpected status: {resp.status_code}"


def test_health_response_structure(client):
    """Response must include status and services keys."""
    resp = client.get("/health")
    assert resp.status_code in (200, 503)
    body = resp.json()
    assert "status" in body
    assert "services" in body
    assert body["status"] in ("ok", "degraded", "down")


def test_health_services_keys(client):
    """Every expected service must appear in the services map."""
    resp = client.get("/health")
    body = resp.json()
    for svc in ("postgres", "redis", "ollama", "ragflow"):
        assert svc in body["services"], f"Missing service key: {svc}"


def test_health_service_structure(client):
    """Each service entry must have a 'status' field."""
    resp = client.get("/health")
    body = resp.json()
    for name, svc in body["services"].items():
        assert "status" in svc, f"Service '{name}' missing 'status' field"
        assert svc["status"] in ("ok", "degraded", "down"), (
            f"Service '{name}' has unexpected status: {svc['status']}"
        )
