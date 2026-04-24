"""Catalog 单实例 Phase A：聚合根不变量约束（partial unique + tombstone 溯源）

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-24 00:30:00.000000+00:00

按「Expand → Backfill → Contract」三段式不破坏迁移策略的扩张阶段：
  - 仅施加**纯加法式**的 schema 变更（新增列 + 新增 partial unique index）；
  - 不修改既有数据；不删除任何列/表/索引；
  - 为后续 Phase B 合并迁移（0008）与 Phase C API 单例化提供约束骨架。

新增列：
  - doc_catalogs.merged_into_id  UUID NULL REFERENCES doc_catalogs(id) ON DELETE SET NULL
    Tombstone 溯源指针：合并后源 catalog 标记 is_archived=true 并指向 survivor，
    保留双向溯源关系，避免硬删除导致的引用语义丢失（Kleppmann DDIA ch.5 [4]）。

新增 partial unique index：
  - uq_doc_catalogs_app_singleton ON (app_name) WHERE is_archived = false
    聚合根不变量：每个 app_name 仅允许 1 个活跃 Catalog（Evans 2003 [2]）。
  - uq_wiki_pub_catalog_active ON (catalog_id) WHERE publish_mode = 'LIVE'
    每个 Catalog 仅允许 1 个 LIVE 模式 WikiPublication（SNAPSHOT 多版本不受限，
    用于版本回退）。注意：使用 publish_mode 而非 status，前者是 LIVE/SNAPSHOT 模式
    维度，后者是 draft/published/archived 生命周期维度，二者正交。

数据状态前提：
  - 测试环境（CI）：fixture 库为空 → doc_catalogs / wiki_publications 均无数据 → 索引创建无冲突；
  - 生产环境：若已通过 0004 backfill 累积多 catalog/多 LIVE publication，
    本 migration 的 CREATE UNIQUE INDEX 步骤将抛 IntegrityError。
    此时须按 docs/negentropy-wiki-ops.md §12 runbook 先手工合并（pg_dump 备份后），
    再重跑 alembic upgrade。

Downgrade 策略：
  - 仅 DROP 新增索引 + 新增列；不反向操作既有数据（无副作用）。
  - 与 test_migrations_stairway 的 base ↔ head 往返兼容。

设计溯源（IEEE 引用见 docs/knowledges.md §15）：
  - [2] E. Evans, *Domain-Driven Design*, Addison-Wesley, 2003. — Aggregate Root
  - [4] M. Kleppmann, *Designing Data-Intensive Applications*, O'Reilly, 2017. — Tombstone
  - [5] P. J. Sadalage and M. Fowler, *NoSQL Distilled*, ch. "Schema Migrations", 2016. — Expand-Contract
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # =========================================================================
    # 1) doc_catalogs.merged_into_id：Tombstone 溯源指针
    #    合并完成后，源 catalog 设 is_archived=true 并写入 survivor.id；
    #    ON DELETE SET NULL 保证 survivor 物理删除（极端场景）时悬挂安全。
    # =========================================================================
    op.execute(
        sa.text("""
            ALTER TABLE negentropy.doc_catalogs
            ADD COLUMN IF NOT EXISTS merged_into_id UUID
            REFERENCES negentropy.doc_catalogs(id) ON DELETE SET NULL
        """)
    )

    # 索引仅覆盖 tombstoned 行（绝大多数行此列为 NULL）
    op.execute(
        sa.text("""
            CREATE INDEX IF NOT EXISTS ix_doc_catalogs_merged_into_id
            ON negentropy.doc_catalogs (merged_into_id)
            WHERE merged_into_id IS NOT NULL
        """)
    )

    # =========================================================================
    # 2) uq_doc_catalogs_app_singleton：每个 app 仅允许 1 个活跃 Catalog
    #    Partial unique index（is_archived = false 时生效），允许多个已归档
    #    Catalog 共存（保留迁移历史）。
    # =========================================================================
    op.execute(
        sa.text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_doc_catalogs_app_singleton
            ON negentropy.doc_catalogs (app_name)
            WHERE is_archived = false
        """)
    )

    # =========================================================================
    # 3) uq_wiki_pub_catalog_active：每个 Catalog 仅允许 1 个 LIVE 模式发布
    #    SNAPSHOT 模式发布不受约束，作为版本回退池累积。
    #    注意：publish_mode 是 LIVE/SNAPSHOT 模式，而 status 是 draft/published/archived
    #    生命周期 —— 二者正交，本约束选择 publish_mode 维度。
    # =========================================================================
    op.execute(
        sa.text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_pub_catalog_active
            ON negentropy.wiki_publications (catalog_id)
            WHERE publish_mode = 'LIVE'
        """)
    )


def downgrade() -> None:
    # =========================================================================
    # 反向 DROP：先索引、再列。无副作用（仅清理约束骨架，不动既有数据）。
    # =========================================================================
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.uq_wiki_pub_catalog_active"))
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.uq_doc_catalogs_app_singleton"))
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.ix_doc_catalogs_merged_into_id"))
    op.execute(sa.text("ALTER TABLE negentropy.doc_catalogs DROP COLUMN IF EXISTS merged_into_id"))
