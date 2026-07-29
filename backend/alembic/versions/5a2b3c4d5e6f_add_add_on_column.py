"""Add add_on column to inquiries

Revision ID: 5a2b3c4d5e6f
Revises: 4e8f2a1b3c7d
Create Date: 2026-07-27
"""
from alembic import op
import sqlalchemy as sa

revision = '5a2b3c4d5e6f'
down_revision = '4e8f2a1b3c7d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('inquiries', sa.Column('add_on', sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('inquiries', 'add_on')
