"""add company_settings table

Revision ID: 9023
Revises: 9022
Create Date: 2026-08-07 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9023"
down_revision: Union[str, None] = "9022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "company_settings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=False),
        sa.Column("gst", sa.String(length=50), nullable=False),
        sa.Column("address", sa.String(length=500), nullable=False),
        sa.Column("logo_file_name", sa.String(length=255), nullable=True),
        sa.Column("logo_path", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute("""
        INSERT INTO company_settings (id, name, email, phone, gst, address, created_at, updated_at)
        VALUES (1, 'Shagun Caterers', 'catering@cafeuppercrust.com', '+91 8980003121',
                '24AEOFS0061F1Z7',
                'Parshwanath Business Park, 100 Feet Rd, Satellite, Prahlad Nagar',
                now(), now())
    """)


def downgrade() -> None:
    op.drop_table("company_settings")
