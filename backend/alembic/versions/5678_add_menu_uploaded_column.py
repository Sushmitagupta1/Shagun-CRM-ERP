"""add menu_uploaded column to inquiries

Revision ID: 5678
Revises: 1234
Create Date: 2026-07-30 11:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "5678"
down_revision: Union[str, None] = "1234"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("inquiries", sa.Column("menu_uploaded", sa.Boolean(), nullable=False, server_default=sa.text("false")))


def downgrade() -> None:
    op.drop_column("inquiries", "menu_uploaded")
