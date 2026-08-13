"""add operations db tables (inventory versions, event inventory, vendors, kitchen inventory)

Revision ID: 9029
Revises: 9028
Create Date: 2026-08-13 09:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9029"
down_revision: Union[str, None] = "9028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("inquiries", sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("inquiries", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("inquiries", sa.Column("vendor_file_name", sa.String(length=255), nullable=True))
    op.add_column("inquiries", sa.Column("vendor_file_path", sa.String(length=512), nullable=True))
    op.add_column("inquiries", sa.Column("kitchen_inventory_file_name", sa.String(length=255), nullable=True))
    op.add_column("inquiries", sa.Column("kitchen_inventory_file_path", sa.String(length=512), nullable=True))

    op.create_table(
        "inventory_file_versions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("movement_type", sa.String(length=50), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=512), nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False),
        sa.Column("uploaded_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("inquiry_id", "movement_type", "version_no", name="uq_inventory_file_version"),
    )

    op.create_table(
        "event_inventory_items",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_name", sa.String(length=255), nullable=False),
        sa.Column("received_qty", sa.Float(), nullable=True),
        sa.Column("transfer_count", sa.Float(), nullable=True),
        sa.Column("returned_qty", sa.Float(), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("inquiry_id", "item_name", name="uq_event_inventory_item"),
    )

    op.create_table(
        "event_vendors",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("vendor_name", sa.String(length=255), nullable=False),
        sa.Column("service_name", sa.String(length=255), nullable=True),
        sa.Column("rate", sa.Numeric(12, 2), nullable=True),
        sa.Column("total_cost", sa.Numeric(12, 2), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "kitchen_inventory_items",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_name", sa.String(length=255), nullable=False),
        sa.Column("prepared_qty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=50), nullable=True),
        sa.Column("used_qty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("remaining_qty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("kitchen_inventory_items")
    op.drop_table("event_vendors")
    op.drop_table("event_inventory_items")
    op.drop_table("inventory_file_versions")
    op.drop_column("inquiries", "kitchen_inventory_file_path")
    op.drop_column("inquiries", "kitchen_inventory_file_name")
    op.drop_column("inquiries", "vendor_file_path")
    op.drop_column("inquiries", "vendor_file_name")
    op.drop_column("inquiries", "completed_at")
    op.drop_column("inquiries", "is_completed")
