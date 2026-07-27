"""add inquiry_date to inquiries

Revision ID: 3f7a1b2c4d5e
Revises: 083338246a66
Create Date: 2026-07-27 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f7a1b2c4d5e'
down_revision: Union[str, None] = '083338246a66'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('inquiries', sa.Column('inquiry_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('inquiries', 'inquiry_date')
