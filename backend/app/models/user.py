import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Boolean, ForeignKey, Enum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class RoleName(str, enum.Enum):
    ADMIN = "admin"
    SALES_HEAD = "sales_head"
    MENU_PLANNER = "menu_planner"
    PRESENTATION_EXEC = "presentation_exec"
    OPERATIONS_MANAGER = "operations_manager"
    KITCHEN = "kitchen"
    WAREHOUSE = "warehouse"
    FINANCE = "finance"


class Role(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    permissions: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    users: Mapped[list["User"]] = relationship(back_populates="role")


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    username: Mapped[str | None] = mapped_column(String(100), unique=True, index=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    role: Mapped["Role"] = relationship(back_populates="users")
