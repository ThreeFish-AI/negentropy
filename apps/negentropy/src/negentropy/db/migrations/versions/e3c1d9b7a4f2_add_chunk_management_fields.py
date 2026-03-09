"""add chunk management fields

Revision ID: e3c1d9b7a4f2
Revises: e5f6a7b8c9d0
Create Date: 2026-03-09 19:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "e3c1d9b7a4f2"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "knowledge",
        sa.Column("character_count", sa.Integer(), nullable=False, server_default="0"),
        schema="negentropy",
    )
    op.add_column(
        "knowledge",
        sa.Column("retrieval_count", sa.Integer(), nullable=False, server_default="0"),
        schema="negentropy",
    )
    op.add_column(
        "knowledge",
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        schema="negentropy",
    )


def downgrade() -> None:
    op.drop_column("knowledge", "is_enabled", schema="negentropy")
    op.drop_column("knowledge", "retrieval_count", schema="negentropy")
    op.drop_column("knowledge", "character_count", schema="negentropy")
