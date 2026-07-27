import uuid
import enum
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import String, Text, Integer, Numeric, ForeignKey, Enum, Date
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class InquiryStatus(str, enum.Enum):
    NEW = "new"
    FOLLOW_UP = "follow_up"
    MENU_READY = "menu_ready"
    PRESENTATION_SENT = "presentation_sent"
    NEGOTIATION = "negotiation"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class PaymentStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"


class Inquiry(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "inquiries"

    client_name: Mapped[str] = mapped_column(String(200), nullable=False)
    client_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    inquiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    pax: Mapped[int | None] = mapped_column(Integer, nullable=True)
    budget: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[InquiryStatus] = mapped_column(
        Enum(InquiryStatus), default=InquiryStatus.NEW, nullable=False
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    advance_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.UNPAID, nullable=False
    )
