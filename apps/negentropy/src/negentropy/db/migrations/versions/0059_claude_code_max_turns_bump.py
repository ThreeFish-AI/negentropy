"""拓宽 claude_code 全局配置 max_turns 上限 200→1000、默认值 20→500

Revision ID: 0059
Revises: 0058
Create Date: 2026-06-02 00:00:00.000000+00:00

设计动机：
    Interface / Tools → Claude Code 表单中 ``Max Turns`` 字段原上限为 200、默认值 20，
    无法满足长周期 agentic coding 任务的实际需求。

    本迁移对 ``builtin_tools`` 中 ``claude_code`` 行做两件事：

    (a) **刷新 ``config_schema.config.max_turns`` 字段定义**：
        ``maximum`` 从 200 拓宽到 1000，``default`` 从 20 提升到 500。
        这是纯 UI 声明变更（前端 ``ToolFormDialog`` 据此渲染 ``<input max>``），
        无运行时副作用，因此采用无条件覆写。

    (b) **受保护地回填 ``config.max_turns`` 为 500**：
        仅当当前值仍为迁移 0039 seed 的原始值 20 时才覆写（``WHERE ... = 20`` 守卫），
        尊重运维已通过 Tools UI 自定义的值。

幂等性：
    - 两条 UPDATE 均以 ``WHERE name='claude_code' AND owner_id='system'`` 限定单行；
    - (a) 子句无条件 ``jsonb_set``，重复执行结果一致；
    - (b) 子句带 ``COALESCE((config->>'max_turns')::int, 20) = 20`` 守卫，
      已升级或已自定义的行不会被重复修改。

与 Routine 系统的关系：
    Routine 子系统有独立的 ``RoutineSettings.default_max_turns = 1000``，
    由 ``orchestrator._build_config`` 在运行时显式覆盖 ``config.max_turns``，
    不受本迁移影响。
"""

import sqlalchemy as sa
from alembic import op

revision = "0059"
down_revision = "0058"
branch_labels = None
depends_on = None

SCHEMA = "negentropy"

# (a) 新的 config_schema.config.max_turns 字段定义（UI 表单约束）
_MAX_TURNS_SCHEMA = {
    "type": "integer",
    "title": "Max Turns",
    "description": "Claude Code 在单次调用中允许的最大自主迭代轮数",
    "default": 500,
    "minimum": 1,
    "maximum": 1000,
}

# (a) 的原始值（用于 downgrade 回退）
_MAX_TURNS_SCHEMA_OLD = {
    "type": "integer",
    "title": "Max Turns",
    "description": "Claude Code 在单次调用中允许的最大自主迭代轮数",
    "default": 20,
    "minimum": 1,
    "maximum": 200,
}


def upgrade() -> None:
    # (a) 无条件刷新 config_schema 的 UI 表单约束（max=1000, default=500）
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.builtin_tools
            SET config_schema = jsonb_set(
                COALESCE(config_schema, '{{}}'::jsonb),
                '{{config,max_turns}}',
                :max_turns_schema,
                true
            )
            WHERE name = 'claude_code' AND owner_id = 'system'
            """
        ).bindparams(
            sa.bindparam("max_turns_schema", value=_MAX_TURNS_SCHEMA, type_=sa.dialects.postgresql.JSONB),
        )
    )

    # (b) 受保护地回填 config.max_turns=500：仅当值仍为 0039 seed 的 20 时覆写
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.builtin_tools
            SET config = jsonb_set(
                COALESCE(config, '{{}}'::jsonb),
                '{{max_turns}}',
                '500'::jsonb,
                true
            )
            WHERE name = 'claude_code' AND owner_id = 'system'
              AND COALESCE((config->>'max_turns')::int, 20) = 20
            """
        )
    )


def downgrade() -> None:
    # (a) 回退 config_schema 的 UI 表单约束到原始值（max=200, default=20）
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.builtin_tools
            SET config_schema = jsonb_set(
                COALESCE(config_schema, '{{}}'::jsonb),
                '{{config,max_turns}}',
                :max_turns_schema_old,
                true
            )
            WHERE name = 'claude_code' AND owner_id = 'system'
            """
        ).bindparams(
            sa.bindparam("max_turns_schema_old", value=_MAX_TURNS_SCHEMA_OLD, type_=sa.dialects.postgresql.JSONB),
        )
    )

    # (b) 受保护地回退 config.max_turns=20：仅当值为本迁移写入的 500 时才回退
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.builtin_tools
            SET config = jsonb_set(
                COALESCE(config, '{{}}'::jsonb),
                '{{max_turns}}',
                '20'::jsonb,
                true
            )
            WHERE name = 'claude_code' AND owner_id = 'system'
              AND (config->>'max_turns')::int = 500
            """
        )
    )
