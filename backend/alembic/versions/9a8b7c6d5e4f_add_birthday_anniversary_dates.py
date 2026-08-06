"""add birthday_date and anniversary_date to inquiries

Revision ID: 9a8b7c6d5e4f
Revises: 8947
Create Date: 2026-07-29 12:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '9a8b7c6d5e4f'
down_revision: Union[str, None] = '8947'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('inquiries', sa.Column('birthday_date', sa.Date(), nullable=True))
    op.add_column('inquiries', sa.Column('anniversary_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('inquiries', 'anniversary_date')
    op.drop_column('inquiries', 'birthday_date')
