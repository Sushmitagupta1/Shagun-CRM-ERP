"""add is_done to follow_ups

Revision ID: 9015
Revises: 9014
Create Date: 2026-08-03 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9015"
down_revision: Union[str, None] = "9014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("follow_ups", sa.Column("is_done", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("follow_ups", "is_done")
