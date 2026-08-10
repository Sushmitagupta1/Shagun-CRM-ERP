from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import TimestampMixin


class CompanySettings(TimestampMixin, Base):
    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, default="Shagun Caterers")
    email: Mapped[str] = mapped_column(String(255), nullable=False, default="catering@cafeuppercrust.com")
    phone: Mapped[str] = mapped_column(String(50), nullable=False, default="+91 8980003121")
    gst: Mapped[str] = mapped_column(String(50), nullable=False, default="24AEOFS0061F1Z7")
    address: Mapped[str] = mapped_column(String(500), nullable=False, default="Parshwanath Business Park, 100 Feet Rd, Satellite, Prahlad Nagar")
    logo_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    logo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notifications: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
