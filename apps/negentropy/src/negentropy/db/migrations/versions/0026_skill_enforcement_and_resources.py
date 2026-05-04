"""skills 表新增 enforcement_mode + resources（Phase 2）

Revision ID: 0026
Revises: 0025
Create Date: 2026-05-04 22:00:00.000000+00:00

设计动机：
  Skills Phase 2 引入两项扩展：

  1. ``enforcement_mode``：``warning`` (默认，向后兼容) | ``strict``
     - ``strict`` 时缺失 ``required_tools`` 直接拒绝注入并降级为无 system prompt 启动，
       避免"看似启动但工具不全"的隐性故障；对应 Anthropic Skills `allowed-tools` 的
       capability boundary 默认收紧策略。
  2. ``resources`` JSONB 数组：``[{type, ref, title, lazy}, ...]``
     - 支持把 KG 节点 / Memory 记录 / Knowledge corpus / URL / Markdown 片段挂载到
       Skill 上；默认 ``lazy=true`` 不入常驻 prompt，仅在 ``expand_skill`` 触发时
       展开为 markdown bullets，由 ``fetch_skill_resource`` 工具按需路由。
     - 对齐 Google ADK Skills 的 declarative metadata + resource attachments 解耦。

参考文献：
  [1] Anthropic, "Agent Skills: Allowed Tools and Capability Boundaries",
      *Claude Code Documentation*, 2026.
  [2] Google, "Agent Development Kit: Skills and Resources",
      *ADK Documentation*, 2026.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0026"
down_revision: str | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()

    has_enforcement = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'negentropy' AND table_name = 'skills' "
            "AND column_name = 'enforcement_mode'"
        )
    ).scalar()
    if not has_enforcement:
        op.add_column(
            "skills",
            sa.Column(
                "enforcement_mode",
                sa.String(length=16),
                nullable=False,
                server_default="warning",
            ),
            schema="negentropy",
        )

    has_resources = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'negentropy' AND table_name = 'skills' "
            "AND column_name = 'resources'"
        )
    ).scalar()
    if not has_resources:
        op.add_column(
            "skills",
            sa.Column(
                "resources",
                postgresql.JSONB(),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
            schema="negentropy",
        )


def downgrade() -> None:
    bind = op.get_bind()

    has_resources = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'negentropy' AND table_name = 'skills' "
            "AND column_name = 'resources'"
        )
    ).scalar()
    if has_resources:
        op.drop_column("skills", "resources", schema="negentropy")

    has_enforcement = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'negentropy' AND table_name = 'skills' "
            "AND column_name = 'enforcement_mode'"
        )
    ).scalar()
    if has_enforcement:
        op.drop_column("skills", "enforcement_mode", schema="negentropy")
