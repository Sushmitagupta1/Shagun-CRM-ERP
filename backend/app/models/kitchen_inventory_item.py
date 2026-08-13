import uuid
from sqlalchemy import String, Float, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class KitchenInventoryItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "kitchen_inventory_items"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    prepared_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    used_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    remaining_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
