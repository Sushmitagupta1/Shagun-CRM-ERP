import uuid
from sqlalchemy import String, Float, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class EventInventoryItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "event_inventory_items"
    __table_args__ = (UniqueConstraint("inquiry_id", "item_name", name="uq_event_inventory_item"),)

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    received_qty: Mapped[float | None] = mapped_column(Float, nullable=True)
    transfer_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    returned_qty: Mapped[float | None] = mapped_column(Float, nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    required_qty: Mapped[float | None] = mapped_column(Float, nullable=True)
    not_received_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    breakage_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    transfer_event: Mapped[str | None] = mapped_column(String(255), nullable=True)
