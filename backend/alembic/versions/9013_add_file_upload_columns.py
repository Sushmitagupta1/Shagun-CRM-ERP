"""add file upload columns

Revision ID: 9013
Revises: 9012
Create Date: 2026-07-30 14:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9013"
down_revision: Union[str, None] = "9012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("inquiries", sa.Column("menu_file_name", sa.String(255), nullable=True))
    op.add_column("inquiries", sa.Column("menu_file_path", sa.String(512), nullable=True))
    op.add_column("inquiries", sa.Column("presentation_file_name", sa.String(255), nullable=True))
    op.add_column("inquiries", sa.Column("presentation_file_path", sa.String(512), nullable=True))


def downgrade() -> None:
    op.drop_column("inquiries", "presentation_file_path")
    op.drop_column("inquiries", "presentation_file_name")
    op.drop_column("inquiries", "menu_file_path")
    op.drop_column("inquiries", "menu_file_name")
