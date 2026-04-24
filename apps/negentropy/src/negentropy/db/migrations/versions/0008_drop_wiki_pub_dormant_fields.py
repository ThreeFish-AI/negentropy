"""Wiki 发布：移除 dormant 字段（navigation_config / custom_css / custom_js）

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-24 01:00:00.000000+00:00

YAGNI + Entropy Reduction：清理在 0001_init_schema 中预留、但全栈零业务消费的三个 dormant 字段。

调研依据（grep 全仓 + 前后端逐文件验证）：
  - 后端：仅 `models/perception.py` 列定义、`lifecycle_schemas.py` Pydantic 透传、`wiki_dao.py` 透传，
    **零业务消费**（无 publish 流水线读写、无 Wiki SSG 渲染依赖、无前端写回路径）。
  - 前端：仅 `features/knowledge/utils/knowledge-api.ts` interface 字段定义，
    `apps/negentropy-ui/app/knowledge/wiki/**` 任一 .tsx 组件均未读写。
  - 数据：所有生产行必然为 `{}` / NULL（从未写入实际数据 → 删除零信息丢失）。

为 Phase B（Migration 0009 多 Catalog 嫁接合并）扫清前置障碍：
  - 原 Phase B 计划顾虑 `navigation_config` JSONB 内嵌 catalog_id 引用 → 合并时需 JSONB rewrite；
  - dormant 字段全栈清理后，Phase B 不再需要 navigation_config 处理路径。

Downgrade 策略：
  - 重建为 nullable 列，保持 schema 形状回退，与 stairway 测试兼容；
  - 不还原数据（dormant 期数据本就为空，无业务影响）。

设计溯源（IEEE 引用见 docs/knowledges.md §15）：
  - [5] P. J. Sadalage and M. Fowler, *NoSQL Distilled*, ch. "Schema Migrations", 2016.
        — Expand-Contract（本迁移属 Contract 阶段，前置无任何写入路径）。
  - YAGNI: K. Beck, *Extreme Programming Explained*, Addison-Wesley, 1999.
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 三列 dormant，无业务消费 → 直接 DROP（无需 backfill）
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications DROP COLUMN IF EXISTS navigation_config"))
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications DROP COLUMN IF EXISTS custom_css"))
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications DROP COLUMN IF EXISTS custom_js"))


def downgrade() -> None:
    # 重建为 nullable，与 0001_init_schema 原始声明一致；dormant 期数据本就为空
    op.execute(
        sa.text(
            "ALTER TABLE negentropy.wiki_publications "
            "ADD COLUMN IF NOT EXISTS navigation_config JSONB DEFAULT '{}'::jsonb"
        )
    )
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications ADD COLUMN IF NOT EXISTS custom_css TEXT"))
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications ADD COLUMN IF NOT EXISTS custom_js TEXT"))
