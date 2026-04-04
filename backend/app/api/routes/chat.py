"""
Chat API — the main query endpoint.

POST /v1/chat
  - Creates or continues a conversation
  - Enforces quota
  - Streams SSE tokens from the RAGFlow→Ollama pipeline
  - Returns citations inline

GET /v1/conversations
GET /v1/conversations/{id}/messages
"""
import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import get_current_user
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.models import User, Tenant, Conversation, Message, OllamaModel
from app.schemas import ChatRequest, ConversationCreate, ConversationResponse, MessageResponse
from app.services.pipeline import get_pipeline
from app.services.quota import enforce_query_quota

router = APIRouter()


async def _get_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


async def _get_or_create_conversation(
    db: AsyncSession,
    user: User,
    tenant: Tenant,
    conversation_id: Optional[uuid.UUID],
    model: str,
    doc_filter: Optional[list[uuid.UUID]],
) -> Conversation:
    if conversation_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.tenant_id == tenant.id,
            )
        )
        conv = result.scalar_one_or_none()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conv

    # New conversation
    conv = Conversation(
        tenant_id=tenant.id,
        user_id=user.id,
        default_model=model,
        document_filter=[str(d) for d in doc_filter] if doc_filter else None,
    )
    db.add(conv)
    await db.flush()
    return conv


async def _validate_model(db: AsyncSession, model_id: str) -> str:
    """Ensure the requested model is active. Fall back to default if not."""
    result = await db.execute(
        select(OllamaModel).where(OllamaModel.model_id == model_id, OllamaModel.is_active == True)
    )
    if result.scalar_one_or_none():
        return model_id

    # Fall back to default model
    default = await db.execute(
        select(OllamaModel).where(OllamaModel.is_default == True)
    )
    m = default.scalar_one_or_none()
    return m.model_id if m else "llama3.1:8b"


async def _sse_stream(generator):
    """Wrap an async generator into SSE format."""
    async for event in generator:
        yield f"data: {json.dumps(event)}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/chat", tags=["chat"])
@limiter.limit("30/minute")
async def chat(
    request: Request,
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Main chat endpoint. Streams SSE events:
      data: {"type": "token",    "content": "..."}
      data: {"type": "citation", "citation": {...}}
      data: {"type": "done",     "message_id": "...", "stats": {...}}
      data: {"type": "error",    "detail": "..."}
      data: [DONE]
    """
    tenant = await _get_tenant(db, current_user.tenant_id)

    # Check tenant has a RAGFlow dataset
    if not tenant.ragflow_dataset_id:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="Workspace not fully set up. Please upload at least one document first.",
        )

    # Enforce monthly quota
    await enforce_query_quota(db, tenant)

    # Validate model
    model = await _validate_model(db, body.model)

    # Get or create conversation
    conv = await _get_or_create_conversation(
        db=db,
        user=current_user,
        tenant=tenant,
        conversation_id=body.conversation_id,
        model=model,
        doc_filter=body.document_filter,
    )

    pipeline = get_pipeline()

    return StreamingResponse(
        _sse_stream(
            pipeline.query(
                db=db,
                tenant=tenant,
                user=current_user,
                conversation_id=conv.id,
                question=body.message,
                model=model,
                doc_filter=[str(d) for d in body.document_filter] if body.document_filter else None,
            )
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",       # Disable Nginx buffering for SSE
            "X-Conversation-Id": str(conv.id),
        },
    )


@router.get("/conversations", response_model=list[ConversationResponse], tags=["chat"])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all conversations for the current user, newest first."""
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.user_id == current_user.id,
            Conversation.tenant_id == current_user.tenant_id,
        )
        .order_by(Conversation.updated_at.desc())
        .limit(50)
    )
    return [ConversationResponse.model_validate(c) for c in result.scalars().all()]


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse], tags=["chat"])
async def get_messages(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all messages in a conversation."""
    # Verify ownership
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    if not conv_result.scalar_one_or_none():
        raise HTTPException(status_code=404)

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    return [MessageResponse.model_validate(m) for m in result.scalars().all()]


@router.delete("/conversations/{conversation_id}", tags=["chat"])
async def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a conversation and all its messages."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404)

    await db.delete(conv)
    await db.commit()
    return {"deleted": True}
