"""allow null email on users

Revision ID: 9028
Revises: 9027
Create Date: 2026-08-10 18:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9028"
down_revision: Union[str, None] = "9027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "email", existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    op.alter_column("users", "email", existing_type=sa.String(length=255), nullable=False)
