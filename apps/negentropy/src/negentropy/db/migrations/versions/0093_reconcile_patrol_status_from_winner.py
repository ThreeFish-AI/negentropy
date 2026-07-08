"""reconcile：以「每 doc 最新的非 cancelled 终态 Routine」校正存量 patrol_status 列

Revision ID: 0093
Revises: 0092
Create Date: 2026-07-08 12:00:00.000000+00:00

设计动机：
    0092 把文档级巡检态从 ``memories`` 迁到 ``knowledge_documents.patrol_status`` 列并从 Memory 回填。
    但回填源（Memory ``TAG_STATUS``）本身受 ``_finalize_terminal_patrols`` 的 last-write-wins +
    ``_collapse_superseded_patrols`` 不回写状态缺陷污染：一个先以 ``failed`` 终态写入 ``unfixable``、
    随后被 collapse 取消的 Routine，会把更早 ``succeeded`` 的 ``done`` 覆盖成 ``unfixable``
    （实测：succeeded/95 被 failed/2 覆盖）。回填把这条陈旧 Memory 落到了列。

    本迁移以**权威源 = routines 表**重算列：每 doc 取最新的**非 cancelled**（succeeded/failed）
    终态 Routine（cancelled = 被取代/放弃，非真实结论），按 ``created_at DESC`` 取最新，
    ``succeeded`` 或 ``best_score ≥ 95`` → ``done``，否则 ``unfixable``。与
    ``engine/schedulers/handlers/pdf_fidelity_patrol.py::_reconcile_patrol_status`` 同语义
    （后者每 tick 持续校正；阈值默认 95 = ``patrol_qualified_score_threshold``）。

幂等性：
    纯 ``UPDATE``，重跑只会把列收敛到同一终态；带「跳过 running/paused Routine 的 doc」守卫，
    不回退 spawn 写的 in_progress。``patrol_status``/``patrol_routine_id`` 已与 winner 一致时不动。

数据保全（downgrade 红线）：
    patrol 态可由重跑巡检确定性再生（终态 Routine 经 ``_finalize_terminal_patrols`` +
    ``_reconcile_patrol_status`` 重沉淀），故 downgrade 为 no-op（校正后数据正确，无意义回退）。

References:
[1] 0092_pdf_fidelity_patrol_status_column.py — 列与首次（受污染）回填。
[2] engine/schedulers/handlers/pdf_fidelity_patrol.py::_reconcile_patrol_status — 持续校正。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0093"
down_revision: str | None = "0092"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"

# 阈值默认 95（config.routine.patrol_qualified_score_threshold）；迁移为确定性快照，硬编码默认值。
_THRESHOLD = 95

_RECONCILE_SQL = f"""
    WITH winner AS (
        SELECT DISTINCT ON (r.config->>'doc_id')
               r.config->>'doc_id' AS doc_id,
               r.id AS rid,
               r.status,
               r.best_score,
               CASE WHEN r.status = 'succeeded' OR r.best_score >= {_THRESHOLD}
                    THEN 'done' ELSE 'unfixable' END AS new_status
        FROM {SCHEMA}.routines r
        WHERE r.config->>'patrol' = 'true'
          AND r.status IN ('succeeded', 'failed')
          AND r.config->>'doc_id' IS NOT NULL
        ORDER BY r.config->>'doc_id', r.created_at DESC
    )
    UPDATE {SCHEMA}.knowledge_documents kd
    SET patrol_status = w.new_status,
        patrol_score = w.best_score,
        patrol_routine_id = w.rid,
        patrol_updated_at = NOW()
    FROM winner w
    WHERE kd.id::text = w.doc_id
      AND NOT EXISTS (
          SELECT 1 FROM {SCHEMA}.routines rr
          WHERE rr.config->>'patrol' = 'true'
            AND rr.config->>'doc_id' = kd.id::text
            AND rr.status IN ('running', 'paused')
      )
      AND (kd.patrol_status IS DISTINCT FROM w.new_status
           OR kd.patrol_routine_id IS DISTINCT FROM w.rid)
"""


def upgrade() -> None:
    op.execute(sa.text(_RECONCILE_SQL))


def downgrade() -> None:
    # 红线：patrol 态可由重跑巡检 + _reconcile_patrol_status 确定性再生；校正后数据正确，无意义回退。
    pass
