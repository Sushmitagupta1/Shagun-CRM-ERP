"""add follow_ups table, drop follow_up_date and follow_up_history

Revision ID: 1234
Revises: 8947
Create Date: 2026-07-30 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "1234"
down_revision: Union[str, None] = "9a8b7c6d5e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "follow_ups",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("inquiry_id", sa.Uuid(), nullable=False),
        sa.Column("follow_up_date", sa.Date(), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["inquiry_id"], ["inquiries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, follow_up_date, created_by, created_at FROM inquiries WHERE follow_up_date IS NOT NULL")
    ).fetchall()
    import uuid
    for row in rows:
        conn.execute(
            sa.text(
                "INSERT INTO follow_ups (id, inquiry_id, follow_up_date, created_by, created_at, updated_at) "
                "VALUES (:id, :inquiry_id, :follow_up_date, :created_by, :created_at, :created_at)"
            ),
            {"id": uuid.uuid4(), "inquiry_id": row[0], "follow_up_date": row[1], "created_by": row[2], "created_at": row[3]},
        )

    op.drop_column("inquiries", "follow_up_date")
    op.drop_table("follow_up_history")


def downgrade() -> None:
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
    op.add_column("inquiries", sa.Column("follow_up_date", sa.Date(), nullable=True))
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT inquiry_id, follow_up_date FROM follow_ups")
    ).fetchall()
    for row in rows:
        conn.execute(
            sa.text("UPDATE inquiries SET follow_up_date = :d WHERE id = :id"),
            {"d": row[1], "id": row[0]},
        )
    op.drop_table("follow_ups")
