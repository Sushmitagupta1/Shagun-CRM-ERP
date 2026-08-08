import uuid
from sqlalchemy import String, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class MenuVersion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "menu_versions"

    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    menu_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    designs: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    template_file: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
