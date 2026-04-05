"""
RAGFlowOllamaPipeline — the core query orchestrator.

Flow:
  1. Retrieve relevant chunks from RAGFlow (tenant's dataset)
  2. Build a prompt with NZ-specific system instructions + retrieved context
  3. Stream tokens from Ollama
  4. Extract inline citations as they arrive
  5. Log usage for billing
  6. Store message + citations to DB
"""
import re
import time
import uuid
from typing import AsyncGenerator, Optional

import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, case

from app.core.config import get_settings
from app.services.ollama_client import OllamaClient, get_ollama_client
from app.services.ragflow_client import RAGFlowClient, get_ragflow_client, RetrievedChunk
from app.models import Conversation, Message, UsageLog, Tenant, User

log = structlog.get_logger()
settings = get_settings()


# ── NZ system prompts ──────────────────────────────────────────────────────────

SYSTEM_PROMPTS = {
    "default": """You are Whānaki, a New Zealand knowledge assistant. You answer questions \
based on the provided document context when available, otherwise from general knowledge.

Guidelines:
- When documents are provided, answer from them and cite sources inline using [Doc: filename, p.N].
- If no relevant documents are provided, answer from general knowledge clearly.
- Use NZ English spelling (organisation, colour, behaviour, recognise).
- Respect Māori terminology and macrons (do not anglicise Māori words).
- Be precise and concise. Avoid padding.
- If information may be outdated, flag it.

Context documents:
{context}""",

    "tenancy": """You are a New Zealand residential tenancy law specialist. Answer based \
on the provided context documents when available, otherwise from general knowledge.

Guidelines:
- Cite the Residential Tenancies Act 1986 section numbers when referenced.
- Reference Tenancy Tribunal decisions by case number if available.
- Distinguish between binding law and interpretive guidance.
- Flag if bond, notice periods, or rent rules may have changed — tenancy law \
  was significantly amended in 2020 and 2024.
- Use NZ English. Spell organisation/colour/behaviour correctly.
- If uncertain, say so rather than speculate.
- Cite inline: [RTA s.XX] or [Doc: filename, p.N]

Context documents:
{context}""",

    "tax": """You are a New Zealand tax specialist. Answer based on the provided \
context documents when available, otherwise from general knowledge.

Guidelines:
- Cite IRD rulings by reference number and date.
- Note effective dates. IRD rulings expire — flag if a ruling may be superseded.
- Distinguish public rulings, private rulings, and interpretations.
- Flag areas requiring advice from a chartered accountant.
- Use NZ English.
- Cite inline: [IRD: BRXXXX] or [Doc: filename, p.N]

Context documents:
{context}""",
}


def _format_context(chunks: list[RetrievedChunk]) -> str:
    """Format retrieved chunks into a numbered context block for the prompt."""
    if not chunks:
        return "No relevant documents found."

    parts = []
    for i, chunk in enumerate(chunks, 1):
        page_ref = f", p.{chunk.page_number}" if chunk.page_number else ""
        parts.append(
            f"[{i}] Source: {chunk.doc_name}{page_ref} (relevance: {chunk.score:.2f})\n"
            f"{chunk.content.strip()}"
        )
    return "\n\n---\n\n".join(parts)


def _select_system_prompt(tenant_id: str, query: str) -> str:
    """
    Select the most appropriate system prompt based on query content.
    In future, tenant admins can set their default prompt type.
    """
    q = query.lower()
    if any(w in q for w in ["tenancy", "tenant", "landlord", "rental", "bond", "rta", "evict"]):
        return SYSTEM_PROMPTS["tenancy"]
    if any(w in q for w in ["tax", "ird", "gst", "income tax", "paye", "depreciation", "ruling"]):
        return SYSTEM_PROMPTS["tax"]
    return SYSTEM_PROMPTS["default"]


def _extract_citations(
    response_text: str,
    chunks: list[RetrievedChunk],
) -> list[dict]:
    """
    Extract citation references from the response text and match to source chunks.

    Handles two citation patterns:
    - [Doc: filename, p.N]
    - [RTA s.XX], [IRD: BRXXXX] (statute/ruling references)
    """
    citations = []
    seen = set()

    # Pattern 1: [Doc: filename, p.N]
    doc_pattern = re.compile(r'\[Doc:\s*([^,\]]+?)(?:,\s*p\.(\d+))?\]', re.IGNORECASE)
    for match in doc_pattern.finditer(response_text):
        filename = match.group(1).strip()
        page = int(match.group(2)) if match.group(2) else None

        # Find the matching chunk
        matching_chunk = next(
            (c for c in chunks if filename.lower() in c.doc_name.lower()),
            None
        )
        if matching_chunk and matching_chunk.doc_id not in seen:
            seen.add(matching_chunk.doc_id)
            citations.append({
                "doc_id": matching_chunk.doc_id,
                "filename": matching_chunk.doc_name,
                "page": page or matching_chunk.page_number,
                "section": matching_chunk.section,
                "excerpt": matching_chunk.content[:200] + "..." if len(matching_chunk.content) > 200 else matching_chunk.content,
            })

    # Pattern 2: Statute references — attach to any chunk from a matching document
    statute_pattern = re.compile(r'\[(RTA\s+s\.[\d\w\(\)]+|IRD:\s*\w+|TAA\s+s\.[\d\w]+)\]', re.IGNORECASE)
    for match in statute_pattern.finditer(response_text):
        ref = match.group(1)
        # Find a chunk that might contain this statute
        for chunk in chunks:
            if chunk.doc_id not in seen:
                seen.add(chunk.doc_id)
                citations.append({
                    "doc_id": chunk.doc_id,
                    "filename": chunk.doc_name,
                    "page": chunk.page_number,
                    "section": ref,
                    "excerpt": chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
                })
                break

    return citations


