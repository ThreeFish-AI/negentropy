"""add updated_at to memories

Revision ID: bd9c65e1bf99
Revises: 457c6b429a6a
Create Date: 2026-02-09 08:30:11.236600+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
# Register custom types (e.g. Vector) for Alembic autogenerate
import negentropy.models.base


# revision identifiers, used by Alembic.
revision: str = 'bd9c65e1bf99'
down_revision: Union[str, None] = '457c6b429a6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('memories', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False), schema='negentropy')


def downgrade() -> None:
    op.drop_column('memories', 'updated_at', schema='negentropy')
