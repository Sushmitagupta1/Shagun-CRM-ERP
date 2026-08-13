"""add lalit operations enhancements (warehouse requests, event photos, vendor payment, transfer target)

Revision ID: 9030
Revises: 9029
Create Date: 2026-08-13 15:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9030"
down_revision: Union[str, None] = "9029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("event_vendors", sa.Column("payment_status", sa.String(length=20), nullable=False, server_default="unpaid"))
    op.add_column("inventory_movements", sa.Column("to_inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id"), nullable=True))

    op.create_table(
        "warehouse_requests",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_name", sa.String(length=255), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("requested_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("issued_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("received_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "event_photos",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=512), nullable=False),
        sa.Column("uploaded_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("event_photos")
    op.drop_table("warehouse_requests")
    op.drop_column("inventory_movements", "to_inquiry_id")
    op.drop_column("event_vendors", "payment_status")
