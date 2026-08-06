import uuid
from sqlalchemy import String, Text, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class MenuTemplate(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "menu_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    dish_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    gradient: Mapped[str] = mapped_column(String(100), default="from-amber-600 to-orange-700", nullable=False)
    dishes: Mapped[dict | None] = mapped_column(JSON, nullable=True)
