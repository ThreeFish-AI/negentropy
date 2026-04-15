"""添加 vendor_configs 表

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-14 00:00:00.000000+00:00

新增供应商级凭证配置表，支持 OpenAI/Anthropic/Gemini 的统一 API Key 管理。
每个供应商最多一条记录 (vendor 自然主键)。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.create_table(
        "vendor_configs",
        sa.Column("vendor", sa.String(50), nullable=False),
        sa.Column("api_key", sa.Text(), nullable=False),
        sa.Column("api_base", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("vendor", name="pk_vendor_configs"),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_table("vendor_configs", schema=SCHEMA)
