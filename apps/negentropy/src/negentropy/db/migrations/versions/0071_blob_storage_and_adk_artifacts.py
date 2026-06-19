"""blob_objects + adk_artifacts：GCS 退役后的本地 PostgreSQL 持久化基建

Revision ID: 0071
Revises: 0070
Create Date: 2026-06-20 00:00:00.000000+00:00

设计动机：
    GCS 退役（详见 GCS 退役迁移蓝图）。知识文档原文 / Markdown 衍生 / 提取
    图片资产 / MCP trial 资产统一以 ``bytea`` 持久化到 ``blob_objects``（以
    存储 key 为主键）；ADK agent 会话制品持久化到 ``adk_artifacts``。两表
    与业务表同库（pgvector 唯一数据存储哲学），消除对 GCS bucket 的依赖。

正交分解：
    本迁移仅新增两张存储基建表（纯加法，零回归）。业务表
    ``knowledge_documents`` / ``mcp_trial_assets`` 的 ``gcs_uri`` 列重命名与
    存量 URI scheme 改写由后续 0072 迁移与 ORM/调用方改动**原子**进行。

幂等性：
    ``create_table`` 配合 ``op`` 的 IF NOT EXISTS 语义由 Alembic 保证；
    downgrade 删表（IF EXISTS），本两表为新增、无外部依赖，可安全回滚。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "0071"
down_revision: str | None = "0070"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    # ---- blob_objects：以存储 key 为主键的 bytea 内容仓库 ----
    op.create_table(
        "blob_objects",
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=True),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("key"),
        schema=SCHEMA,
    )

    # ---- adk_artifacts：ADK ArtifactService 的版本化制品持久化 ----
    op.create_table(
        "adk_artifacts",
        sa.Column(
            "id",
            PG_UUID(as_uuid=True),
            server_default=sa.func.gen_random_uuid(),
            nullable=False,
        ),
        sa.Column("app_name", sa.String(length=255), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("session_id", sa.String(length=255), nullable=True),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=True),
        sa.Column("custom_metadata", JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        # session 作用域版本唯一；user 作用域（session_id IS NULL）受 PG NULL
        # 互异语义豁免，其唯一性由 _next_version 应用逻辑保证。
        sa.UniqueConstraint(
            "app_name",
            "user_id",
            "session_id",
            "filename",
            "version",
            name="uq_adk_artifacts_scope_version",
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_adk_artifacts_session_id",
        "adk_artifacts",
        ["session_id"],
        schema=SCHEMA,
    )
    op.create_index(
        "ix_adk_artifacts_user_app",
        "adk_artifacts",
        ["app_name", "user_id"],
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_index("ix_adk_artifacts_user_app", table_name="adk_artifacts", schema=SCHEMA)
    op.drop_index("ix_adk_artifacts_session_id", table_name="adk_artifacts", schema=SCHEMA)
    op.drop_table("adk_artifacts", schema=SCHEMA)
    op.drop_table("blob_objects", schema=SCHEMA)
