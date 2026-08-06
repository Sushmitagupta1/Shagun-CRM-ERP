"""add menu_content field

Revision ID: 9012
Revises: 5678
Create Date: 2026-07-30 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9012"
down_revision: Union[str, None] = "5678"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("inquiries", sa.Column("menu_content", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("inquiries", "menu_content")
