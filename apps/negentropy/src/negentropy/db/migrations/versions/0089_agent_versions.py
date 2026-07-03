"""agents.active_version + agent_versions 快照表（agent_prompt 第六进化面 + ADR-3 Sync改造）

Revision ID: 0089
Revises: 0088_builtin_tool_versions
Create Date: 2026-07-03 00:00:00.000000+00:00

设计动机：
    综述 §7 meta-layer 第六面：``agent_prompt`` 进化（Faculty agent system_prompt）。
    ADR-3 Sync 障碍的解法：``sync_negentropy_agents`` 继续覆写 ``agents.system_prompt``（代码基线），
    但 ``_load_subagent_row`` 在 ``active_version`` 非 NULL 时改读 ``agent_versions`` 快照——
    进化版本不受 sync 覆写影响（设计文档 §5.2 + ADR-3）。

幂等性：ADD COLUMN / CREATE TABLE 前以 information_schema 探测存在性。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0089"
down_revision: str | None = "0088"
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

    if not _col_exists(bind, "agents", "active_version"):
        op.add_column(
            "agents",
            sa.Column("active_version", sa.String(length=50), nullable=True),
            schema=SCHEMA,
        )

    if not _table_exists(bind, "agent_versions"):
        op.create_table(
            "agent_versions",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "agent_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey(f"{SCHEMA}.agents.id", ondelete="CASCADE"),
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
        op.create_unique_constraint("uq_agent_version", "agent_versions", ["agent_id", "version"], schema=SCHEMA)
        op.create_index("ix_agent_versions_agent_id", "agent_versions", ["agent_id"], schema=SCHEMA)


def downgrade() -> None:
    bind = op.get_bind()
    if _table_exists(bind, "agent_versions"):
        op.drop_index("ix_agent_versions_agent_id", table_name="agent_versions", schema=SCHEMA)
        op.drop_table("agent_versions", schema=SCHEMA)
    if _col_exists(bind, "agents", "active_version"):
        op.drop_column("agents", "active_version", schema=SCHEMA)
