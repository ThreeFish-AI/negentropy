"""knowledge_documents 新增 PDF 巡检态列 + 从 memories 回填存量状态

Revision ID: 0092
Revises: 0091
Create Date: 2026-07-08 00:00:00.000000+00:00

设计动机：
    「PDF Fidelity Patrol」文档级巡检状态（``done|unfixable``）原存 ``memories`` 表
    ``metadata`` JSONB（``tag=pdf-fidelity-status``），仅 1 个生产读者（巡检 selector 的
    ``get_skip_doc_ids``），且 Memory 受衰减治理可被清理——状态并非与文档生命周期绑定的
    持久事实。新增 ``knowledge_documents`` 物理列作为权威源（SSOT），获得：

    1. 4 态机（含 ``NULL``=未巡检 / ``in_progress``=巡检中），而 Memory 仅 ``done|unfixable``；
    2. 索引化查询（selector / 列表展示）；
    3. 与文档生命周期一致的可见性（Documents 列表「巡检状态」列 + 拟合分数）；
    4. 解锁「重置已拟合→未拟合」二次巡检 API（清除列 + 取消终态 Routine）。

    写入路径（spawn→in_progress / 终态→done|unfixable / cancelled→回退 NULL）见
    ``engine/schedulers/handlers/pdf_fidelity_patrol.py`` 与 ``engine/routine/patrol_memory.py``。
    详见 [docs/.agents/pdf-fidelity-patrol-status.md](../../../../../docs/.agents/pdf-fidelity-patrol-status.md)。

幂等性：
    ``ADD COLUMN IF NOT EXISTS`` / ``CREATE INDEX IF NOT EXISTS``；回填 ``UPDATE`` 带
    ``kd.patrol_status IS NULL`` 守卫，重跑安全（不覆盖已由巡检新写入的态）。

数据保全（downgrade 红线）：
    patrol 态可由重跑巡检确定性再生（终态 Routine 经 ``_finalize_terminal_patrols`` 重沉淀），
    故 downgrade ``DROP COLUMN`` 可接受——**不回写回 memories**（dual-write 期 memories 仍保留
    ``TAG_STATUS`` 副本；Phase 2 deprecate 后亦无读者）。

References:
[1] 0076_seed_pdf_fidelity_patrol_task.py — 巡检系统任务种子。
[2] 0091_pdf_fidelity_patrol_interval_600s.py — 巡检节奏 600s。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0092"
down_revision: str | None = "0091"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"
TABLE = f"{SCHEMA}.knowledge_documents"

# 巡检态列定义（与模型 perception.py:KnowledgeDocument 对齐）。
_ADD_COLUMNS_SQL = f"""
    ALTER TABLE {TABLE}
        ADD COLUMN IF NOT EXISTS patrol_status VARCHAR(20),
        ADD COLUMN IF NOT EXISTS patrol_score INTEGER,
        ADD COLUMN IF NOT EXISTS patrol_routine_id UUID
            REFERENCES {SCHEMA}.routines(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS patrol_updated_at TIMESTAMPTZ
"""

# 从 memories 回填存量 done/unfixable（含 score/routine_id），按 doc 取最新一条 status 记忆。
# score/routine_id 经 NULLIF 守卫：JSON null → ->> 为 NULL → NULLIF 安全；routine_id 另加 uuid
# 正则守卫防脏数据 cast 失败阻断迁移。
_BACKFILL_SQL = f"""
    UPDATE {TABLE} AS kd
    SET patrol_status     = m.meta->>'status',
        patrol_score      = NULLIF(m.meta->>'score', '')::int,
        patrol_routine_id = CASE
            WHEN m.meta->>'routine_id'
                 ~ '^[0-9a-fA-F]{{8}}-[0-9a-fA-F]{{4}}-[0-9a-fA-F]{{4}}-[0-9a-fA-F]{{4}}-[0-9a-fA-F]{{12}}$'
            THEN (m.meta->>'routine_id')::uuid
        END,
        patrol_updated_at = NOW()
    FROM (
        SELECT DISTINCT ON (metadata->>'doc_id')
               metadata           AS meta,
               metadata->>'doc_id' AS doc_id
        FROM {SCHEMA}.memories
        WHERE user_id = 'system'
          AND metadata->>'tag' = 'pdf-fidelity-status'
          AND metadata->>'doc_id' IS NOT NULL
          AND metadata->>'status' IN ('done', 'unfixable')
        ORDER BY metadata->>'doc_id', created_at DESC
    ) AS m
    WHERE kd.id::text = m.doc_id
      AND kd.patrol_status IS NULL
"""

_CREATE_INDEX_SQL = f"CREATE INDEX IF NOT EXISTS ix_knowledge_documents_patrol_status ON {TABLE} (patrol_status)"

_DROP_INDEX_SQL = f"DROP INDEX IF EXISTS {SCHEMA}.ix_knowledge_documents_patrol_status"

_DROP_COLUMNS_SQL = f"""
    ALTER TABLE {TABLE}
        DROP COLUMN IF EXISTS patrol_updated_at,
        DROP COLUMN IF EXISTS patrol_routine_id,
        DROP COLUMN IF EXISTS patrol_score,
        DROP COLUMN IF EXISTS patrol_status
"""


def upgrade() -> None:
    op.execute(sa.text(_ADD_COLUMNS_SQL))
    op.execute(sa.text(_BACKFILL_SQL))
    op.execute(sa.text(_CREATE_INDEX_SQL))


def downgrade() -> None:
    # 红线：patrol 态可由重跑巡检再生；不回写 memories。DROP 仅删本迁移新增列。
    op.execute(sa.text(_DROP_INDEX_SQL))
    op.execute(sa.text(_DROP_COLUMNS_SQL))
