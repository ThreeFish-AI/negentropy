"""创建 repositories 表 —— GitHub 地址 + 本地仓库根路径 + 基线分支锚点资源（第 5 类 plugin）。

Revision ID: 0074
Revises: 0073
Create Date: 2026-06-26 00:00:00.000000+00:00

设计动机：
    把「引擎主机上已 clone 的本地仓库根路径 + GitHub 地址 + 基线分支」注册为可复用资源，
    供 Routine 下拉选择并派生隔离 worktree 的 cwd/baseline_branch（见 models/repository.py）。
    权限模型完全复用 plugin 体系（owner_id + visibility + is_system）。

幂等性：
    建表前以 information_schema 探测表存在性（仿 0054 范式），便于半失败重试。

枚举复用：
    visibility 列复用 0001 已建的 negentropy.pluginvisibility（create_type=False），
    **绝不**重建 enum 类型，否则报 "type already exists"。downgrade 亦不 DROP TYPE
    （该类型由 0001 拥有、被 mcp/skill/agent/builtin_tool 共用）。

参考文献：
[1] 0054_routine_worktree.py — information_schema 幂等 + schema 限定范式。
[2] 0036_builtin_tools_visibility_enum.py — 复用既有 pluginvisibility（create_type=False）范式。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0074"
down_revision: str | None = "0073"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def _table_exists(bind, table_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text("SELECT 1 FROM information_schema.tables WHERE table_schema = :s AND table_name = :t"),
            {"s": SCHEMA, "t": table_name},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()
    if _table_exists(bind, "repositories"):
        return

    # 复用 0001 已建的 enum；create_type=False 防重复 CREATE TYPE。
    plugin_visibility = postgresql.ENUM(
        "PRIVATE",
        "SHARED",
        "PUBLIC",
        name="pluginvisibility",
        schema=SCHEMA,
        create_type=False,
    )

    op.create_table(
        "repositories",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("owner_id", sa.String(length=255), nullable=False),
        sa.Column(
            "visibility",
            plugin_visibility,
            nullable=False,
            server_default=sa.text("'PRIVATE'::negentropy.pluginvisibility"),
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("github_url", sa.String(length=1024), nullable=False),
        sa.Column("local_path", sa.Text(), nullable=False),
        sa.Column("baseline_branch", sa.String(length=255), nullable=False),
        sa.Column("default_remote", sa.String(length=255), nullable=False, server_default="origin"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("config", postgresql.JSONB(), nullable=True, server_default=sa.text("'{}'::jsonb")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("name", name="repositories_name_unique"),
        schema=SCHEMA,
    )
    op.create_index("ix_repositories_owner", "repositories", ["owner_id"], schema=SCHEMA)
    op.create_index("ix_repositories_visibility", "repositories", ["visibility"], schema=SCHEMA)
    op.create_index("ix_repositories_is_system", "repositories", ["is_system"], schema=SCHEMA)


def downgrade() -> None:
    bind = op.get_bind()
    if not _table_exists(bind, "repositories"):
        return
    op.drop_index("ix_repositories_is_system", table_name="repositories", schema=SCHEMA)
    op.drop_index("ix_repositories_visibility", table_name="repositories", schema=SCHEMA)
    op.drop_index("ix_repositories_owner", table_name="repositories", schema=SCHEMA)
    op.drop_table("repositories", schema=SCHEMA)
    # 不 DROP TYPE pluginvisibility —— 它由 0001 拥有、被 mcp/skill/agent/builtin_tool 共用。
