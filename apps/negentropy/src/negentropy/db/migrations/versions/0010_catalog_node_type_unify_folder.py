"""Catalog 节点类型收敛：CATEGORY/COLLECTION → FOLDER（极简化用户面类型）

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-26 00:00:00.000000+00:00

设计动机（Orthogonal Decomposition）：
  ``DocCatalogEntry.node_type`` 历史枚举三值 ``CATEGORY`` / ``COLLECTION`` /
  ``DOCUMENT_REF``。代码事实表明 CATEGORY 与 COLLECTION 在 ORM、DAO、Service、Wiki
  Sync 各层**完全等价**——仅前端图标颜色不同（``CatalogTreeNode.tsx:14-23``）。
  两值并存违反"正交地提取概念主体"，给用户面带来语义噪声而无对应行为差异，故
  归一为 ``FOLDER``：用户可见的"目录容器"单一类型。

  ``DOCUMENT_REF`` 仍保留——它是 N:M 文档归属的内部软引用（由
  ``CatalogDao.assign_document`` 自动创建），不暴露至用户创建路径。

迁移策略（PG ENUM 限制）：
  PostgreSQL 不支持从 ENUM 类型中直接 DROP VALUE，而 ``ALTER TYPE ... ADD VALUE``
  必须在事务外（或在事务内但不能立即使用新值）。本迁移采用：

    Phase A（autocommit）：``ALTER TYPE catalogentrynodetype ADD VALUE 'FOLDER'``
    Phase B（regular tx）：``UPDATE doc_catalog_entries SET node_type='FOLDER'
                            WHERE node_type IN ('CATEGORY','COLLECTION')``
                          + 调整 server_default

  CATEGORY / COLLECTION 在枚举中作为"死值"保留（应用层禁止写入），与 ISSUE-013 的
  enum cast 处理范式同构。

Downgrade 策略：
  ``UPDATE doc_catalog_entries SET node_type='CATEGORY' WHERE node_type='FOLDER'``
  + 还原 server_default。零数据丢失（FOLDER 在历史模型中等价于 CATEGORY）。

设计溯源：
  - [5] P. J. Sadalage and M. Fowler, *NoSQL Distilled*, 2016, ch. "Schema Migrations" — Expand-Contract.
  - [6] M. Fowler, *Refactoring*, 2nd ed., Addison-Wesley, 2018 — Replace Type Code with Subclass / Unify.
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # =========================================================================
    # Phase A：在 autocommit 块中扩张枚举，PG ENUM ADD VALUE 不能与"使用新值"
    # 同事务执行；autocommit_block 显式跳出事务上下文。
    # =========================================================================
    with op.get_context().autocommit_block():
        op.execute(sa.text("ALTER TYPE negentropy.catalogentrynodetype ADD VALUE IF NOT EXISTS 'FOLDER'"))

    # =========================================================================
    # Phase B：将既有 CATEGORY / COLLECTION 行迁移为 FOLDER；调整列默认值。
    # 在常规事务中执行（FOLDER 已在 Phase A 提交后可用）。
    # =========================================================================
    op.execute(
        sa.text("""
            UPDATE negentropy.doc_catalog_entries
            SET node_type = 'FOLDER'
            WHERE node_type IN ('CATEGORY', 'COLLECTION')
        """)
    )

    op.execute(
        sa.text("""
            ALTER TABLE negentropy.doc_catalog_entries
            ALTER COLUMN node_type SET DEFAULT 'FOLDER'
        """)
    )


def downgrade() -> None:
    # =========================================================================
    # 反向回填：FOLDER → CATEGORY；还原 server_default。
    # 不尝试 DROP VALUE（PG 不支持），CATEGORY/COLLECTION 在枚举中始终可用。
    # =========================================================================
    op.execute(
        sa.text("""
            ALTER TABLE negentropy.doc_catalog_entries
            ALTER COLUMN node_type SET DEFAULT 'CATEGORY'
        """)
    )

    op.execute(
        sa.text("""
            UPDATE negentropy.doc_catalog_entries
            SET node_type = 'CATEGORY'
            WHERE node_type = 'FOLDER'
        """)
    )
