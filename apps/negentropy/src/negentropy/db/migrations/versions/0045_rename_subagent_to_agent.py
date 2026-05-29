"""SubAgent 概念彻底更名为 Agent：表 sub_agents -> agents、约束/索引、
plugin_permissions.plugin_type 取值、以及 config.adk_config.kind 取值。

Revision ID: 0045
Revises: 0044
Create Date: 2026-05-29 00:00:00.000000+00:00

设计动机：
    将「SubAgent / 子智能体」概念统一收口为「Agent / 智能体」。本迁移覆盖三类持久化引用：

      1. 表 sub_agents -> agents（数据原地保留），并显式重命名其约束/索引
         （Postgres 在 RENAME TABLE 时不会自动重命名其索引/约束，需显式 ALTER）：
           sub_agents_name_unique  -> agents_name_unique
           ix_sub_agents_owner      -> ix_agents_owner
           ix_sub_agents_is_system  -> ix_agents_is_system
      2. plugin_permissions.plugin_type：'sub_agent' -> 'agent'（Agent 权限授权行）。
      3. (agents).config 的嵌套 kind：config->'adk_config'->>'kind'
         由 'subagent' -> 'agent'，仅命中等于 'subagent' 的行（root 行与无 kind 行不动）。

    NOT TOUCHED：negentropy.threads.state 中的 ``preferred_subagent`` 键。后端 reader
    改为双键容忍（先读 preferred_agent，回退 preferred_subagent），避免在高写入量的
    会话状态表上做 JSONB 迁移；现存会话零迁移、零丢失。

幂等性 / 安全性：
    - 表与索引重命名用 ``IF EXISTS`` 保护，重复执行不报错；
    - plugin_type 与 kind 的 UPDATE 带 WHERE 过滤，仅改命中行，重复执行为空操作；
    - downgrade 对称反向（含 kind 与 plugin_type 反向 UPDATE）。
    - 整个 upgrade() 在单事务内执行（Alembic online 模式），失败可整体回滚。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0045"
down_revision: str | None = "0044"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    # 1a. 重命名表 sub_agents -> agents（数据原地保留）。
    op.execute(sa.text(f"ALTER TABLE IF EXISTS {SCHEMA}.sub_agents RENAME TO agents"))

    # 1b. 显式重命名约束与索引（Postgres 不会随表名自动改名）。
    #     ALTER TABLE ... RENAME CONSTRAINT 需用表的【当前】名（现已是 agents）。
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.agents RENAME CONSTRAINT sub_agents_name_unique TO agents_name_unique"))
    #     ALTER INDEX 与表名无关，按 schema.索引名 直接改。
    op.execute(sa.text(f"ALTER INDEX IF EXISTS {SCHEMA}.ix_sub_agents_owner RENAME TO ix_agents_owner"))
    op.execute(sa.text(f"ALTER INDEX IF EXISTS {SCHEMA}.ix_sub_agents_is_system RENAME TO ix_agents_is_system"))

    # 2. plugin_permissions.plugin_type 字符串值迁移：'sub_agent' -> 'agent'。
    op.execute(sa.text(f"UPDATE {SCHEMA}.plugin_permissions SET plugin_type = 'agent' WHERE plugin_type = 'sub_agent'"))

    # 3. config 嵌套 kind 迁移：config->'adk_config'->>'kind' 'subagent' -> 'agent'。
    #    仅命中确实为 'subagent' 的行；root 行（'root'）与无 kind 行不受影响。
    op.execute(
        sa.text(
            f"UPDATE {SCHEMA}.agents "
            "SET config = jsonb_set(config, '{adk_config,kind}', '\"agent\"'::jsonb, true) "
            "WHERE config -> 'adk_config' ->> 'kind' = 'subagent'"
        )
    )


def downgrade() -> None:
    # 3. 反向：config kind 'agent' -> 'subagent'（仅命中 'agent' 行）。
    op.execute(
        sa.text(
            f"UPDATE {SCHEMA}.agents "
            "SET config = jsonb_set(config, '{adk_config,kind}', '\"subagent\"'::jsonb, true) "
            "WHERE config -> 'adk_config' ->> 'kind' = 'agent'"
        )
    )

    # 2. 反向：plugin_type 'agent' -> 'sub_agent'。
    op.execute(sa.text(f"UPDATE {SCHEMA}.plugin_permissions SET plugin_type = 'sub_agent' WHERE plugin_type = 'agent'"))

    # 1b. 反向重命名索引与约束（约束用当前表名 agents）。
    op.execute(sa.text(f"ALTER INDEX IF EXISTS {SCHEMA}.ix_agents_is_system RENAME TO ix_sub_agents_is_system"))
    op.execute(sa.text(f"ALTER INDEX IF EXISTS {SCHEMA}.ix_agents_owner RENAME TO ix_sub_agents_owner"))
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.agents RENAME CONSTRAINT agents_name_unique TO sub_agents_name_unique"))

    # 1a. 反向重命名表 agents -> sub_agents。
    op.execute(sa.text(f"ALTER TABLE IF EXISTS {SCHEMA}.agents RENAME TO sub_agents"))
