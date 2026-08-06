"""add stage 2 fields and follow_up_history table

Revision ID: 8947
Revises: 5a2b3c4d5e6f
Create Date: 2026-07-29 15:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "8947"
down_revision: Union[str, None] = "5a2b3c4d5e6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "follow_up_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("inquiry_id", sa.Uuid(), nullable=False),
        sa.Column("old_date", sa.Date(), nullable=True),
        sa.Column("new_date", sa.Date(), nullable=False),
        sa.Column("changed_by", sa.Uuid(), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["inquiry_id"], ["inquiries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.add_column("inquiries", sa.Column("method", sa.String(100), nullable=True))
    op.add_column("inquiries", sa.Column("method_details", sa.Text(), nullable=True))
    op.add_column("inquiries", sa.Column("advance_payment_date", sa.Date(), nullable=True))
    op.add_column("inquiries", sa.Column("remaining_payment_date", sa.Date(), nullable=True))

    op.execute("ALTER TABLE inquiries ALTER COLUMN status TYPE VARCHAR(50)")


def downgrade() -> None:
    op.drop_column("inquiries", "remaining_payment_date")
    op.drop_column("inquiries", "advance_payment_date")
    op.drop_column("inquiries", "method_details")
    op.drop_column("inquiries", "method")
    op.drop_table("follow_up_history")
