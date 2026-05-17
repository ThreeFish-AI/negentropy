"""Plugin 表统一新增 is_system 列并幂等回填系统内置 seed

Revision ID: 0033
Revises: 0032
Create Date: 2026-05-16 16:30:00.000000+00:00

设计动机：
    历史上「系统内置」概念在 5 类 plugin 表中表达方式不一致：

      - builtin_tools.is_system  : 显式列（迁移 0031 已建）
      - mcp_servers              : 隐式靠 owner_id 前缀 ``"system:"``（0002 seed）
      - sub_agents               : 隐式靠 ``config.source == "negentropy_builtin"``
      - skills                   : 暂无 seed

    Dashboard 统计与子模块列表无法对全员稳定展示系统内置项，前端也缺少统一的
    Built-In 徽标。本迁移把单一事实源收口到显式 ``is_system`` 列：

      - mcp_servers   ADD COLUMN is_system + 回填 owner_id LIKE 'system%'
      - skills        ADD COLUMN is_system（暂无 seed，仅建列）
      - sub_agents    ADD COLUMN is_system + 回填 config.source = 'negentropy_builtin'

    伴随索引 ``ix_<table>_is_system``（与 builtin_tools 表结构风格保持对称，便于
    permissions.get_visible_plugin_ids 中按 is_system=true 的并集子查询走索引）。

    幂等性：使用 ``ADD COLUMN IF NOT EXISTS`` + 条件 UPDATE，重复执行不会破坏
    已有数据；downgrade 仅 DROP COLUMN 不触碰 seed 行。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0033"
down_revision: str | None = "0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    # 1. mcp_servers：新增列 + 索引 + 回填 ``owner_id LIKE 'system%'`` 的种子行。
    op.execute(
        sa.text(f"ALTER TABLE {SCHEMA}.mcp_servers ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE")
    )
    op.execute(sa.text(f"CREATE INDEX IF NOT EXISTS ix_mcp_servers_is_system ON {SCHEMA}.mcp_servers (is_system)"))
    op.execute(
        sa.text(f"UPDATE {SCHEMA}.mcp_servers SET is_system = TRUE WHERE owner_id LIKE 'system%' AND is_system = FALSE")
    )

    # 2. skills：新增列 + 索引。暂无 seed 行，回填空操作。
    op.execute(
        sa.text(f"ALTER TABLE {SCHEMA}.skills ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE")
    )
    op.execute(sa.text(f"CREATE INDEX IF NOT EXISTS ix_skills_is_system ON {SCHEMA}.skills (is_system)"))

    # 3. sub_agents：新增列 + 索引 + 回填 ``config.source = 'negentropy_builtin'`` 行。
    op.execute(
        sa.text(f"ALTER TABLE {SCHEMA}.sub_agents ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE")
    )
    op.execute(sa.text(f"CREATE INDEX IF NOT EXISTS ix_sub_agents_is_system ON {SCHEMA}.sub_agents (is_system)"))
    op.execute(
        sa.text(
            f"UPDATE {SCHEMA}.sub_agents SET is_system = TRUE "
            "WHERE (config->>'source') = 'negentropy_builtin' AND is_system = FALSE"
        )
    )


def downgrade() -> None:
    # 仅回收新增的列与索引，不触碰任何 seed 行或业务数据。
    op.execute(sa.text(f"DROP INDEX IF EXISTS {SCHEMA}.ix_sub_agents_is_system"))
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.sub_agents DROP COLUMN IF EXISTS is_system"))

    op.execute(sa.text(f"DROP INDEX IF EXISTS {SCHEMA}.ix_skills_is_system"))
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.skills DROP COLUMN IF EXISTS is_system"))

    op.execute(sa.text(f"DROP INDEX IF EXISTS {SCHEMA}.ix_mcp_servers_is_system"))
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.mcp_servers DROP COLUMN IF EXISTS is_system"))
