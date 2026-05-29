"""Scheduler 任务定义迁移化种子 + is_system 列。

Revision ID: 0046
Revises: 0045
Create Date: 2026-05-29 00:00:00.000000+00:00

设计动机：
    将 ``registry.ensure_defaults()`` 中硬编码的 9 条系统种子任务迁入 Alembic
    data migration，实现 DB 驱动、UI 可配置的单一事实源闭环：

      1. 新增 ``scheduled_tasks.is_system`` 列（BOOLEAN NOT NULL DEFAULT false），
         标识系统种子任务，CRUD DELETE 时拒绝删除（409），引导用户改用 toggle 禁用；
         与 ``builtin_tools.is_system`` / ``agents.is_system`` 范式对齐。
      2. 9 条种子 INSERT ... ON CONFLICT (key) DO NOTHING 幂等写入：
         - 现有 DB（已通过 ensure_defaults 跑出 9 行）：key 冲突 → 全跳过，不覆盖用户编辑 ✅
         - 全新 DB：迁移负责 bootstrap 这 9 行 ✅

    此后 ``ensure_defaults()`` 的 defaults 列表可安全清空（保留空壳函数作为
    未来 runtime self-heal 挂载点），DB 成为任务实例的唯一事实源。
    Handler Manifest（能力定义）仍合法留在代码中。

JSONB 编码：
    沿用 0039 的 ``sa.bindparam(..., type_=JSONB)`` + Python dict 范式。

参考文献：
[1] 0039_seed_claude_code_builtin_tool.py — 幂等 JSONB seed 范式。
[2] 0033_plugin_is_system.py — is_system 列范式。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0046"
down_revision: str | None = "0045"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"
TABLE = f"{SCHEMA}.scheduled_tasks"

# 系统 seed 任务的 key 集合，供 DELETE 保护校验使用。
SEED_KEYS = frozenset(
    {
        "pipeline_watchdog",
        "session_title_inspect",
        "cache_warm",
        "pgvector_check",
        "agent_inspection_demo",
        "scheduled_tasks_summary_demo",
        "memory_cleanup",
        "memory_consolidation",
        "memory_reweight",
    }
)

# ---------------------------------------------------------------------------
# 种子定义：与 ensure_defaults() 的 defaults 列表平移，payload 用 Python dict
# ---------------------------------------------------------------------------

_SEEDS = [
    {
        "key": "pipeline_watchdog",
        "handler_kind": "pipeline_watchdog",
        "trigger_type": "interval",
        "interval_seconds": 60.0,
        "cron_expr": None,
        "role": "sentinel",
        "scenario": "kg_kb_maintenance",
        "category": "maintenance",
        "display_name": "KB/KG Pipeline Watchdog",
        "description": "收敛 cancelling/running 长尾状态的 KB/KG runs",
        "payload": {},
    },
    {
        "key": "session_title_inspect",
        "handler_kind": "session_title_inspect",
        "trigger_type": "interval",
        "interval_seconds": 300.0,
        "cron_expr": None,
        "role": "sentinel",
        "scenario": "session_quality",
        "category": "maintenance",
        "display_name": "Session Title Inspector",
        "description": "周期巡检 Session 标题，补齐与刷新",
        "payload": {},
    },
    {
        "key": "cache_warm",
        "handler_kind": "cache_warm",
        "trigger_type": "oneshot",
        "interval_seconds": None,
        "cron_expr": None,
        "role": "system",
        "scenario": "bootstrap",
        "category": "maintenance",
        "display_name": "Model Config Cache Warm",
        "description": "启动时预热 LLM/Embedding 配置缓存",
        "payload": {},
    },
    {
        "key": "pgvector_check",
        "handler_kind": "pgvector_check",
        "trigger_type": "oneshot",
        "interval_seconds": None,
        "cron_expr": None,
        "role": "system",
        "scenario": "bootstrap",
        "category": "maintenance",
        "display_name": "pgvector Extension Check",
        "description": "启动时检查 pgvector 扩展可用性",
        "payload": {},
    },
    {
        "key": "agent_inspection_demo",
        "handler_kind": "agent_inspection",
        "trigger_type": "interval",
        "interval_seconds": 300.0,
        "cron_expr": None,
        "role": "supervisor",
        "scenario": "agent_health",
        "category": "cognitive",
        "display_name": "Faculty Health Inspector",
        "description": "每 5min 检查 Faculties 五系部模块可用性",
        "payload": {"inspection_type": "faculty_health"},
        "token_budget": 100_000,
    },
    {
        "key": "scheduled_tasks_summary_demo",
        "handler_kind": "agent_inspection",
        "trigger_type": "interval",
        "interval_seconds": 600.0,
        "cron_expr": None,
        "role": "supervisor",
        "scenario": "scheduler_health",
        "category": "cognitive",
        "display_name": "Scheduled Tasks Summary",
        "description": "每 10min 巡检调度框架自身 last_status 分布（系统级告警）",
        "payload": {"inspection_type": "scheduled_tasks_summary"},
        "token_budget": 10_000,
    },
    {
        "key": "memory_cleanup",
        "handler_kind": "memory_automation",
        "trigger_type": "cron",
        "interval_seconds": None,
        "cron_expr": "0 2 * * *",
        "role": "sentinel",
        "scenario": "memory_retention",
        "category": "maintenance",
        "display_name": "Ebbinghaus Cleanup",
        "description": "基于艾宾浩斯遗忘曲线清理低价值记忆",
        "payload": {
            "job_type": "cleanup_memories",
            "threshold": 0.1,
            "min_age_days": 7,
            "decay_lambda": 0.1,
        },
    },
    {
        "key": "memory_consolidation",
        "handler_kind": "memory_automation",
        "trigger_type": "cron",
        "interval_seconds": None,
        "cron_expr": "0 * * * *",
        "role": "sentinel",
        "scenario": "memory_consolidation",
        "category": "maintenance",
        "display_name": "Maintenance Consolidation",
        "description": "按时间窗口批量触发会话巩固任务",
        "payload": {
            "job_type": "trigger_consolidation",
            "lookback_interval": "1 hour",
        },
    },
    {
        "key": "memory_reweight",
        "handler_kind": "memory_automation",
        "trigger_type": "cron",
        "interval_seconds": None,
        "cron_expr": "0 */6 * * *",
        "role": "sentinel",
        "scenario": "memory_relevance",
        "category": "maintenance",
        "display_name": "Rocchio Reweight",
        "description": "定期聚合用户反馈，调整记忆检索权重",
        "payload": {
            "job_type": "reweight_relevance",
        },
    },
]


def upgrade() -> None:
    # 1. 新增 is_system 列
    op.add_column(
        "scheduled_tasks",
        sa.Column(
            "is_system",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="系统种子任务标记：由迁移种子写入，不可通过 UI 删除",
        ),
        schema=SCHEMA,
    )

    # 2. 幂等 seed 9 条默认任务
    for spec in _SEEDS:
        bindparams = [
            sa.bindparam("key", value=spec["key"]),
            sa.bindparam("handler_kind", value=spec["handler_kind"]),
            sa.bindparam("trigger_type", value=spec["trigger_type"]),
            sa.bindparam("interval_seconds", value=spec.get("interval_seconds")),
            sa.bindparam("cron_expr", value=spec.get("cron_expr")),
            sa.bindparam("role", value=spec.get("role")),
            sa.bindparam("scenario", value=spec.get("scenario")),
            sa.bindparam("category", value=spec.get("category")),
            sa.bindparam("display_name", value=spec.get("display_name")),
            sa.bindparam("description", value=spec.get("description")),
            sa.bindparam("payload", value=spec.get("payload", {}), type_=sa.dialects.postgresql.JSONB),
            sa.bindparam("max_concurrency", value=1),
            sa.bindparam("token_budget", value=spec.get("token_budget")),
            sa.bindparam("enabled", value=True),
            sa.bindparam("is_system", value=True),
        ]
        op.execute(
            sa.text(
                f"""
                INSERT INTO {TABLE}
                    (key, handler_kind, trigger_type, interval_seconds, cron_expr,
                     role, scenario, category, display_name, description,
                     payload, max_concurrency, token_budget, enabled, is_system, next_fire_at)
                VALUES
                    (:key, :handler_kind, :trigger_type, :interval_seconds, :cron_expr,
                     :role, :scenario, :category, :display_name, :description,
                     :payload, :max_concurrency, :token_budget, :enabled, :is_system, NOW())
                ON CONFLICT (key) DO NOTHING
                """
            ).bindparams(*bindparams)
        )


def downgrade() -> None:
    # 遵循 AGENTS.md「谨慎数据迁移回滚」原则：downgrade 仅删列，
    # 不删除种子数据（避免误删运维已调整的配置）。
    # 若需完全清除，请走运维 data-fix 脚本。
    op.drop_column("scheduled_tasks", "is_system", schema=SCHEMA)
