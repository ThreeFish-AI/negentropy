"""add model_configs table

Revision ID: g1h2i3j4k5l6
Revises: e6f7a8b9c0d1
Create Date: 2026-03-24 00:00:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

import negentropy.models.base

# revision identifiers, used by Alembic.
revision: str = "g1h2i3j4k5l6"
down_revision: Union[str, None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    schema = negentropy.models.base.NEGENTROPY_SCHEMA

    # 创建 model_type_enum 类型
    model_type_enum = postgresql.ENUM("llm", "embedding", "rerank", name="model_type_enum", schema=schema)
    model_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "model_configs",
        sa.Column(
            "model_type",
            sa.Enum("llm", "embedding", "rerank", name="model_type_enum", schema=schema),
            nullable=False,
        ),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("vendor", sa.String(length=50), nullable=False),
        sa.Column("model_name", sa.String(length=255), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("vendor", "model_name", "model_type", name="model_configs_vendor_model_type_unique"),
        schema=schema,
    )

    # 部分唯一索引: 每种 model_type 最多一个 default
    op.create_index(
        "ix_model_configs_default_unique",
        "model_configs",
        ["model_type"],
        unique=True,
        schema=schema,
        postgresql_where=sa.text("is_default = true"),
    )

    # Seed 默认数据
    model_configs = sa.table(
        "model_configs",
        sa.column("model_type", sa.String),
        sa.column("display_name", sa.String),
        sa.column("vendor", sa.String),
        sa.column("model_name", sa.String),
        sa.column("is_default", sa.Boolean),
        sa.column("enabled", sa.Boolean),
        sa.column("config", postgresql.JSONB),
        schema=schema,
    )
    op.bulk_insert(
        model_configs,
        [
            {
                "model_type": "llm",
                "display_name": "GLM-5 (智谱)",
                "vendor": "zai",
                "model_name": "glm-5",
                "is_default": True,
                "enabled": True,
                "config": {"temperature": 0.7},
            },
            {
                "model_type": "embedding",
                "display_name": "Text Embedding 005 (Vertex AI)",
                "vendor": "vertex_ai",
                "model_name": "text-embedding-005",
                "is_default": True,
                "enabled": True,
                "config": {},
            },
        ],
    )


def downgrade() -> None:
    schema = negentropy.models.base.NEGENTROPY_SCHEMA

    op.drop_index("ix_model_configs_default_unique", table_name="model_configs", schema=schema)
    op.drop_table("model_configs", schema=schema)

    # 删除 enum 类型
    model_type_enum = postgresql.ENUM("llm", "embedding", "rerank", name="model_type_enum", schema=schema)
    model_type_enum.drop(op.get_bind(), checkfirst=True)
