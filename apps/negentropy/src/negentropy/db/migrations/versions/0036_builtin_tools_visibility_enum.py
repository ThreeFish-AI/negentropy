"""builtin_tools.visibility VARCHAR(20) → negentropy.pluginvisibility 枚举

Revision ID: 0036
Revises: 0035
Create Date: 2026-05-18 09:40:00.000000+00:00

设计动机：
    迁移 0031 创建 ``builtin_tools`` 表时把 ``visibility`` 列声明为 ``VARCHAR(20)``
    并以小写 ``'private'`` / ``'public'`` 作为字面量与种子值，而 ORM 模型
    ``BuiltinTool.visibility`` 使用 ``Enum(PluginVisibility, schema="negentropy")``。

    SQLAlchemy 序列化 ``PluginVisibility.PUBLIC`` 时以成员 NAME（大写 ``'PUBLIC'``）
    作为绑定参数，并生成 ``WHERE ... = $N::negentropy.pluginvisibility`` 的显式
    cast。PG 无 ``character varying = pluginvisibility`` 操作符，导致

        asyncpg.exceptions.UndefinedFunctionError: operator does not exist:
          character varying = negentropy.pluginvisibility

    在 ``permissions.get_visible_plugin_ids(plugin_type='builtin_tool')`` 上稳定
    复现，``GET /interface/tools`` 与 ``GET /interface/stats`` 500。

    同源 ``mcp_servers`` / ``skills`` / ``sub_agents`` 在迁移 0001 已用 PG 枚举建表
    （0001_init_schema.py:196/306/334），仅 ``builtin_tools`` 偏离了模板。

    与 ISSUE-012（pg 枚举列上的 text-only 操作必须显式 cast）同源——本次以
    「ORM Enum 与迁移 VARCHAR 漂移」的形态再次出现。

幂等与不可逆性：
    采用 forward-only 修复，不回改迁移 0031（既会破坏 stairway，又会让已经
    运行旧 0031 的部署陷入 schema 漂移）。本迁移 ``upgrade`` 在数据规范化、
    类型转换前后均显式做防御性断言；``downgrade`` 走 ``USING visibility::text``
    回到 VARCHAR(20)（规避 ISSUE-012 的直接 enum→varchar cast 陷阱）。

锁与性能：
    ``ALTER COLUMN ... TYPE`` 取 ACCESS EXCLUSIVE 锁并重写表数据。本表生产
    部署量级极小（仅 system seed），可接受。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0036"
down_revision: str | None = "0035"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"
ENUM_TYPE = f"{SCHEMA}.pluginvisibility"  # 0001 已建，无需 CREATE TYPE


def upgrade() -> None:
    # 1) 规范化遗留数据：把 0031 种子的 'public' 等小写字面量映射到枚举成员名（大写）。
    #    使用 LOWER(...) 做兜底（防御性覆盖大小写混杂的人工写入）。
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.builtin_tools
               SET visibility = CASE LOWER(visibility::text)
                   WHEN 'private' THEN 'PRIVATE'
                   WHEN 'shared'  THEN 'SHARED'
                   WHEN 'public'  THEN 'PUBLIC'
                   ELSE visibility
               END
            """
        )
    )

    # 2) 防御性断言：若仍存在非法值，立刻抛出；避免 ALTER TYPE 报含糊的 cast 错误。
    op.execute(
        sa.text(
            f"""
            DO $$
            DECLARE bad_count int;
            BEGIN
              SELECT count(*) INTO bad_count FROM {SCHEMA}.builtin_tools
               WHERE visibility NOT IN ('PRIVATE','SHARED','PUBLIC');
              IF bad_count > 0 THEN
                RAISE EXCEPTION 'unexpected visibility values in builtin_tools: % rows', bad_count;
              END IF;
            END $$;
            """
        )
    )

    # 3) 转换列类型：DROP DEFAULT → ALTER TYPE USING → SET DEFAULT
    #    表上无视图 / 触发器 / visibility 索引依赖（0031 仅建了 owner / tool_type 索引）。
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.builtin_tools ALTER COLUMN visibility DROP DEFAULT"))
    op.execute(
        sa.text(
            f"""
            ALTER TABLE {SCHEMA}.builtin_tools
            ALTER COLUMN visibility TYPE {ENUM_TYPE}
            USING visibility::{ENUM_TYPE}
            """
        )
    )
    op.execute(
        sa.text(
            f"""
            ALTER TABLE {SCHEMA}.builtin_tools
            ALTER COLUMN visibility SET DEFAULT 'PRIVATE'::{ENUM_TYPE}
            """
        )
    )


def downgrade() -> None:
    # 反向：先 DROP DEFAULT，再走 ::text 中转回到 VARCHAR(20)，最后恢复 0031 的小写默认值。
    # 必须经 ``::text``，避免「enum 直接 ::varchar」复现 ISSUE-012 类陷阱。
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.builtin_tools ALTER COLUMN visibility DROP DEFAULT"))
    op.execute(
        sa.text(
            f"""
            ALTER TABLE {SCHEMA}.builtin_tools
            ALTER COLUMN visibility TYPE VARCHAR(20)
            USING visibility::text
            """
        )
    )
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.builtin_tools ALTER COLUMN visibility SET DEFAULT 'private'"))
