"""
Tests for the documents routes.

Covers:
- File type validation (415 for disallowed MIME types)
- File size validation (413 for files exceeding 50 MB)
- List documents returns empty list when no docs exist
- Unauthenticated requests are rejected
- Delete all documents requires admin role
"""
import io
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models import DocumentStatus


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_upload(content: bytes, filename: str, content_type: str):
    return ("file", (filename, io.BytesIO(content), content_type))


# ── Unauthenticated ────────────────────────────────────────────────────────────

class TestUnauthenticated:
    def test_list_docs_requires_auth(self, unauthed_client):
        resp = unauthed_client.get("/v1/documents")
        assert resp.status_code == 403

    def test_upload_requires_auth(self, unauthed_client):
        resp = unauthed_client.post(
            "/v1/documents/upload",
            files=[_make_upload(b"hello", "test.pdf", "application/pdf")],
        )
        assert resp.status_code == 403

    def test_delete_all_requires_auth(self, unauthed_client):
        resp = unauthed_client.delete("/v1/documents")
        assert resp.status_code == 403


# ── File type validation ───────────────────────────────────────────────────────

class TestFileTypeValidation:
    DISALLOWED_TYPES = [
        ("evil.exe",  "application/octet-stream"),
        ("image.png", "image/png"),
        ("data.csv",  "text/csv"),
        ("archive.zip", "application/zip"),
        ("page.html", "text/html"),
    ]

    ALLOWED_TYPES = [
        ("report.pdf",  "application/pdf"),
        ("doc.docx",    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ("notes.txt",   "text/plain"),
        ("readme.md",   "text/markdown"),
    ]

    def test_disallowed_mime_types_return_415(self, admin_client, mock_db):
        from app.models import Tenant, TenantPlan, TenantStatus
        import datetime

        tenant = MagicMock(spec=Tenant)
        tenant.id = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
        tenant.ragflow_dataset_id = "ds_test"
        mock_db.get = AsyncMock(return_value=tenant)

        for filename, ct in self.DISALLOWED_TYPES:
            resp = admin_client.post(
                "/v1/documents/upload",
                files=[_make_upload(b"content", filename, ct)],
            )
            assert resp.status_code == 415, (
                f"Expected 415 for {ct}, got {resp.status_code}"
            )

    def test_allowed_mime_types_pass_validation(self, admin_client, mock_db):
        """Allowed types should not get a 415 (may fail later without real RAGFlow)."""
        from app.models import Tenant
        import uuid

        tenant = MagicMock(spec=Tenant)
        tenant.id = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
        tenant.ragflow_dataset_id = "ds_test"
        mock_db.get = AsyncMock(return_value=tenant)

        for filename, ct in self.ALLOWED_TYPES:
            resp = admin_client.post(
                "/v1/documents/upload",
                files=[_make_upload(b"content", filename, ct)],
            )
            assert resp.status_code != 415, (
                f"Allowed type {ct} was incorrectly rejected with 415"
            )


# ── File size validation ───────────────────────────────────────────────────────

class TestFileSizeValidation:
    def test_oversized_file_returns_413(self, admin_client, mock_db):
        from app.models import Tenant

        tenant = MagicMock(spec=Tenant)
        tenant.id = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
        tenant.ragflow_dataset_id = "ds_test"
        mock_db.get = AsyncMock(return_value=tenant)

        # 51 MB — just over the 50 MB limit
        big_content = b"x" * (51 * 1024 * 1024)
        resp = admin_client.post(
            "/v1/documents/upload",
            files=[_make_upload(big_content, "big.pdf", "application/pdf")],
        )
        assert resp.status_code == 413

    def test_50mb_file_passes_size_check(self, admin_client, mock_db):
        """Exactly 50 MB should not trigger the size limit (may fail for other reasons)."""
        from app.models import Tenant

        tenant = MagicMock(spec=Tenant)
        tenant.id = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
        tenant.ragflow_dataset_id = "ds_test"
        mock_db.get = AsyncMock(return_value=tenant)

        exact_limit = b"x" * (50 * 1024 * 1024)
        resp = admin_client.post(
            "/v1/documents/upload",
            files=[_make_upload(exact_limit, "exact.pdf", "application/pdf")],
        )
        assert resp.status_code != 413


# ── Workspace not initialised ──────────────────────────────────────────────────

class TestWorkspaceNotInitialised:
    def test_upload_without_ragflow_dataset_returns_412(self, admin_client, mock_db):
        from app.models import Tenant

        tenant = MagicMock(spec=Tenant)
        tenant.id = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
        tenant.ragflow_dataset_id = None  # Not provisioned
        mock_db.get = AsyncMock(return_value=tenant)

        resp = admin_client.post(
            "/v1/documents/upload",
            files=[_make_upload(b"content", "doc.pdf", "application/pdf")],
        )
        assert resp.status_code == 412


# ── List documents ─────────────────────────────────────────────────────────────

class TestListDocuments:
    def test_list_returns_empty_when_no_docs(self, admin_client, mock_db):
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = []
        result_mock = MagicMock()
        result_mock.scalars.return_value = scalars_mock
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = admin_client.get("/v1/documents")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_viewer_can_list_documents(self, viewer_client, mock_db):
        """Listing documents does not require admin role."""
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = []
        result_mock = MagicMock()
        result_mock.scalars.return_value = scalars_mock
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = viewer_client.get("/v1/documents")
        assert resp.status_code == 200


# ── Delete all documents ───────────────────────────────────────────────────────

class TestDeleteAllDocuments:
    def test_viewer_cannot_delete_all(self, viewer_client):
        resp = viewer_client.delete("/v1/documents")
        assert resp.status_code == 403

    def test_admin_can_delete_all_empty(self, admin_client, mock_db):
        from app.models import Tenant

        tenant = MagicMock(spec=Tenant)
        tenant.id = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
        tenant.ragflow_dataset_id = "ds_test"

        scalars_mock = MagicMock()
        scalars_mock.all.return_value = []
        result_mock = MagicMock()
        result_mock.scalars.return_value = scalars_mock

        mock_db.get = AsyncMock(return_value=tenant)
        mock_db.execute = AsyncMock(return_value=result_mock)
        mock_db.commit = AsyncMock()

        resp = admin_client.delete("/v1/documents")
        assert resp.status_code == 200
        assert resp.json()["deleted"] == 0


# ── Delete single document ─────────────────────────────────────────────────────

class TestDeleteDocument:
    def test_viewer_cannot_delete_single_document(self, viewer_client):
        resp = viewer_client.delete(f"/v1/documents/{uuid.uuid4()}")
        assert resp.status_code == 403

    def test_admin_can_delete_single_document(self, admin_client, mock_db):
        from app.models import Document, Tenant

        doc_id = uuid.UUID("cccccccc-0000-0000-0000-000000000001")
        doc = MagicMock(spec=Document)
        doc.id = doc_id
        doc.tenant_id = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
        doc.ragflow_doc_id = "rag_doc_123"

        tenant = MagicMock(spec=Tenant)
        tenant.id = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
        tenant.ragflow_dataset_id = "ds_test"

        mock_db.get = AsyncMock(side_effect=[doc, tenant])
        mock_db.commit = AsyncMock()

        resp = admin_client.delete(f"/v1/documents/{doc_id}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True
