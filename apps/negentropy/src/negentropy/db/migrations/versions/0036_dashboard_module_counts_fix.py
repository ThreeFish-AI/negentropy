"""Dashboard 模块统计修正：builtin_tools.visibility 收口到 pluginvisibility ENUM + paper-hunter skills 转系统内置

Revision ID: 0036
Revises: 0035
Create Date: 2026-05-18 10:00:00.000000+00:00

设计动机：
    1. 5 类 plugin（mcp_server / skill / sub_agent / builtin_tool）中只有
       ``builtin_tools.visibility`` 例外，DB 列是 ``VARCHAR(20)``、存小写
       ``'private'/'public'``（来自 0031 seed 直写）。ORM 把该列声明为
       ``Enum(PluginVisibility, schema=negentropy)``，SQLAlchemy 默认按
       enum.name 反序列化，期望大写 ``'PUBLIC'`` —— 与 DB 中实际的小写值不
       匹配 ⇒ 反序列化抛 ``LookupError`` ⇒ ``/interface/tools`` 与
       ``/interface/stats`` 一律 500，Dashboard 卡片被 next.js proxy
       defaultStats 兜底为全 0。本迁移把列收口到与其他 4 类一致的
       ``negentropy.pluginvisibility`` ENUM 类型，配合大写值回填，让 ORM
       Enum 列与 DB schema 自然契合。

    2. 现场 3 条 ``ai-agent-paper-hunter`` 系列 skills 由 dev-admin 用
       ``/skills/from-template`` 创建，记为 ``owner_id='google:dev-admin'`` /
       ``visibility='SHARED'`` / ``is_system=false``，导致普通用户在
       ``get_visible_plugin_ids("skill", user)`` 的 union 中四路全 miss。
       与 0033 对 ``mcp_servers``（``owner_id LIKE 'system%'``）和
       ``sub_agents``（``config.source = 'negentropy_builtin'``）的内置回填
       同语义，把这批种子 skills 标记为 ``is_system = TRUE``，让 union 路径
       自动接管「内置全员可见」语义 —— 无需触碰 list_skills 端点代码。

幂等性：
    - ENUM 转换前的大写回填用 ``UPDATE … WHERE visibility IN (lowercase)``
      条件守卫，重跑 noop；
    - ``ALTER COLUMN … TYPE ENUM USING …::ENUM`` 在列已经是 ENUM 时由
      PostgreSQL 自身保护（同类型转换静默成功）；
    - skills ``is_system`` 回填用 ``IS DISTINCT FROM TRUE`` 守卫，幂等可重跑。

downgrade：
    仅回滚 builtin_tools 列类型为 VARCHAR + 小写值，不回滚 skills 的
    ``is_system`` 数据（避免误降级用户已依赖的可见性扩散）。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0036"
down_revision: str | None = "0035"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1) builtin_tools.visibility：VARCHAR(小写值) → pluginvisibility ENUM
    # ------------------------------------------------------------------
    # 1.1 先把现有小写值大写化，使其与 ENUM label 对齐（PG ENUM 大小写敏感）。
    op.execute(
        sa.text(
            f"UPDATE {SCHEMA}.builtin_tools "
            "SET visibility = upper(visibility) "
            "WHERE visibility IN ('private', 'shared', 'public')"
        )
    )

    # 1.2 移除原 VARCHAR 列的 DEFAULT（同名小写字面量与 ENUM 不兼容），
    #     列类型切换为 ENUM 后再重设大写 DEFAULT。
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.builtin_tools ALTER COLUMN visibility DROP DEFAULT"))
    op.execute(
        sa.text(
            f"ALTER TABLE {SCHEMA}.builtin_tools "
            f"ALTER COLUMN visibility TYPE {SCHEMA}.pluginvisibility "
            f"USING visibility::{SCHEMA}.pluginvisibility"
        )
    )
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.builtin_tools ALTER COLUMN visibility SET DEFAULT 'PRIVATE'"))

    # ------------------------------------------------------------------
    # 2) skills.is_system：把现场 paper-hunter 系列种子提升为系统内置
    # ------------------------------------------------------------------
    # 与 0033 对 mcp_servers/sub_agents 的回填同语义。识别条件保守锁定：
    #   - owner_id 等于 dev-admin 种子账户
    #   - name 以 'ai-agent-paper-hunter' 开头（覆盖原模板及自动加后缀的派生名）
    # 用 IS DISTINCT FROM TRUE 守卫保证幂等。
    op.execute(
        sa.text(
            f"UPDATE {SCHEMA}.skills "
            "SET is_system = TRUE "
            "WHERE is_system IS DISTINCT FROM TRUE "
            "AND owner_id = 'google:dev-admin' "
            "AND name LIKE 'ai-agent-paper-hunter%'"
        )
    )


def downgrade() -> None:
    # 回滚 builtin_tools.visibility 到 VARCHAR(20) + 小写值，避免重新挂上 0031 seed 的语义。
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.builtin_tools ALTER COLUMN visibility DROP DEFAULT"))
    op.execute(
        sa.text(
            f"ALTER TABLE {SCHEMA}.builtin_tools ALTER COLUMN visibility TYPE VARCHAR(20) USING lower(visibility::text)"
        )
    )
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.builtin_tools ALTER COLUMN visibility SET DEFAULT 'private'"))

    # skills is_system 不回滚：可见性扩散是只升级语义，回滚会突然让 user 失去
    # 已经依赖的 paper-hunter skills，违反「向后可见性单调」原则。
