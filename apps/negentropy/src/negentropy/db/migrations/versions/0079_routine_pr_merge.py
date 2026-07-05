"""为 routines 新增 pr_merged / pr_merged_checked_at + PR 合并巡检部分索引。

Revision ID: 0079
Revises: 0078
Create Date: 2026-06-30 00:00:01.000000+00:00

设计动机：
    Routine 在 FINALIZE 创建 PR 后即置 ``succeeded``，但 PR 在 GitHub 被人工 Merge 后无机制
    回写。本迁移加两列（与 status 正交，不改状态机）：``pr_merged``（null=未知/未检测，
    true=已 merge，false=closed-without-merge 停检）+ ``pr_merged_checked_at``（节流水位线）。
    由 routine_inspector 心跳的 ``_sync_pr_merge_status`` pass 或手动 ``sync-pr`` 端点经
    ``gh pr view --json state,merged`` 回填，并在 Full View / 列表 / PR 抽屉三处渲染「Merged」。

    部分索引 ``ix_routines_pr_merge_due`` 仅覆盖「succeeded 且有 pr_url 且尚未确认为 merged」的
    行——即巡检 due 集，保持索引极小且命中 25s 心跳的查询前缀。

幂等性：
    加列 / 索引前以 information_schema 探测（仿 0075/0078）。纯加 nullable 列，不删数据、不回填
    （null=未知 对存量 succeeded routine 即正确语义）；回滚即 drop index + drop column（空列无数据风险）。

参考文献：
[1] 0075_routine_repository_id.py — information_schema 幂等加列范式。
[2] 0078_routine_event_agent_role.py — 同上（nullable 加列）。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0079"
down_revision: str | None = "0078"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = :s AND table_name = :t AND column_name = :c"
            ),
            {"s": SCHEMA, "t": table_name, "c": column_name},
        ).scalar()
    )


def _index_exists(bind, table_name: str, index_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text("SELECT 1 FROM pg_indexes WHERE schemaname = :s AND tablename = :t AND indexname = :i"),
            {"s": SCHEMA, "t": table_name, "i": index_name},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()
    if not _column_exists(bind, "routines", "pr_merged"):
        op.add_column(
            "routines",
            sa.Column(
                "pr_merged",
                sa.Boolean(),
                nullable=True,
                comment="PR 是否已 merge（null=未知/未检测；与 status 正交，不改状态机）",
            ),
            schema=SCHEMA,
        )
    if not _column_exists(bind, "routines", "pr_merged_checked_at"):
        op.add_column(
            "routines",
            sa.Column(
                "pr_merged_checked_at",
                sa.DateTime(timezone=True),
                nullable=True,
                comment="上次 gh pr view 检测时间；节流用（同一 routine 最小重查间隔）",
            ),
            schema=SCHEMA,
        )
    if not _index_exists(bind, "routines", "ix_routines_pr_merge_due"):
        op.create_index(
            "ix_routines_pr_merge_due",
            "routines",
            [sa.text("pr_merged_checked_at")],
            postgresql_where=sa.text(
                "status = 'succeeded' AND pr_url IS NOT NULL AND COALESCE(pr_merged, false) = false"
            ),
            schema=SCHEMA,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _index_exists(bind, "routines", "ix_routines_pr_merge_due"):
        op.drop_index("ix_routines_pr_merge_due", table_name="routines", schema=SCHEMA)
    if _column_exists(bind, "routines", "pr_merged_checked_at"):
        op.drop_column("routines", "pr_merged_checked_at", schema=SCHEMA)
    if _column_exists(bind, "routines", "pr_merged"):
        op.drop_column("routines", "pr_merged", schema=SCHEMA)
