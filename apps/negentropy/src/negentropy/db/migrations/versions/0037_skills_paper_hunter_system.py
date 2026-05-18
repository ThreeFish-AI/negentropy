"""paper-hunter 系列 skills 提升为 system 内置（dashboard 统计可见性扩散）

Revision ID: 0037
Revises: 0036
Create Date: 2026-05-18 10:00:00.000000+00:00

设计动机：
    现场 3 条 ``ai-agent-paper-hunter`` 系列 skills 由 dev-admin 经
    ``/skills/from-template`` 创建，记为 ``owner_id='google:dev-admin'`` /
    ``visibility='SHARED'`` / ``is_system=false``，导致普通用户在
    ``get_visible_plugin_ids("skill", user)`` 的 union 中四路全 miss，进而
    让 Interface > Dashboard 的 Skills 卡片统计恒为 0。

    与 0033 对 ``mcp_servers``（``owner_id LIKE 'system%'``）和
    ``sub_agents``（``config.source = 'negentropy_builtin'``）的内置回填
    同语义，把这批种子 skills 标记为 ``is_system = TRUE``，让 union 路径
    自动接管「内置全员可见」语义 —— 无需触碰 list_skills 端点代码。

历史背景：
    原工作分支曾把本块逻辑与 ``builtin_tools.visibility`` VARCHAR→ENUM
    类型修复合并为单条 0036 迁移；该 ENUM 修复已由 ``feature/1.x.x`` 上
    另一条独立迁移 ``0036_builtin_tools_visibility_enum`` 完成（更稳健的
    ``CASE LOWER(...)`` 全量大小写归一 + 防御性断言）。两者按 Alembic
    单 head 线性链原则正交分解：0036 专注列类型规范化、0037 专注 skills
    可见性扩散。

跨环境注意：
    回填条件 ``owner_id = 'google:dev-admin' AND name LIKE
    'ai-agent-paper-hunter%'`` 是「现场修正」语义 —— dev/staging 上 3 条
    种子由该 owner 创建后未走 is_system 路径；其他环境若不存在该 owner
    则为 no-op，若存在则只命中前缀严格匹配的 skills。为便于跨环境审计，
    回填后用 ``logger.info`` 输出实际 rowcount（见 ``upgrade()`` 末尾），
    运维可在 alembic 输出中核对影响行数；若未来需要再扩散到其他 owner，
    应单独走 seed/data-fix 脚本，避免 schema 迁移堆叠隐式数据修正。

幂等性：
    UPDATE 用 ``IS DISTINCT FROM TRUE`` 守卫，重跑 noop；识别条件保守
    锁定 ``owner_id = 'google:dev-admin'`` AND ``name LIKE 'ai-agent-paper-hunter%'``，
    覆盖原模板及自动加后缀的派生名，且不会误伤其他用户自建 skill。

downgrade：
    本迁移仅作可见性扩散（向后可见性单调），刻意不回滚 ``is_system``——
    否则升级后已经依赖 paper-hunter 内置可见性的普通用户会突然失去访问，
    违反「可见性只升不降」原则。downgrade 故意置为 no-op。
"""

import logging
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0037"
down_revision: str | None = "0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"

# 使用 alembic 自身的 runtime logger，确保审计输出与其它迁移日志同流。
logger = logging.getLogger("alembic.runtime.migration")


def upgrade() -> None:
    # 把现场 paper-hunter 系列种子提升为系统内置，与 0033 对 mcp_servers /
    # sub_agents 的回填同语义。识别条件保守锁定：
    #   - owner_id 等于 dev-admin 种子账户
    #   - name 以 'ai-agent-paper-hunter' 开头（覆盖原模板及自动加后缀的派生名）
    # 用 IS DISTINCT FROM TRUE 守卫保证幂等。
    #
    # 用 op.get_bind().execute(...) 而非 op.execute(...)，以便拿到 rowcount
    # 输出审计日志 —— 跨环境时若发现非预期的命中行数（>3 或 在不该有此种子
    # 的环境出现 >0），运维可立刻据此回滚或追查。
    bind = op.get_bind()
    skills_result = bind.execute(
        sa.text(
            f"UPDATE {SCHEMA}.skills "
            "SET is_system = TRUE "
            "WHERE is_system IS DISTINCT FROM TRUE "
            "AND owner_id = 'google:dev-admin' "
            "AND name LIKE 'ai-agent-paper-hunter%'"
        )
    )
    affected = skills_result.rowcount if skills_result.rowcount is not None else 0
    logger.info(
        "0037.upgrade: paper-hunter skills backfill affected %d row(s) "
        "(owner=google:dev-admin, name LIKE 'ai-agent-paper-hunter%%')",
        affected,
    )


def downgrade() -> None:
    # 故意 no-op：见 module docstring「downgrade」一节——可见性扩散不回滚。
    pass
