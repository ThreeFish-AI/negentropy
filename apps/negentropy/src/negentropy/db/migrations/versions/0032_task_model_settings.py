"""创建 task_model_settings 表

Revision ID: 0032
Revises: 0031
Create Date: 2026-05-16 00:00:00.000000+00:00

设计动机：
    为后台 LLM 调用（Memory Consolidation、Session 标题、KG 抽取等）提供
    "任务 -> 模型" 的细粒度绑定能力。

    - scope_corpus_id IS NULL  → 全局映射（管理员在 /interface/task-models 配置）
    - scope_corpus_id NOT NULL → Corpus 级映射（用户在 Corpus 设置页配置）

    缺行 = 回退到 model_configs.is_default → 硬编码 fallback，零破坏。
    可灰度上线：合并代码与本 migration 后，行为与现状完全一致；用户按需 opt-in。

主键设计（surrogate PK + 偏唯一索引）：
    PostgreSQL PRIMARY KEY 会把所有组成列强制标为 NOT NULL，因此不能用
    PRIMARY KEY(scope_corpus_id, task_key) 来表达 "scope_corpus_id 可为 NULL"。
    改用 surrogate `id UUID` 作主键，通过两条偏唯一索引分别约束：
      - WHERE scope_corpus_id IS NULL       → 全局映射 task_key 唯一
      - WHERE scope_corpus_id IS NOT NULL   → Corpus 级 (corpus_id, task_key) 唯一
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0032"
down_revision: str | None = "0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.execute(
        sa.text(f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.task_model_settings (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            scope_corpus_id UUID NULL REFERENCES {SCHEMA}.corpus(id) ON DELETE CASCADE,
            task_key VARCHAR(128) NOT NULL,
            model_config_id UUID NOT NULL REFERENCES {SCHEMA}.model_configs(id) ON DELETE RESTRICT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (id)
        )
        """)
    )

    # 全局映射唯一性：scope_corpus_id IS NULL 时 task_key 唯一。
    op.execute(
        sa.text(f"""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_task_model_settings_global
        ON {SCHEMA}.task_model_settings (task_key)
        WHERE scope_corpus_id IS NULL
        """)
    )

    # Corpus 级映射唯一性：(scope_corpus_id, task_key) 在非 NULL 时唯一。
    op.execute(
        sa.text(f"""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_task_model_settings_corpus
        ON {SCHEMA}.task_model_settings (scope_corpus_id, task_key)
        WHERE scope_corpus_id IS NOT NULL
        """)
    )

    # 查询加速索引
    op.execute(
        sa.text(
            f"CREATE INDEX IF NOT EXISTS ix_task_model_settings_corpus "
            f"ON {SCHEMA}.task_model_settings (scope_corpus_id)"
        )
    )
    op.execute(
        sa.text(
            f"CREATE INDEX IF NOT EXISTS ix_task_model_settings_model ON {SCHEMA}.task_model_settings (model_config_id)"
        )
    )


def downgrade() -> None:
    op.execute(sa.text(f"DROP TABLE IF EXISTS {SCHEMA}.task_model_settings CASCADE"))
