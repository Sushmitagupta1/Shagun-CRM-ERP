import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin


class EventAuditLog(UUIDMixin, Base):
    __tablename__ = "event_audit_logs"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    item_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    field_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
