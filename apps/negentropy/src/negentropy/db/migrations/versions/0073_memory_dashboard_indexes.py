"""Memory Overview Dashboard 查询加速索引 (app_name 前导复合 / 部分索引)

Revision ID: 0073
Revises: 0072
Create Date: 2026-06-26 00:00:00.000000+00:00

设计动机 (Index as the scale lever):
  Memory Overview 的 dashboard / metrics / health 端点
  (engine/api.py `/dashboard`、engine/observability/memory_metrics.py)
  反复以 `app_name`(可选 + `user_id`) 对下列表做聚合扫描，EXPLAIN ANALYZE
  确认全部为 Seq Scan：
    memories              — 每行携带 Vector(1536)≈6KB，Seq Scan 把 embedding 拖过 I/O
    facts                 — 现有 unique 以 user_id 前导，无法服务 app_name-only
    kg_entities           — WHERE app_name=? AND is_active IS TRUE (无 app_name 索引)
    memory_audit_logs     — app_name + created_at>=24h 窗口 (unique 第二列是 user_id)
    memory_retrieval_logs — app_name + created_at (现索引以 user_id 前导)

前导列法则 (leading-column rule):
  复合 (app_name, user_id) 经前导列同时服务 app_name-only 与 app_name+user_id，
  故无需另建 app_name 单列索引 (避免冗余 / 写放大)。现有以 user_id / corpus_id
  前导的索引对 app-scoped 谓词无效，这是新建索引的根因。

为何不加 covering / INCLUDE:
  index-only scan 需 visibility map 全可见；memories 写频高 (retention /
  importance 常更新)，页面少全可见 → 退回堆访问。主要收益 (整表 6KB Seq Scan →
  app 维度索引扫描) 已被普通 b-tree 捕获，INCLUDE 仅省去 app 子集上的少量堆
  访问而膨胀索引，当前不值得。

迁移安全 (CONCURRENTLY):
  Alembic 默认在事务内运行 (env.py begin_transaction)；CREATE INDEX
  CONCURRENTLY 不能在事务内执行。沿用 0010 的 ``autocommit_block`` 跳出事务，
  配合 0029 的 ``IF NOT EXISTS`` 幂等守卫，使大表建索引不阻塞写入且可重入
  (CONCURRENTLY 失败会留下 INVALID 索引，IF NOT EXISTS + 重跑可恢复)。
  ``autocommit_block`` 内语句不随后续失败回滚，但本迁移仅建索引且各自
  ``IF NOT EXISTS``，可安全重跑。

参考文献:
  [1] PostgreSQL Documentation, "Building Indexes Concurrently",
      "Partial Indexes", "Index-Only Scans and Covering Indexes".
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0073"
down_revision: str | None = "0072"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"

# (索引名, 建索引 ON 子句)。CONCURRENTLY + IF NOT EXISTS 在 autocommit_block 内执行。
_INDEXES: list[tuple[str, str]] = [
    ("ix_memories_app_user", f"ON {SCHEMA}.memories (app_name, user_id)"),
    ("ix_facts_app_user", f"ON {SCHEMA}.facts (app_name, user_id)"),
    # 谓词须与 memory_metrics.py 查询的 `is_active IS TRUE` 逐字匹配：PG 的部分索引
    # 谓词证明器不会把 `is_active IS TRUE`(BooleanTest) 蕴含为裸布尔 `is_active`，
    # 用 `WHERE is_active` 会导致该查询无法命中索引（已实测验证）。
    ("ix_kg_entities_app_active", f"ON {SCHEMA}.kg_entities (app_name) WHERE is_active IS TRUE"),
    ("ix_memory_audit_logs_app_created", f"ON {SCHEMA}.memory_audit_logs (app_name, created_at)"),
    ("ix_memory_retrieval_logs_app_created", f"ON {SCHEMA}.memory_retrieval_logs (app_name, created_at)"),
]


def upgrade() -> None:
    # CONCURRENTLY 必须在事务外执行（autocommit_block），沿用 0010 模式。
    with op.get_context().autocommit_block():
        for name, suffix in _INDEXES:
            op.execute(sa.text(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} {suffix}"))


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, _ in reversed(_INDEXES):
            op.execute(sa.text(f"DROP INDEX CONCURRENTLY IF EXISTS {SCHEMA}.{name}"))
