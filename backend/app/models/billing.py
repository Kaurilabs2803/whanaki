import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Text, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class BillingEvent(Base):
    __tablename__ = "billing_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"))
    stripe_event_id: Mapped[Optional[str]] = mapped_column(Text, unique=True)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    amount_cents: Mapped[Optional[int]] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(Text, default="nzd")
    event_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
