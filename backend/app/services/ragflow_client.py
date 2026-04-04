"""
RAGFlowClient — async wrapper around the RAGFlow REST API.

Handles:
- Dataset (knowledge base) creation per tenant
- Document upload and ingest triggering
- Hybrid search (vector + keyword) for retrieval
- Ingest status polling
"""
import asyncio
from typing import Optional
from dataclasses import dataclass, field

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings

log = structlog.get_logger()
settings = get_settings()


@dataclass
class RetrievedChunk:
    """A single retrieved document chunk from RAGFlow."""
    chunk_id: str
    doc_id: str
    doc_name: str
    content: str
    score: float
    page_number: Optional[int] = None
    section: Optional[str] = None


@dataclass
class IngestStatus:
    doc_id: str
    status: str          # "pending" | "processing" | "done" | "failed"
    progress: float      # 0.0 – 1.0
    error: Optional[str] = None


class RAGFlowClient:
    """
    Async client for RAGFlow.

    Each tenant gets their own RAGFlow dataset (knowledge base) identified
    by ragflow_dataset_id stored on the Tenant record.
    """

    def __init__(self):
        self.base_url = settings.ragflow_host.rstrip("/")
        self.api_key = settings.ragflow_api_key
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            timeout=60.0,
        )

    # ── Dataset management (one per tenant) ────────────────────────────────────

    async def create_dataset(self, tenant_id: str, name: str) -> str:
        """
        Create a RAGFlow dataset for a tenant.
        Returns the dataset ID to store on the Tenant record.
        """
        payload = {
            "name": f"whanaki_{tenant_id[:8]}_{name}",
            "language": "English",
            "embedding_model": "nomic-embed-text",
            "chunk_method": "naive",       # Works well for legal docs
            "parser_config": {
                "chunk_token_count": 512,
                "layout_recognize": True,  # PDF layout preservation
                "delimiter": "\n!?;。；！？",
            },
        }
        r = await self._client.post("/v1/datasets", json=payload)
        r.raise_for_status()
        data = r.json()
        dataset_id = data["data"]["id"]
        log.info("ragflow_dataset_created", tenant_id=tenant_id, dataset_id=dataset_id)
        return dataset_id

    async def get_dataset(self, dataset_id: str) -> Optional[dict]:
        """Fetch dataset metadata."""
        try:
            r = await self._client.get(f"/v1/datasets/{dataset_id}")
            r.raise_for_status()
            return r.json().get("data")
        except Exception:
            return None

    # ── Document ingest ────────────────────────────────────────────────────────

    async def upload_document(
        self,
        dataset_id: str,
        filename: str,
        file_bytes: bytes,
        content_type: str,
    ) -> str:
        """
        Upload a document to a RAGFlow dataset.
        Returns the RAGFlow document ID.
        """
        files = {"file": (filename, file_bytes, content_type)}
        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with httpx.AsyncClient(base_url=self.base_url, timeout=120.0) as client:
            r = await client.post(
                f"/v1/datasets/{dataset_id}/documents",
                files=files,
                headers=headers,
            )

        r.raise_for_status()
        data = r.json()
        doc_id = data["data"][0]["id"]
        log.info("ragflow_doc_uploaded", dataset_id=dataset_id, doc_id=doc_id, filename=filename)
        return doc_id

    async def start_ingest(self, dataset_id: str, doc_ids: list[str]) -> bool:
        """Trigger chunking + embedding for uploaded documents."""
        r = await self._client.post(
            f"/v1/datasets/{dataset_id}/chunks",
            json={"document_ids": doc_ids},
        )
        r.raise_for_status()
        log.info("ragflow_ingest_started", dataset_id=dataset_id, doc_count=len(doc_ids))
        return True

    async def get_ingest_status(self, dataset_id: str, doc_id: str) -> IngestStatus:
        """Poll ingest progress for a document."""
        try:
            r = await self._client.get(f"/v1/datasets/{dataset_id}/documents/{doc_id}")
            r.raise_for_status()
            data = r.json().get("data", {})
            run_status = data.get("run", "pending")

            status_map = {
                "0": "pending",
                "1": "processing",
                "2": "done",
                "3": "failed",
                "PENDING": "pending",
                "RUNNING": "processing",
                "DONE": "done",
                "FAIL": "failed",
            }

            return IngestStatus(
                doc_id=doc_id,
                status=status_map.get(str(run_status), "pending"),
                progress=data.get("progress", 0.0),
                error=data.get("progress_msg") if run_status in ("3", "FAIL") else None,
            )
        except Exception as e:
            return IngestStatus(doc_id=doc_id, status="failed", progress=0.0, error=str(e))

    async def wait_for_ingest(
        self,
        dataset_id: str,
        doc_id: str,
        timeout_seconds: int = 300,
        poll_interval: int = 3,
    ) -> IngestStatus:
        """
        Poll until ingest completes or times out.
        Used by background task after document upload.
        """
        start = asyncio.get_event_loop().time()
        while True:
            status = await self.get_ingest_status(dataset_id, doc_id)
            if status.status in ("done", "failed"):
                return status
            if asyncio.get_event_loop().time() - start > timeout_seconds:
                return IngestStatus(doc_id=doc_id, status="failed", progress=0.0, error="Ingest timed out")
            await asyncio.sleep(poll_interval)

    async def delete_document(self, dataset_id: str, doc_id: str) -> bool:
        """Remove a document and its chunks from RAGFlow."""
        try:
            r = await self._client.delete(
                f"/v1/datasets/{dataset_id}/documents",
                json={"ids": [doc_id]},
            )
            return r.status_code in (200, 204)
        except Exception as e:
            log.error("ragflow_delete_failed", doc_id=doc_id, error=str(e))
            return False

    # ── Retrieval ──────────────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=5))
    async def retrieve(
        self,
        dataset_id: str,
        query: str,
        top_k: int = 5,
        doc_ids: Optional[list[str]] = None,
        similarity_threshold: float = 0.2,
    ) -> list[RetrievedChunk]:
        """
        Hybrid vector + keyword retrieval from a tenant's dataset.

        Args:
            dataset_id: The tenant's RAGFlow dataset ID.
            query: The user's question.
            top_k: Number of chunks to retrieve.
            doc_ids: If set, restrict retrieval to these specific documents.
            similarity_threshold: Minimum similarity score (0.0–1.0).

        Returns:
            List of RetrievedChunk, sorted by relevance score descending.
        """
        payload = {
            "question": query,
            "dataset_ids": [dataset_id],
            "top_k": top_k,
            "similarity_threshold": similarity_threshold,
            "vector_similarity_weight": 0.3,   # Balance keyword vs vector
            "highlight": False,
        }

        if doc_ids:
            payload["document_ids"] = doc_ids

        r = await self._client.post("/v1/retrieval", json=payload)
        r.raise_for_status()
        data = r.json()

        chunks = []
        for item in data.get("data", {}).get("chunks", []):
            chunks.append(RetrievedChunk(
                chunk_id=item.get("id", ""),
                doc_id=item.get("document_id", ""),
                doc_name=item.get("document_keyword", item.get("docnm_kwd", "Unknown")),
                content=item.get("content_with_weight", item.get("content", "")),
                score=float(item.get("similarity", item.get("vector_similarity", 0.0))),
                page_number=item.get("position_int", [None])[0] if item.get("position_int") else None,
                section=item.get("section", None),
            ))

        log.info(
            "ragflow_retrieve",
            dataset_id=dataset_id,
            query_len=len(query),
            chunks_returned=len(chunks),
        )
        return chunks

    # ── Health ─────────────────────────────────────────────────────────────────

    async def health(self) -> tuple[bool, Optional[float]]:
        import time
        try:
            t0 = time.monotonic()
            r = await self._client.get("/v1/health", timeout=5)
            ms = (time.monotonic() - t0) * 1000
            return r.status_code == 200, ms
        except Exception:
            return False, None

    async def aclose(self):
        await self._client.aclose()


# ── Singleton ──────────────────────────────────────────────────────────────────

_ragflow_client: Optional[RAGFlowClient] = None


def get_ragflow_client() -> RAGFlowClient:
    global _ragflow_client
    if _ragflow_client is None:
        _ragflow_client = RAGFlowClient()
    return _ragflow_client
