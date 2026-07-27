"""Rename budget to per_plate_rate

Revision ID: 4e8f2a1b3c7d
Revises: 3f7a1b2c4d5e
Create Date: 2026-07-27
"""
from alembic import op
import sqlalchemy as sa

revision = '4e8f2a1b3c7d'
down_revision = '3f7a1b2c4d5e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('inquiries', 'budget', new_column_name='per_plate_rate')


def downgrade() -> None:
    op.alter_column('inquiries', 'per_plate_rate', new_column_name='budget')
