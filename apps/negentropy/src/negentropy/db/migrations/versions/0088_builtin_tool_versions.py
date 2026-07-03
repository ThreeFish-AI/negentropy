"""builtin_tools.active_version + builtin_tool_versions 快照表（builtin_tool_config 第四进化面）

Revision ID: 0088
Revises: 0087_runtime_canary_index
Create Date: 2026-07-03 00:00:00.000000+00:00

设计动机：
    综述 §7 meta-layer 第四面：``builtin_tool_config`` 进化（参数级——top_k / timeout / prompt 片段等）。
    复用 skill 的版本范式：``builtin_tool_versions`` 快照表（SemVer + JSONB snapshot）+
    ``builtin_tools.active_version`` 指针（区分「最新」与「已晋升」）。BuiltinTool 无 sync 覆写（仅 CRUD），
    免 Sync 守卫。运行时消费（工具读 active config）是后续接线——promote 已翻指针。

幂等性：ADD COLUMN / CREATE TABLE 前以 information_schema 探测存在性。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0088"
down_revision: str | None = "0087"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def _col_exists(bind, table: str, column: str) -> bool:
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = :s AND table_name = :t AND column_name = :c"
            ),
            {"s": SCHEMA, "t": table, "c": column},
        ).scalar()
    )


def _table_exists(bind, table: str) -> bool:
    return bool(
        bind.execute(
            sa.text("SELECT 1 FROM information_schema.tables WHERE table_schema = :s AND table_name = :t"),
            {"s": SCHEMA, "t": table},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()

    # 1) builtin_tools.active_version 指针
    if not _col_exists(bind, "builtin_tools", "active_version"):
        op.add_column(
            "builtin_tools",
            sa.Column("active_version", sa.String(length=50), nullable=True),
            schema=SCHEMA,
        )

    # 2) builtin_tool_versions 快照表（镜像 skill_versions）
    if not _table_exists(bind, "builtin_tool_versions"):
        op.create_table(
            "builtin_tool_versions",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "tool_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey(f"{SCHEMA}.builtin_tools.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("version", sa.String(length=50), nullable=False),
            sa.Column("snapshot", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
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
            schema=SCHEMA,
        )
        op.create_unique_constraint(
            "uq_builtin_tool_version", "builtin_tool_versions", ["tool_id", "version"], schema=SCHEMA
        )
        op.create_index("ix_builtin_tool_versions_tool_id", "builtin_tool_versions", ["tool_id"], schema=SCHEMA)


def downgrade() -> None:
    # 遵循 AGENTS.md「谨慎数据迁移回滚」：仅删本迁移引入的表/列。
    bind = op.get_bind()
    if _table_exists(bind, "builtin_tool_versions"):
        op.drop_index("ix_builtin_tool_versions_tool_id", table_name="builtin_tool_versions", schema=SCHEMA)
        op.drop_table("builtin_tool_versions", schema=SCHEMA)
    if _col_exists(bind, "builtin_tools", "active_version"):
        op.drop_column("builtin_tools", "active_version", schema=SCHEMA)