async def _build_conversation_messages(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    new_question: str,
    retrieved_context: str,
    system_prompt: str,
    max_history: int = 6,
) -> list[dict]:
    """
    Build the OpenAI-format message list for Ollama, including conversation history.
    Injects retrieved context only into the system prompt (not repeated per turn).
    """
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(max_history)
    )
    history = list(reversed(result.scalars().all()))

    messages = [{"role": "system", "content": system_prompt.format(context=retrieved_context)}]

    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": new_question})
    return messages


class RAGFlowOllamaPipeline:
    """
    Orchestrates the full query lifecycle:
    retrieve → prompt → stream → cite → log → store
    """

    def __init__(
        self,
        ollama: OllamaClient,
        ragflow: RAGFlowClient,
    ):
        self.ollama = ollama
        self.ragflow = ragflow

    async def query(
        self,
        db: AsyncSession,
        tenant: "Tenant",
        user: "User",
        conversation_id: uuid.UUID,
        question: str,
        model: str,
        doc_filter: Optional[list[str]] = None,
    ) -> AsyncGenerator[dict, None]:
        """
        Execute a full RAG query and stream results as SSE-ready dicts.

        Yields dicts of shape:
            {"type": "token",    "content": "..."}
            {"type": "citation", "citation": {...}}
            {"type": "done",     "message_id": "...", "stats": {...}}
            {"type": "error",    "detail": "..."}
        """
        t0 = time.monotonic()

        # 1. Retrieve context from RAGFlow if available
        chunks = []
        retrieval_failed = False
        if tenant.ragflow_dataset_id:
            try:
                chunks = await self.ragflow.retrieve(
                    dataset_id=tenant.ragflow_dataset_id,
                    query=question,
                    top_k=settings.ragflow_top_k,
                    doc_ids=doc_filter,
                )
            except Exception as e:
                log.warning("ragflow_retrieve_failed", error=str(e))
                retrieval_failed = True

        # 2. Build prompt
        context_str = _format_context(chunks)
        system_prompt = _select_system_prompt(str(tenant.id), question)

        messages = await _build_conversation_messages(
            db=db,
            conversation_id=conversation_id,
            new_question=question,
            retrieved_context=context_str,
            system_prompt=system_prompt,
        )

        # 3. Store user message (no flush — committed atomically with assistant msg at the end)
        user_msg = Message(
            conversation_id=conversation_id,
            tenant_id=tenant.id,
            role="user",
            content=question,
        )
        db.add(user_msg)

        # 4. Stream tokens from Ollama
        response_tokens: list[str] = []
        input_tokens = OllamaClient.estimate_tokens(
            " ".join(m["content"] for m in messages)
        )

        try:
            async for token in self.ollama.stream_chat(
                model=model,
                messages=messages,
                temperature=0.3,
            ):
                response_tokens.append(token)
                yield {"type": "token", "content": token}

        except Exception as e:
            log.error("ollama_stream_failed", model=model, error=str(e))
            # Roll back so the unflushed user_msg is not accidentally committed by get_db
            await db.rollback()
            yield {"type": "error", "detail": f"Model error: {str(e)}"}
            return

        full_response = "".join(response_tokens)
        output_tokens = OllamaClient.estimate_tokens(full_response)
        generation_ms = int((time.monotonic() - t0) * 1000)

        # 5. Extract citations
        citations = _extract_citations(full_response, chunks)
        for citation in citations:
            yield {"type": "citation", "citation": citation}

        # 6. Store assistant message
        assistant_msg = Message(
            conversation_id=conversation_id,
            tenant_id=tenant.id,
            role="assistant",
            content=full_response,
            model_used=model,
            citations=citations,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            generation_ms=generation_ms,
        )
        db.add(assistant_msg)

        # 7. Update conversation metadata
        await db.execute(
            update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(
                message_count=Conversation.message_count + 2,
                title=case((Conversation.message_count == 0, _generate_title(question)), else_=Conversation.title),
            )
        )

        # 8. Log usage for billing
        gpu_seconds = generation_ms / 1000.0 * 1.2  # Rough estimate with overhead
        usage = UsageLog(
            tenant_id=tenant.id,
            user_id=user.id,
            message_id=assistant_msg.id,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            gpu_seconds=gpu_seconds,
        )
        db.add(usage)
        await db.commit()

        yield {
            "type": "done",
            "message_id": str(assistant_msg.id),
            "stats": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "generation_ms": generation_ms,
                "chunks_retrieved": len(chunks),
                "model": model,
                "retrieval_failed": retrieval_failed,
            },
        }


def _generate_title(question: str, max_length: int = 60) -> str:
    """Generate a conversation title from the first question."""
    title = question.strip()
    if len(title) > max_length:
        title = title[:max_length].rsplit(" ", 1)[0] + "…"
    return title


# ── Singleton factory ──────────────────────────────────────────────────────────

def get_pipeline() -> RAGFlowOllamaPipeline:
    return RAGFlowOllamaPipeline(
        ollama=get_ollama_client(),
        ragflow=get_ragflow_client(),
    )
