import uuid
from decimal import Decimal
from sqlalchemy import String, Text, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class EventVendor(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "event_vendors"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    service_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    total_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid", nullable=False)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
