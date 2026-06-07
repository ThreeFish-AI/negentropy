"""skills 新增 is_global 列：全局技能（全系统所有 Agent 自动注入）

Revision ID: 0063
Revises: 0062
Create Date: 2026-06-06 00:00:00.000000+00:00

设计动机：
    现有「卡片可见」(``is_system``) 与「Agent 可用」是两套正交语义——
    ``is_system=TRUE`` 仅令技能在 ``get_visible_plugin_ids`` union 下对全员
    *可见*（Interface/Skills 卡片），而 ``resolve_skills`` *注入* Agent system
    prompt 时**只认 ``Agent.skills`` 数组中显式列出的项**；6 个内置 Agent 经
    ``agent_presets._build_payload`` 硬编码 ``skills=[]``，故仅靠 ``is_system``
    无法让技能进入任何 Agent 的 Progressive Disclosure。

    本列 ``is_global`` 引入第三条正交语义：为 TRUE 时由
    ``skills_injector.resolve_global_skills`` 在 Agent 指令装配热路径
    （``model_resolver._load_subagent_row`` DB 路径 + ``_dynamic_instruction``
    fallback 路径）统一并入**全系统所有 Agent**（含一核五翼与未来新增 Agent），
    无需逐 Agent 维护 ``skills`` 数组，亦不受 "Sync Negentropy" 覆盖 ``skills=[]``
    影响。

正交分解（沿用 0036/0037 范式）：
    本迁移仅做 **schema**（加列 + 索引）；技能种子数据（``pdf-fidelity-restore``）
    由独立的 ``0064`` 数据迁移承载，避免 schema 迁移堆叠隐式数据修正。

幂等性：
    ``ADD COLUMN IF NOT EXISTS`` + ``CREATE INDEX IF NOT EXISTS``，重跑安全。
    既有行 ``is_global`` 取 server_default FALSE，行为与升级前完全一致（零回归）。

downgrade：
    删索引 + 删列（``IF EXISTS``）。本列为新增、无外部依赖，可安全回滚。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0063"
down_revision: str | None = "0062"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.execute(
        sa.text(f"ALTER TABLE {SCHEMA}.skills ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE")
    )
    op.execute(sa.text(f"CREATE INDEX IF NOT EXISTS ix_skills_is_global ON {SCHEMA}.skills (is_global)"))


def downgrade() -> None:
    op.execute(sa.text(f"DROP INDEX IF EXISTS {SCHEMA}.ix_skills_is_global"))
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.skills DROP COLUMN IF EXISTS is_global"))
