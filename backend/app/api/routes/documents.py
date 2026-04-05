"""
Documents API — upload, list, delete, and poll ingest status.

POST   /v1/documents/upload     — upload a file, trigger RAGFlow ingest
GET    /v1/documents            — list all tenant documents
GET    /v1/documents/{id}       — get single document (with ingest status)
DELETE /v1/documents/{id}       — remove from RAGFlow + DB
"""
import uuid
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import get_current_user, require_admin, require_editor
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.models import Document, DocumentStatus, Tenant, User
from app.schemas import DocumentResponse
from app.services.ragflow_client import get_ragflow_client
from app.core.config import get_settings

router = APIRouter()
log = structlog.get_logger()
settings = get_settings()

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "application/msword",
}

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


async def _get_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


async def _ingest_background(
    doc_id: uuid.UUID,
    tenant_id: uuid.UUID,
    ragflow_doc_id: str,
    dataset_id: str,
):
    """
    Background task: wait for RAGFlow ingest to complete, update document status.
    Runs after the upload response is already sent to the client.
    """
    from app.db.session import AsyncSessionLocal
    ragflow = get_ragflow_client()

    async with AsyncSessionLocal() as db:
        try:
            # Trigger ingest
            await ragflow.start_ingest(dataset_id, [ragflow_doc_id])

            # Poll until done (up to 5 minutes)
            status = await ragflow.wait_for_ingest(
                dataset_id=dataset_id,
                doc_id=ragflow_doc_id,
                timeout_seconds=300,
            )

            new_status = DocumentStatus.ready if status.status == "done" else DocumentStatus.failed

            doc = await db.get(Document, doc_id)
            if doc:
                doc.status = new_status
                doc.error_message = status.error if status.status == "failed" else None
                await db.commit()

            log.info("ingest_complete", doc_id=str(doc_id), status=status.status)

        except Exception as e:
            log.error("ingest_background_failed", doc_id=str(doc_id), error=str(e))
            doc = await db.get(Document, doc_id)
            if doc:
                doc.status = DocumentStatus.failed
                doc.error_message = str(e)
                await db.commit()


@router.post("/documents/upload", response_model=DocumentResponse, tags=["documents"])
@limiter.limit("20/minute")
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    tags: Optional[str] = Form(None),   # Comma-separated tag list
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a document to the tenant's knowledge base.

    The file is immediately stored and a RAGFlow ingest job is triggered
    in the background. Poll GET /documents/{id} for status.
    """
    tenant = await _get_tenant(db, current_user.tenant_id)

    # Validate
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Allowed: PDF, DOCX, TXT, MD",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum is 50 MB.")

    tag_list = [t.strip() for t in tags.split(",")] if tags else []

    # Upload to RAGFlow if available; otherwise store locally and mark failed
    ragflow_doc_id = None
    upload_error: Optional[str] = None
    if not tenant.ragflow_dataset_id:
        upload_error = "Workspace RAGFlow dataset not provisioned. Re-complete onboarding or contact support."
    else:
        ragflow = get_ragflow_client()
        try:
            ragflow_doc_id = await ragflow.upload_document(
                dataset_id=tenant.ragflow_dataset_id,
                filename=file.filename,
                file_bytes=file_bytes,
                content_type=file.content_type,
            )
        except Exception as e:
            upload_error = str(e)
            log.error("ragflow_upload_failed", error=str(e))

    # Create DB record
    doc = Document(
        tenant_id=tenant.id,
        uploaded_by=current_user.id,
        filename=file.filename,
        original_filename=file.filename,
        content_type=file.content_type,
        size_bytes=len(file_bytes),
        status=DocumentStatus.processing if ragflow_doc_id else DocumentStatus.failed,
        error_message=upload_error if not ragflow_doc_id else None,
        storage_key=f"{tenant.id}/{ragflow_doc_id or 'local'}/{file.filename}",
        ragflow_doc_id=ragflow_doc_id,
        tags=tag_list,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Queue background ingest only if RAGFlow accepted the file
    if ragflow_doc_id and tenant.ragflow_dataset_id:
        background_tasks.add_task(
            _ingest_background,
            doc_id=doc.id,
            tenant_id=tenant.id,
            ragflow_doc_id=ragflow_doc_id,
            dataset_id=tenant.ragflow_dataset_id,
        )

    log.info(
        "document_uploaded",
        doc_id=str(doc.id),
        filename=file.filename,
        size_bytes=len(file_bytes),
        ragflow=bool(ragflow_doc_id),
    )
    return DocumentResponse.model_validate(doc)


@router.get("/documents", response_model=list[DocumentResponse], tags=["documents"])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all documents in the tenant's knowledge base."""
    result = await db.execute(
        select(Document)
        .where(Document.tenant_id == current_user.tenant_id)
        .order_by(Document.created_at.desc())
    )
    return [DocumentResponse.model_validate(d) for d in result.scalars().all()]


@router.get("/documents/{doc_id}", response_model=DocumentResponse, tags=["documents"])
async def get_document(
    doc_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single document. Use this to poll ingest status."""
    doc = await db.get(Document, doc_id)
    if not doc or doc.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404)
    return DocumentResponse.model_validate(doc)


@router.delete("/documents", tags=["documents"])
async def delete_all_documents(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete every document in the tenant's knowledge base.
    Removes all chunks from RAGFlow and all records from the DB.
    Admin only. Cannot be undone.
    """
    tenant = await _get_tenant(db, current_user.tenant_id)

    result = await db.execute(
        select(Document).where(Document.tenant_id == current_user.tenant_id)
    )
    docs = result.scalars().all()

    ragflow = get_ragflow_client()
    failed = 0
    for doc in docs:
        if doc.ragflow_doc_id and tenant.ragflow_dataset_id:
            deleted = await ragflow.delete_document(tenant.ragflow_dataset_id, doc.ragflow_doc_id)
            if not deleted:
                failed += 1
                continue
        await db.delete(doc)

    await db.commit()
    log.info("all_documents_deleted", tenant_id=str(tenant.id), count=len(docs), failed=failed)
    return {"deleted": len(docs), "failed": failed}


@router.delete("/documents/{doc_id}", tags=["documents"])
async def delete_document(
    doc_id: uuid.UUID,
    current_user: User = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a document from RAGFlow and the DB.
    This removes all its chunks from the vector index.
    """
    doc = await db.get(Document, doc_id)
    if not doc or doc.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404)

    tenant = await _get_tenant(db, current_user.tenant_id)

    # Remove from RAGFlow
    if doc.ragflow_doc_id and tenant.ragflow_dataset_id:
        ragflow = get_ragflow_client()
        await ragflow.delete_document(tenant.ragflow_dataset_id, doc.ragflow_doc_id)

    await db.delete(doc)
    await db.commit()

    return {"deleted": True, "doc_id": str(doc_id)}
