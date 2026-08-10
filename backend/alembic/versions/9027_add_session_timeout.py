"""add session_timeout_minutes column to company_settings

Revision ID: 9027
Revises: 9026
Create Date: 2026-08-10 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9027"
down_revision: Union[str, None] = "9026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("company_settings", sa.Column("session_timeout_minutes", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("company_settings", "session_timeout_minutes")
