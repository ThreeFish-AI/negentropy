"""eval_suites / eval_cases / eval_runs / eval_results 四表（离线评测基座）

Revision ID: 0083
Revises: 0082_tool_telemetry
Create Date: 2026-07-02 00:00:00.000000+00:00

设计动机：
    四层自进化架构（docs/concepts/design/self-evolving-agents.md §4）Phase 1 评测地基。
    综述 §8「自我改进评测六目标」落地：held-out gain（visible 增益）+ backward retention
    （holdout 零回归）+ path attribution（反事实 Skill Influence Pattern）。本迁移只建表；
    SuiteRunner / 门裁决 / 归因器在代码层（engine/eval/、engine/evolution/decision.py）。

    表定义 1:1 对齐 ORM 模型 ``models/eval_suite.py``，避免 autogenerate 漂移。

幂等性：
    建表/索引前以 information_schema / pg_indexes 探测存在性（仿 0082），便于半失败重试。
    本迁移无 seed 数据（评测套件由 API/程序按需创建）。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0083"
down_revision: str | None = "0082"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


# =============================================================================
# 辅助：存在性探测（仿 0082）
# =============================================================================


def _table_exists(bind, table_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(f"SELECT 1 FROM information_schema.tables WHERE table_schema = '{SCHEMA}' AND table_name = :n"),
            {"n": table_name},
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
    # 1) eval_suites（评测套件）
    # -------------------------------------------------------------------------
    if not _table_exists(bind, "eval_suites"):
        op.create_table(
            "eval_suites",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("target_kind", sa.String(length=32), nullable=False),
            sa.Column("target_ref", sa.String(length=255), nullable=False),
            sa.Column("scoring_config", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("is_frozen", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("holdout_ratio", sa.Float(), nullable=False, server_default=sa.text("0.2")),
            sa.Column("owner_id", sa.String(length=255), nullable=False),
            sa.Column("visibility", sa.String(length=16), nullable=False, server_default=sa.text("'private'")),
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
            "ix_eval_suites_target",
            "eval_suites",
            ["target_kind", "target_ref"],
            schema=SCHEMA,
        )
        op.create_index("ix_eval_suites_owner", "eval_suites", ["owner_id"], schema=SCHEMA)

    # -------------------------------------------------------------------------
    # 2) eval_cases（评测用例）
    # -------------------------------------------------------------------------
    if not _table_exists(bind, "eval_cases"):
        op.create_table(
            "eval_cases",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "suite_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey(f"{SCHEMA}.eval_suites.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("is_frozen", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("input", postgresql.JSONB(), nullable=False),
            sa.Column("expected", postgresql.JSONB(), nullable=True),
            sa.Column("weight", sa.Float(), nullable=False, server_default=sa.text("1.0")),
            sa.Column("tags", postgresql.ARRAY(sa.Text()), nullable=True),
            sa.Column("source", sa.String(length=16), nullable=False, server_default=sa.text("'manual'")),
            sa.Column("provenance_ref", sa.Text(), nullable=True),
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
        op.create_index("ix_eval_cases_suite", "eval_cases", ["suite_id"], schema=SCHEMA)
        op.create_index(
            "ix_eval_cases_suite_frozen",
            "eval_cases",
            ["suite_id"],
            postgresql_where=sa.text("is_frozen = TRUE"),
            schema=SCHEMA,
        )

    # -------------------------------------------------------------------------
    # 3) eval_runs（一次评测运行）
    # -------------------------------------------------------------------------
    if not _table_exists(bind, "eval_runs"):
        op.create_table(
            "eval_runs",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "suite_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey(f"{SCHEMA}.eval_suites.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("target_kind", sa.String(length=32), nullable=False),
            sa.Column("target_ref", sa.String(length=255), nullable=False),
            sa.Column("target_version", sa.String(length=50), nullable=False),
            sa.Column("baseline_version", sa.String(length=50), nullable=True),
            sa.Column("trigger", sa.String(length=16), nullable=False, server_default=sa.text("'manual'")),
            sa.Column("score_mean", sa.Float(), nullable=True),
            sa.Column("pass_rate", sa.Float(), nullable=True),
            sa.Column("cost_total", sa.Float(), nullable=True),
            sa.Column("latency_p95", sa.Float(), nullable=True),
            sa.Column("regression_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("status", sa.String(length=16), nullable=False, server_default=sa.text("'running'")),
            sa.Column("partition", sa.String(length=16), nullable=True),
            sa.Column("error", sa.Text(), nullable=True),
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
            "ix_eval_runs_target",
            "eval_runs",
            ["target_kind", "target_ref", "target_version"],
            schema=SCHEMA,
        )
        op.create_index("ix_eval_runs_status", "eval_runs", ["status"], schema=SCHEMA)
        op.create_index("ix_eval_runs_suite", "eval_runs", ["suite_id"], schema=SCHEMA)
        op.create_index(
            "ix_eval_runs_baseline",
            "eval_runs",
            ["target_kind", "target_ref", "baseline_version"],
            schema=SCHEMA,
        )

    # -------------------------------------------------------------------------
    # 4) eval_results（单 case 评分 + 审计 + 反事实归因）
    # -------------------------------------------------------------------------
    if not _table_exists(bind, "eval_results"):
        op.create_table(
            "eval_results",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "run_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey(f"{SCHEMA}.eval_runs.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "case_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey(f"{SCHEMA}.eval_cases.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("score", sa.Float(), nullable=False),
            sa.Column("verdict", sa.String(length=32), nullable=True),
            sa.Column("output_digest", sa.Text(), nullable=True),
            sa.Column("judge_raw", postgresql.JSONB(), nullable=True),
            sa.Column("is_frozen_case", sa.Boolean(), nullable=False),
            sa.Column("attribution", postgresql.JSONB(), nullable=True),
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
        op.create_index("ix_eval_results_run", "eval_results", ["run_id"], schema=SCHEMA)
        op.create_index(
            "uq_eval_results_run_case",
            "eval_results",
            ["run_id", "case_id"],
            unique=True,
            schema=SCHEMA,
        )
        op.create_index(
            "ix_eval_results_run_frozen",
            "eval_results",
            ["run_id"],
            postgresql_where=sa.text("is_frozen_case = TRUE"),
            schema=SCHEMA,
        )


def downgrade() -> None:
    # 遵循 AGENTS.md「谨慎数据迁移回滚」：仅删本迁移引入的表，不动其他表。
    bind = op.get_bind()

    if _table_exists(bind, "eval_results"):
        if _index_exists(bind, "ix_eval_results_run_frozen"):
            op.drop_index("ix_eval_results_run_frozen", table_name="eval_results", schema=SCHEMA)
        if _index_exists(bind, "uq_eval_results_run_case"):
            op.drop_index("uq_eval_results_run_case", table_name="eval_results", schema=SCHEMA)
        if _index_exists(bind, "ix_eval_results_run"):
            op.drop_index("ix_eval_results_run", table_name="eval_results", schema=SCHEMA)
        op.drop_table("eval_results", schema=SCHEMA)

    if _table_exists(bind, "eval_runs"):
        for ix in (
            "ix_eval_runs_baseline",
            "ix_eval_runs_suite",
            "ix_eval_runs_status",
            "ix_eval_runs_target",
        ):
            if _index_exists(bind, ix):
                op.drop_index(ix, table_name="eval_runs", schema=SCHEMA)
        op.drop_table("eval_runs", schema=SCHEMA)

    if _table_exists(bind, "eval_cases"):
        for ix in ("ix_eval_cases_suite_frozen", "ix_eval_cases_suite"):
            if _index_exists(bind, ix):
                op.drop_index(ix, table_name="eval_cases", schema=SCHEMA)
        op.drop_table("eval_cases", schema=SCHEMA)

    if _table_exists(bind, "eval_suites"):
        for ix in ("ix_eval_suites_owner", "ix_eval_suites_target"):
            if _index_exists(bind, ix):
                op.drop_index(ix, table_name="eval_suites", schema=SCHEMA)
        op.drop_table("eval_suites", schema=SCHEMA)
