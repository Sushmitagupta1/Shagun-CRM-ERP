"""add returned/transferred/wastage file columns to inquiries

Revision ID: 9018
Revises: 9017
Create Date: 2026-08-03 16:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9018"
down_revision: Union[str, None] = "9017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("inquiries", sa.Column("returned_file_name", sa.String(length=255), nullable=True))
    op.add_column("inquiries", sa.Column("returned_file_path", sa.String(length=512), nullable=True))
    op.add_column("inquiries", sa.Column("transferred_file_name", sa.String(length=255), nullable=True))
    op.add_column("inquiries", sa.Column("transferred_file_path", sa.String(length=512), nullable=True))
    op.add_column("inquiries", sa.Column("wastage_file_name", sa.String(length=255), nullable=True))
    op.add_column("inquiries", sa.Column("wastage_file_path", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("inquiries", "wastage_file_path")
    op.drop_column("inquiries", "wastage_file_name")
    op.drop_column("inquiries", "transferred_file_path")
    op.drop_column("inquiries", "transferred_file_name")
    op.drop_column("inquiries", "returned_file_path")
    op.drop_column("inquiries", "returned_file_name")
