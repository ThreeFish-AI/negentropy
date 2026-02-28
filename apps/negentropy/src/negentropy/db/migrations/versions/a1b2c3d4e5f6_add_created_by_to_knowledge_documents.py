"""add created_by to knowledge_documents

Revision ID: a1b2c3d4e5f6
Revises: f9a4b3c2d1e6
Create Date: 2026-02-28

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f9a4b3c2d1e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "knowledge_documents",
        sa.Column("created_by", sa.String(255), nullable=True),
        schema="negentropy",
    )


def downgrade() -> None:
    op.drop_column("knowledge_documents", "created_by", schema="negentropy")
