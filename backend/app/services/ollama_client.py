"""
OllamaClient — async wrapper around the Ollama REST API.

Handles:
- Streaming token generation with backpressure
- GPU semaphore to prevent OOM on concurrent requests
- Model health checks and listing
- Token estimation for billing
- Retry logic on transient failures
"""
import asyncio
import json
import time
from typing import AsyncGenerator, Optional
from dataclasses import dataclass

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import get_settings

log = structlog.get_logger()
settings = get_settings()


@dataclass
class ModelInfo:
    name: str
    size_bytes: int
    parameter_count: Optional[str]
    quantization: Optional[str]
    modified_at: str


@dataclass
class GenerateResult:
    content: str
    input_tokens: int
    output_tokens: int
    duration_ms: int


class OllamaClient:
    """
    Async client for the Ollama local inference server.

    Usage:
        client = OllamaClient()
        async for token in client.stream_chat(model, messages):
            print(token, end="", flush=True)
    """

    def __init__(self):
        self.base_url = settings.ollama_host
        self.timeout = settings.ollama_timeout
        self._semaphore = asyncio.Semaphore(settings.ollama_max_concurrent)
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(connect=10.0, read=self.timeout, write=30.0, pool=5.0),
        )

    # ── Streaming chat (OpenAI-compatible message format) ──────────────────────

    async def stream_chat(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 0.3,
        max_tokens: Optional[int] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream tokens from Ollama /api/chat.
        Yields individual token strings as they arrive.
        Respects the GPU semaphore — callers may wait if server is busy.
        """
        async with self._semaphore:
            t0 = time.monotonic()
            payload = {
                "model": model,
                "messages": messages,
                "stream": True,
                "options": {
                    "temperature": temperature,
                    **({"num_predict": max_tokens} if max_tokens else {}),
                },
            }

            log.info("ollama_stream_start", model=model, message_count=len(messages))

            async with self._client.stream("POST", "/api/chat", json=payload) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    raise OllamaError(f"Ollama returned {response.status_code}: {body.decode()}")

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    token = data.get("message", {}).get("content", "")
                    if token:
                        yield token

                    if data.get("done"):
                        elapsed_ms = int((time.monotonic() - t0) * 1000)
                        log.info(
                            "ollama_stream_done",
                            model=model,
                            duration_ms=elapsed_ms,
                            prompt_tokens=data.get("prompt_eval_count", 0),
                            output_tokens=data.get("eval_count", 0),
                        )
                        break

    # ── Non-streaming generate (for internal use, summaries, titles) ───────────

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(httpx.TransportError),
    )
    async def generate(
        self,
        model: str,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 512,
    ) -> GenerateResult:
        """Non-streaming generation. Used for title generation, summaries, etc."""
        async with self._semaphore:
            t0 = time.monotonic()
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})

            payload = {
                "model": model,
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature, "num_predict": max_tokens},
            }

            r = await self._client.post("/api/chat", json=payload)
            r.raise_for_status()
            data = r.json()

            return GenerateResult(
                content=data["message"]["content"],
                input_tokens=data.get("prompt_eval_count", 0),
                output_tokens=data.get("eval_count", 0),
                duration_ms=int((time.monotonic() - t0) * 1000),
            )

    # ── Model management ───────────────────────────────────────────────────────

    async def list_models(self) -> list[ModelInfo]:
        """Return all models currently available on the Ollama server."""
        try:
            r = await self._client.get("/api/tags")
            r.raise_for_status()
            return [
                ModelInfo(
                    name=m["name"],
                    size_bytes=m.get("size", 0),
                    parameter_count=m.get("details", {}).get("parameter_size"),
                    quantization=m.get("details", {}).get("quantization_level"),
                    modified_at=m.get("modified_at", ""),
                )
                for m in r.json().get("models", [])
            ]
        except Exception as e:
            log.warning("ollama_list_models_failed", error=str(e))
            return []

    async def model_is_available(self, model_name: str) -> bool:
        """Check if a specific model is available on the Ollama server."""
        models = await self.list_models()
        available = {m.name for m in models}
        # Ollama stores models with tags e.g. "llama3.1:8b"
        return model_name in available

    async def pull_model(self, model_name: str) -> bool:
        """
        Pull a model from the Ollama registry.
        This can take minutes for large models — intended for admin use only.
        """
        try:
            async with self._client.stream("POST", "/api/pull", json={"name": model_name, "stream": True}) as r:
                async for line in r.aiter_lines():
                    if line:
                        data = json.loads(line)
                        log.info("ollama_pull_progress", model=model_name, status=data.get("status"))
                        if data.get("status") == "success":
                            return True
            return True
        except Exception as e:
            log.error("ollama_pull_failed", model=model_name, error=str(e))
            return False

    # ── Health ─────────────────────────────────────────────────────────────────

    async def health(self) -> tuple[bool, Optional[float]]:
        """Returns (is_healthy, latency_ms)."""
        try:
            t0 = time.monotonic()
            r = await self._client.get("/api/tags", timeout=5)
            ms = (time.monotonic() - t0) * 1000
            return r.status_code == 200, ms
        except Exception:
            return False, None

    # ── Token estimation (for billing) ─────────────────────────────────────────

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """
        Rough token count — 1 token ≈ 4 characters for English text.
        Good enough for billing estimates; actual count comes from Ollama's response.
        """
        return max(1, len(text) // 4)

    async def aclose(self):
        await self._client.aclose()


class OllamaError(Exception):
    pass


# ── Singleton ──────────────────────────────────────────────────────────────────
# FastAPI app creates this once at startup via dependency injection

_ollama_client: Optional[OllamaClient] = None


def get_ollama_client() -> OllamaClient:
    global _ollama_client
    if _ollama_client is None:
        _ollama_client = OllamaClient()
    return _ollama_client
