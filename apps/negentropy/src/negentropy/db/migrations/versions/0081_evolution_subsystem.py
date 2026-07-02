"""自进化子系统第一切片：evolution_proposals + memory_config_versions + retrieval_logs 分桶列

Revision ID: 0081
Revises: 0080_routine_pr_state
Create Date: 2026-07-02 00:00:00.000000+00:00

设计动机：
    四层自进化架构（docs/concepts/design/self-evolving-agents.md）第一切片——记忆检索权重
    （semantic/keyword hybrid）面的 propose→shadow_eval→canary→promote/rollback 全闭环。
    本迁移建两张表 + 给 memory_retrieval_logs 加 config_version/strategy 两列（shadow eval
    按配置版本分桶对比的地基）+ seed evolution_inspector scheduled_task（默认禁用，灰度门控）。

    表定义 1:1 对齐 ORM 模型 ``models/evolution.py``，避免 autogenerate 漂移。

幂等性：
    建表/加列/建索引前以 information_schema 探测存在性（仿 0035/0044），便于半失败重试。
    seed 行用 ``WHERE NOT EXISTS`` 守卫幂等。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0081"
# 接续 0080；若工作区已含其它 0081+，alembic 会报多头，届时由合并者改 down_revision。
down_revision: str | None = "0080"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


# =============================================================================
# 辅助：information_schema 存在性探测
# =============================================================================


def _table_exists(bind, table_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(f"SELECT 1 FROM information_schema.tables WHERE table_schema = '{SCHEMA}' AND table_name = :n"),
            {"n": table_name},
        ).scalar()
    )


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                f"WHERE table_schema = '{SCHEMA}' AND table_name = :t AND column_name = :c"
            ),
            {"t": table_name, "c": column_name},
        ).scalar()
    )


def _index_exists(bind, index_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(f"SELECT 1 FROM pg_indexes WHERE schemaname = '{SCHEMA}' AND indexname = :n"),
            {"n": index_name},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()

    # -------------------------------------------------------------------------
    # 1) memory_config_versions（记忆配置版本表，retrieval 面专用）
    # -------------------------------------------------------------------------
    if not _table_exists(bind, "memory_config_versions"):
        op.create_table(
            "memory_config_versions",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("config_scope", sa.String(length=64), nullable=False),
            sa.Column("version", sa.String(length=50), nullable=False),
            sa.Column("snapshot", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("origin", sa.String(length=32), nullable=False),
            sa.Column(
                "is_active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
            sa.Column("rationale", sa.Text(), nullable=True),
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
            "uq_memory_config_scope_version",
            "memory_config_versions",
            ["config_scope", "version"],
            schema=SCHEMA,
        )
        op.create_index(
            "ix_memory_config_versions_scope",
            "memory_config_versions",
            ["config_scope"],
            schema=SCHEMA,
        )

    # seed 基线 v0.1.0（与 memory_service._DEFAULT_SEMANTIC_WEIGHT/_DEFAULT_KEYWORD_WEIGHT 逐字节对齐）
    # 注：JSON 快照经 JSONB bindparam 传入，避免 sa.text() 把字面量里的 ':0.7' 误解析为 bind 参数。
    bind.execute(
        sa.text(
            f"""
            INSERT INTO {SCHEMA}.memory_config_versions
                (id, config_scope, version, snapshot, origin, is_active, rationale, created_at, updated_at)
            SELECT gen_random_uuid(), :scope, :ver, :snapshot, :origin, TRUE, :rationale, NOW(), NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM {SCHEMA}.memory_config_versions
                WHERE config_scope = :scope AND version = :ver
            )
            """
        ).bindparams(
            sa.bindparam("scope", value="retrieval"),
            sa.bindparam("ver", value="0.1.0"),
            sa.bindparam(
                "snapshot",
                value={"semantic_weight": 0.7, "keyword_weight": 0.3},
                type_=postgresql.JSONB(),
            ),
            sa.bindparam("origin", value="code_sync"),
            sa.bindparam(
                "rationale",
                value="基线：与 memory_service._DEFAULT_*_WEIGHT 代码常量逐字节对齐（v0.1.0 冻结点）",
            ),
        )
    )

    # is_active 单一性部分唯一索引（建表后单独建，便于 EXISTS 探测）
    if not _index_exists(bind, "uq_memory_config_active"):
        op.create_index(
            "uq_memory_config_active",
            "memory_config_versions",
            ["config_scope"],
            schema=SCHEMA,
            unique=True,
            postgresql_where=sa.text("is_active = TRUE"),
        )

    # -------------------------------------------------------------------------
    # 2) evolution_proposals（统一登记簿）
    # -------------------------------------------------------------------------
    if not _table_exists(bind, "evolution_proposals"):
        op.create_table(
            "evolution_proposals",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("target_kind", sa.String(length=64), nullable=False),
            sa.Column("target_ref", sa.String(length=128), nullable=False),
            sa.Column("base_version", sa.String(length=50), nullable=False),
            sa.Column("proposed_version", sa.String(length=50), nullable=False),
            sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("origin", sa.String(length=32), nullable=False),
            sa.Column("rationale", sa.Text(), nullable=True),
            sa.Column("evidence", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column(
                "status",
                sa.String(length=32),
                nullable=False,
                server_default=sa.text("'draft'"),
            ),
            sa.Column("shadow_eval_result", postgresql.JSONB(), nullable=True),
            sa.Column("canary_config", postgresql.JSONB(), nullable=True),
            sa.Column("canary_metrics", postgresql.JSONB(), nullable=True),
            sa.Column(
                "risk_level",
                sa.String(length=16),
                nullable=False,
                server_default=sa.text("'medium'"),
            ),
            sa.Column("decided_by", sa.String(length=255), nullable=True),
            sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
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
        op.create_index(
            "ix_evolution_proposals_target_status",
            "evolution_proposals",
            ["target_kind", "status"],
            schema=SCHEMA,
        )
        op.create_index(
            "ix_evolution_proposals_target_ref",
            "evolution_proposals",
            ["target_ref"],
            schema=SCHEMA,
        )

    # 单在途部分唯一索引：每 target_ref 至多一个非终态提案
    if not _index_exists(bind, "uq_evolution_proposals_one_inflight"):
        op.create_index(
            "uq_evolution_proposals_one_inflight",
            "evolution_proposals",
            ["target_ref"],
            schema=SCHEMA,
            unique=True,
            postgresql_where=sa.text("status IN ('draft','shadow_eval','pending_approval','canary')"),
        )

    # -------------------------------------------------------------------------
    # 3) memory_retrieval_logs 加 config_version / strategy 列（shadow eval 分桶地基）
    # -------------------------------------------------------------------------
    if not _column_exists(bind, "memory_retrieval_logs", "config_version"):
        op.add_column(
            "memory_retrieval_logs",
            sa.Column("config_version", sa.String(length=50), nullable=True),
            schema=SCHEMA,
        )
    if not _column_exists(bind, "memory_retrieval_logs", "strategy"):
        op.add_column(
            "memory_retrieval_logs",
            sa.Column(
                "strategy",
                sa.String(length=32),
                nullable=True,
                comment="hybrid|vector|keyword|ilike；按策略分桶（可选）",
            ),
            schema=SCHEMA,
        )

    # -------------------------------------------------------------------------
    # 4) seed evolution_inspector scheduled_task（默认禁用，灰度门控 settings.evolution.enabled）
    # -------------------------------------------------------------------------
    bind.execute(
        sa.text(
            f"""
            INSERT INTO {SCHEMA}.scheduled_tasks
                (key, handler_kind, trigger_type, interval_seconds, cron_expr,
                 role, scenario, category, display_name, description,
                 payload, max_concurrency, token_budget, enabled, is_system, next_fire_at)
            SELECT 'evolution_inspector', 'evolution_inspector', 'interval', 300, NULL,
                   'supervisor', 'evolution', 'cognitive',
                   :display_name, :description,
                   :payload, 1, NULL, FALSE, TRUE, NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM {SCHEMA}.scheduled_tasks WHERE key = 'evolution_inspector'
            )
            """
        ).bindparams(
            sa.bindparam("display_name", value="Evolution Inspector（GEPA 进化提案器心跳）"),
            sa.bindparam(
                "description",
                value="每 300s tick：推进提案状态机 + spawn proposer。灰度门控 evolution.enabled。",
            ),
            sa.bindparam("payload", value={}, type_=postgresql.JSONB()),
        )
    )


def downgrade() -> None:
    # 遵循 AGENTS.md「谨慎数据迁移回滚」：仅删本迁移引入的表/列/种子，不动记忆数据。
    bind = op.get_bind()

    bind.execute(
        sa.text(f"DELETE FROM {SCHEMA}.scheduled_tasks WHERE key = 'evolution_inspector' AND is_system = TRUE")
    )

    if _column_exists(bind, "memory_retrieval_logs", "strategy"):
        op.drop_column("memory_retrieval_logs", "strategy", schema=SCHEMA)
    if _column_exists(bind, "memory_retrieval_logs", "config_version"):
        op.drop_column("memory_retrieval_logs", "config_version", schema=SCHEMA)

    if _index_exists(bind, "uq_evolution_proposals_one_inflight"):
        op.drop_index("uq_evolution_proposals_one_inflight", table_name="evolution_proposals", schema=SCHEMA)
    if _table_exists(bind, "evolution_proposals"):
        op.drop_index("ix_evolution_proposals_target_ref", table_name="evolution_proposals", schema=SCHEMA)
        op.drop_index("ix_evolution_proposals_target_status", table_name="evolution_proposals", schema=SCHEMA)
        op.drop_table("evolution_proposals", schema=SCHEMA)

    if _index_exists(bind, "uq_memory_config_active"):
        op.drop_index("uq_memory_config_active", table_name="memory_config_versions", schema=SCHEMA)
    if _table_exists(bind, "memory_config_versions"):
        op.drop_index("ix_memory_config_versions_scope", table_name="memory_config_versions", schema=SCHEMA)
        op.drop_table("memory_config_versions", schema=SCHEMA)
