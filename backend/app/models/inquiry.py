import uuid
import enum
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import String, Text, Integer, Numeric, ForeignKey, Enum, Date, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class InquiryStatus(str, enum.Enum):
    NEW_INQUIRY = "new_inquiry"
    FOLLOWUP = "followup"
    CLIENT_CONFIRMATION = "client_confirmation"
    MENU_SENT = "menu_sent"
    ADVANCE_RECEIVE = "advance_receive"
    OPERATION_HANDOVER = "operation_handover"
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
    per_plate_rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    add_on: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True, default=Decimal("0"))
    status: Mapped[InquiryStatus] = mapped_column(
        String(50), default=InquiryStatus.NEW_INQUIRY, nullable=False
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    menu_uploaded: Mapped[bool] = mapped_column(default=False, nullable=False)
    menu_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    menu_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    menu_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    presentation_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    presentation_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    advance_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.UNPAID, nullable=False
    )

    # Stage 2 fields (visible when status >= client_confirmation)
    method: Mapped[str | None] = mapped_column(String(100), nullable=True)
    method_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    advance_payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    remaining_payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    birthday_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    anniversary_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class FollowUp(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "follow_ups"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False
    )
    follow_up_date: Mapped[date] = mapped_column(Date, nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
