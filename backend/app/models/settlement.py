import uuid
import enum
from decimal import Decimal
from sqlalchemy import String, Text, Numeric, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class SettlementStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"


class Settlement(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "settlements"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id"), unique=True, nullable=False
    )
    revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    vendor_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    other_expenses: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    net_profit: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    status: Mapped[SettlementStatus] = mapped_column(
        Enum(SettlementStatus), default=SettlementStatus.PENDING, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
