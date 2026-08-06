"""add venue and call recording columns to inquiries

Revision ID: 9020
Revises: 9019
Create Date: 2026-08-06 09:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9020"
down_revision: Union[str, None] = "9019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("inquiries", sa.Column("venue", sa.String(length=255), nullable=True))
    op.add_column("inquiries", sa.Column("call_recording_file_name", sa.String(length=255), nullable=True))
    op.add_column("inquiries", sa.Column("call_recording_file_path", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("inquiries", "call_recording_file_path")
    op.drop_column("inquiries", "call_recording_file_name")
    op.drop_column("inquiries", "venue")
