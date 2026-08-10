"""add notifications JSON column to company_settings

Revision ID: 9026
Revises: 9025
Create Date: 2026-08-10 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9026"
down_revision: Union[str, None] = "9025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("company_settings", sa.Column("notifications", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("company_settings", "notifications")
