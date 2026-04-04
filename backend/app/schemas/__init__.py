"""
Pydantic v2 schemas for API request/response validation.
"""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, EmailStr, field_validator

from app.models import TenantPlan, TenantStatus, UserRole, DocumentStatus, ModelSpeed


# ── Tenant ─────────────────────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    name: str
    slug: str

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        import re
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("Slug must be lowercase alphanumeric with hyphens")
        return v


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    primary_color: Optional[str] = None


class TenantResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan: TenantPlan
    status: TenantStatus
    monthly_query_limit: int
    ragflow_dataset_id: Optional[str]
    logo_url: Optional[str]
    primary_color: str
    trial_ends_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── User ───────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    clerk_id: str
    tenant_id: uuid.UUID
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole = UserRole.viewer


class UserResponse(BaseModel):
    id: uuid.UUID
    clerk_id: str
    tenant_id: uuid.UUID
    email: str
    full_name: Optional[str]
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Onboarding ─────────────────────────────────────────────────────────────────

class OnboardRequest(BaseModel):
    """First-time signup: creates tenant + user in one call."""
    organisation_name: str
    slug: str
    full_name: str

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        import re
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("Slug must be lowercase alphanumeric with hyphens")
        return v


class OnboardResponse(BaseModel):
    user: UserResponse
    tenant: TenantResponse


# ── Document ───────────────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: uuid.UUID
    filename: str
    original_filename: str
    content_type: str
    size_bytes: int
    page_count: Optional[int]
    status: DocumentStatus
    error_message: Optional[str]
    tags: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Conversation ───────────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    default_model: str = "llama3.1:8b"
    document_filter: Optional[list[uuid.UUID]] = None


class ConversationResponse(BaseModel):
    id: uuid.UUID
    title: Optional[str]
    default_model: str
    message_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Chat ───────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    model: str = "llama3.1:8b"
    conversation_id: Optional[uuid.UUID] = None   # None = start new conversation
    document_filter: Optional[list[uuid.UUID]] = None
    stream: bool = True


class CitationSchema(BaseModel):
    doc_id: uuid.UUID
    filename: str
    page: Optional[int]
    section: Optional[str]
    excerpt: str


class MessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    model_used: Optional[str]
    citations: list[CitationSchema]
    input_tokens: Optional[int]
    output_tokens: Optional[int]
    generation_ms: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Models ─────────────────────────────────────────────────────────────────────

class ModelResponse(BaseModel):
    model_id: str
    display_name: str
    description: Optional[str]
    speed: ModelSpeed
    is_active: bool
    is_default: bool
    parameter_count: Optional[str]
    context_length: Optional[int]

    model_config = {"from_attributes": True}


# ── Usage ──────────────────────────────────────────────────────────────────────

class UsageSummary(BaseModel):
    month: str                    # "2025-01"
    query_count: int
    queries_included: int
    queries_remaining: int
    total_input_tokens: int
    total_output_tokens: int
    model_breakdown: dict[str, int]


# ── Health ─────────────────────────────────────────────────────────────────────

class ServiceHealth(BaseModel):
    status: str                   # "ok" | "degraded" | "down"
    latency_ms: Optional[float] = None
    detail: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    services: dict[str, ServiceHealth]
    version: str = "1.0.0"
