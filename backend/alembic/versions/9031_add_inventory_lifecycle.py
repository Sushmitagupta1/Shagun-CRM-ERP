"""add lalit inventory lifecycle (required qty, not received, breakage, transfer event, audit logs)

Revision ID: 9031
Revises: 9030
Create Date: 2026-08-14 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9031"
down_revision: Union[str, None] = "9030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("event_inventory_items", sa.Column("required_qty", sa.Float(), nullable=True))
    op.add_column("event_inventory_items", sa.Column("not_received_count", sa.Float(), nullable=True))
    op.add_column("event_inventory_items", sa.Column("breakage_count", sa.Float(), nullable=True))
    op.add_column("event_inventory_items", sa.Column("transfer_event", sa.String(length=255), nullable=True))

    op.create_table(
        "event_audit_logs",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("inquiry_id", sa.UUID(), sa.ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("item_name", sa.String(length=255), nullable=True),
        sa.Column("field_name", sa.String(length=50), nullable=True),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("event_audit_logs")
    op.drop_column("event_inventory_items", "transfer_event")
    op.drop_column("event_inventory_items", "breakage_count")
    op.drop_column("event_inventory_items", "not_received_count")
    op.drop_column("event_inventory_items", "required_qty")
