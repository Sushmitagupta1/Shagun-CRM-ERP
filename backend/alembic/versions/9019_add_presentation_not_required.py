"""add presentation_not_required column to inquiries

Revision ID: 9019
Revises: 9018
Create Date: 2026-08-05 07:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9019"
down_revision: Union[str, None] = "9018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "inquiries",
        sa.Column("presentation_not_required", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("inquiries", "presentation_not_required")
