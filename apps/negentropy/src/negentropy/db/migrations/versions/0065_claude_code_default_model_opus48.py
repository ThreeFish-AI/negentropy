"""将 claude_code 内置工具默认模型从 null 升级为 claude-opus-4-8

Revision ID: 0065
Revises: 0064
Create Date: 2026-06-08 00:00:00.000000+00:00

设计动机：
    迁移 0039 seed 的 ``builtin_tools.config.model`` 默认为 ``null``，
    运行时由 Claude Code SDK/CLI 自身决定模型——当前默认解析为 ``claude-opus-4-7``。
    为使 Routine 任务中 Claude Code 始终走最新 ``claude-opus-4-8`` 模型，
    需显式将该默认值写入数据库。

幂等 / 非破坏性：
    - 仅当 ``config ->> 'model' IS NULL`` 时才更新，不覆盖运维已自定义的模型设置。
    - 多次执行结果一致。
    - downgrade 恢复为 null，不影响其他 config 字段。
"""

import sqlalchemy as sa
from alembic import op

revision = "0065"
down_revision = "0064"
branch_labels = None
depends_on = None

SCHEMA = "negentropy"

_DEFAULT_MODEL = "claude-opus-4-8"


def upgrade() -> None:
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.builtin_tools
            SET config = jsonb_set(
                config,
                '{{model}}',
                to_jsonb(:model),
                true
            )
            WHERE name = 'claude_code'
              AND owner_id = 'system'
              AND config ->> 'model' IS NULL
            """
        ).bindparams(
            sa.bindparam("model", value=_DEFAULT_MODEL),
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.builtin_tools
            SET config = config || '{{"model": null}}'::jsonb
            WHERE name = 'claude_code'
              AND owner_id = 'system'
              AND config ->> 'model' = :model
            """
        ).bindparams(
            sa.bindparam("model", value=_DEFAULT_MODEL),
        )
    )
