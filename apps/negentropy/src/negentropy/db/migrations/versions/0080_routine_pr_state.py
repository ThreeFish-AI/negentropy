"""为 routines 新增 pr_state（open|closed|merged）+ 调整 PR 巡检部分索引谓词。

Revision ID: 0080
Revises: 0079
Create Date: 2026-06-30 00:00:02.000000+00:00

设计动机：
    0079 仅持久化 ``pr_merged``（bool），gh 返回的 ``state``（OPEN/CLOSED/MERGED）被丢弃——
    致 Open 与 Closed-without-merge 坍缩为同一个 ``pr_merged=False``，UI 无法区分（Closed 的 PR
    在抽屉仍显示「在 GitHub 合并」入口，具误导性）。本迁移加 ``pr_state`` 权威状态列，使 UI 能对
    Merged/Closed 对等打标；并据此调整 due 集：Open（可能后续合并）继续复检，Merged/Closed 终态排除
    （顺带修掉 Closed 每 5min 复检的浪费）。

    ``pr_merged``（bool）保留为派生反规范化（= ``pr_state=='merged'``），与既有 best_score/last_score
    反规范化同范式，使既有 merged 查询/UI 字段零侵入。

幂等性：
    加列 / 索引前以 information_schema / pg_indexes 探测（仿 0079）。纯加 nullable 列 + 回填
    ``pr_merged=true → pr_state='merged'``（无损；``pr_merged=false`` 行 open/closed 不可区分，
    留 NULL 由下个节流窗口 gh 重定）；索引谓词变更须 drop+recreate。

参考文献：
[1] 0079_routine_pr_merge.py — information_schema 幂等加列 + 部分索引范式。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0080"
down_revision: str | None = "0079"
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
    if not _column_exists(bind, "routines", "pr_state"):
        op.add_column(
            "routines",
            sa.Column(
                "pr_state",
                sa.String(length=16),
                nullable=True,
                comment="PR 状态 open|closed|merged（null=未知/未检测；与 status 正交）",
            ),
            schema=SCHEMA,
        )
    # 回填：已确认 merged 的行无损标注；pr_merged=false 行 open/closed 不可区分，留 NULL 待 gh 重定。
    op.execute(
        sa.text("UPDATE negentropy.routines SET pr_state = 'merged' WHERE pr_state IS NULL AND pr_merged = true")
    )
    # 索引谓词从「pr_merged 未确认 True」改为「pr_state 未达终态（NULL 或 open）」——
    # Open 仍可后续合并故复检，Merged/Closed 终态排除。drop+recreate（谓词变更）。
    if _index_exists(bind, "routines", "ix_routines_pr_merge_due"):
        op.drop_index("ix_routines_pr_merge_due", table_name="routines", schema=SCHEMA)
    if not _index_exists(bind, "routines", "ix_routines_pr_merge_due"):
        op.create_index(
            "ix_routines_pr_merge_due",
            "routines",
            [sa.text("pr_merged_checked_at")],
            postgresql_where=sa.text(
                "status = 'succeeded' AND pr_url IS NOT NULL AND (pr_state IS NULL OR pr_state = 'open')"
            ),
            schema=SCHEMA,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _index_exists(bind, "routines", "ix_routines_pr_merge_due"):
        op.drop_index("ix_routines_pr_merge_due", table_name="routines", schema=SCHEMA)
    # 回滚到 0079 旧谓词（COALESCE(pr_merged,false)=false）。downgrade 丢失 0080 写入的 open/closed 区分，可接受。
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
    if _column_exists(bind, "routines", "pr_state"):
        op.drop_column("routines", "pr_state", schema=SCHEMA)
