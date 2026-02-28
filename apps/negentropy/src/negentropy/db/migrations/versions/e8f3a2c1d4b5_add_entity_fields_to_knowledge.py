"""add entity_type and entity_confidence to knowledge

Revision ID: e8f3a2c1d4b5
Revises: b27f9a648bbd
Create Date: 2026-02-15

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "e8f3a2c1d4b5"
down_revision: Union[str, None] = "b27f9a648bbd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 添加 entity_type 列
    op.add_column(
        "knowledge",
        sa.Column("entity_type", sa.String(50), nullable=True),
        schema="negentropy",
    )

    # 添加 entity_confidence 列
    op.add_column(
        "knowledge",
        sa.Column("entity_confidence", sa.Float(), nullable=True),
        schema="negentropy",
    )

    # 添加索引 (部分索引，只索引非 NULL 值)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_kb_entity_type
        ON negentropy.knowledge(entity_type)
        WHERE entity_type IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_index("idx_kb_entity_type", table_name="knowledge", schema="negentropy")
    op.drop_column("knowledge", "entity_confidence", schema="negentropy")
    op.drop_column("knowledge", "entity_type", schema="negentropy")
