"""knowledge metadata->>'arxiv_id' 表达式索引 — 论文采集幂等去重加速

Revision ID: 0029
Revises: 0028
Create Date: 2026-05-05 12:00:00.000000+00:00

设计动机：
  Phase 2 闭环 paper hunter →（chunk 级）knowledge 表，``metadata->>'arxiv_id'`` 是
  ``ingest_paper`` 幂等去重的核心键。当 ``agent-papers`` Corpus 规模到 5k+ chunk 时，
  ``WHERE metadata->>'arxiv_id' = :v`` 全表扫描会变成 100ms 量级；此处加表达式 BTREE
  索引把查询压回 O(log n)。

为什么不是唯一索引：
  同一篇论文会切成多 chunk（每个 chunk 复制 ``metadata``），唯一约束会使 ingest 失败。
  幂等检测发生在 Python 层 ``_check_existing_arxiv``（apps/negentropy/src/negentropy/
  agents/tools/paper.py），DB 层只负责加速。

为什么用 ``metadata`` JSONB 而非加列：
  - ``Knowledge.metadata_`` 已是 JSONB，加列会污染所有非 paper 类 chunk；
  - 表达式索引为 ``WHERE metadata ? 'arxiv_id'`` 部分索引（partial），仅论文 chunk
    占用空间，零代价；
  - 与 ``perception.py search_knowledge_base`` 中已有的 metadata->>'archived' /
    'searchable' 表达式过滤一致（参见 retrieval/repository.py 末尾静态方法）。

参考文献：
  [1] PostgreSQL Documentation, "Indexes on Expressions" / "Partial Indexes"
  [2] D. Edge et al., "From Local to Global: A Graph RAG Approach," arXiv:2404.16130, 2024
      （论文规模化场景下幂等性的工程必要性）
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0029"
down_revision: str | None = "0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_INDEX_NAME = "ix_knowledge_arxiv_id"
_SCHEMA = "negentropy"
_TABLE = "knowledge"


def upgrade() -> None:
    bind = op.get_bind()
    exists = bind.execute(
        sa.text("SELECT 1 FROM pg_indexes WHERE schemaname = :schema AND indexname = :idx"),
        {"schema": _SCHEMA, "idx": _INDEX_NAME},
    ).scalar()
    if exists:
        return

    # 表达式 + 部分索引：仅当 metadata 含 arxiv_id 时建索引项
    op.execute(
        sa.text(
            f"""
            CREATE INDEX IF NOT EXISTS {_INDEX_NAME}
            ON {_SCHEMA}.{_TABLE} ((metadata->>'arxiv_id'))
            WHERE metadata ? 'arxiv_id'
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text(f"DROP INDEX IF EXISTS {_SCHEMA}.{_INDEX_NAME}"))
