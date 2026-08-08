import uuid
from sqlalchemy import String, Integer, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class MenuSlot(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "menu_slots"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False
    )
    slot_number: Mapped[int] = mapped_column(Integer, nullable=False)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_final: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
