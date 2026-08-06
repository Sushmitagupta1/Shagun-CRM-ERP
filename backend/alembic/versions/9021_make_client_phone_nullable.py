"""make client_phone nullable on inquiries

Revision ID: 9021
Revises: 9020
Create Date: 2026-08-06 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9021"
down_revision: Union[str, None] = "9020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("inquiries", "client_phone", existing_type=sa.String(length=20), nullable=True)


def downgrade() -> None:
    op.alter_column("inquiries", "client_phone", existing_type=sa.String(length=20), nullable=False)
