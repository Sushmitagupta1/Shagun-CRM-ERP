"""add session/source columns and menu_slots table

Revision ID: 9025
Revises: 9024
Create Date: 2026-08-08 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9025"
down_revision: Union[str, None] = "9024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("inquiries", sa.Column("session", sa.String(length=100), nullable=True))
    op.add_column("inquiries", sa.Column("source", sa.String(length=255), nullable=True))
    op.create_table(
        "menu_slots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("inquiry_id", sa.Uuid(), nullable=False),
        sa.Column("slot_number", sa.Integer(), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=True),
        sa.Column("file_path", sa.String(512), nullable=True),
        sa.Column("is_final", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["inquiry_id"], ["inquiries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("menu_slots")
    op.drop_column("inquiries", "source")
    op.drop_column("inquiries", "session")
