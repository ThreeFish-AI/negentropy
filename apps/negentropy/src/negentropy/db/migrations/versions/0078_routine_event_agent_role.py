"""为 routine_iteration_events 新增可选 agent_role（多 Agent 归因）。

Revision ID: 0078
Revises: 0077
Create Date: 2026-06-29 00:00:01.000000+00:00

设计动机：
    Routine 的「人机交互」中「人」侧动作（审 Plan / 答问 / 门控 / 评估）由一核五翼 6 个
    真实 Faculty Agent 产出（详见 ADR 040-routine-multi-agent-faculty）。``agent_role`` 标识
    产出每条事件的 Agent 角色，使 Full View 能正确呈现「6 Agent ↔ Claude Code」的人机交互。

    取值与前端 ``features/routine/agent-role.ts`` 的 AgentRole 对齐：
    ``engine|claude_code|perception|action|internalization|contemplation|influence``。
    NULL=未归因（存量事件 / CC 自身动作回退前端 deriveHumanRole 推导），向后兼容不破坏存量。

幂等性：
    加列前以 information_schema 探测（仿 0075）。纯加 nullable 列，不删数据；
    回滚即 drop column（空列无数据风险）。

参考文献：
[1] 0075_routine_repository_id.py — information_schema 幂等加列范式。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0078"
down_revision: str | None = "0077"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = :s AND table_name = :t AND column_name = :c"
            ),
            {"s": SCHEMA, "t": table_name, "c": column_name},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()
    if not _column_exists(bind, "routine_iteration_events", "agent_role"):
        op.add_column(
            "routine_iteration_events",
            sa.Column(
                "agent_role",
                sa.String(length=32),
                nullable=True,
                comment=(
                    "多 Agent 归因：产出此事件的 Agent 角色"
                    "（engine|claude_code|perception|action|internalization|contemplation|influence）；NULL=未归因"
                ),
            ),
            schema=SCHEMA,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _column_exists(bind, "routine_iteration_events", "agent_role"):
        op.drop_column("routine_iteration_events", "agent_role", schema=SCHEMA)
