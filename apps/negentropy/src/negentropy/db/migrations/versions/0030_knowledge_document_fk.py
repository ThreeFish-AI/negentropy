"""knowledge.document_id FK — 文档级 CASCADE 防御层（ISSUE-078 Phase 3）

Revision ID: 0030
Revises: 0029
Create Date: 2026-05-09 18:00:00.000000+00:00

设计动机（与 ISSUE-078 Phase 1/2 形成 belt-and-suspenders 三层防御）：

  - **Phase 1（PR #483）**：corpus chunks 计数 SQL 加入 `chunk_role!=child` +
    `EXISTS active doc` 过滤，让 UI 数字立即恢复正常；
  - **Phase 2（PR #484）**：`DocumentStorageService.delete_document` 硬删时
    级联清理 chunks、软删时 archive chunks、reactivation 时 hard purge 旧
    chunks——堵未来产生孤儿/检索污染的应用层入口；
  - **Phase 3（本迁移）**：在 DB schema 层加 ``Knowledge.document_id`` FK to
    ``knowledge_documents.id ON DELETE CASCADE``——任何 bypass 应用层的删除
    路径（如 DBA 手动 DELETE FROM knowledge_documents、未来新增 service
    入口忘记调用 storage.delete_document 等）都会被 DB 层的 CASCADE 兜住。

为什么 nullable=True：
  - KG 类直连知识（``KgEntity`` 等价 chunk）没有对应 ``KnowledgeDocument``
    来源，``document_id`` 必须允许 NULL；
  - 历史数据（迁移前已存在的 chunks）也无 ``document_id``，需要后续通过独立
    CLI ``cleanup_orphan_knowledge`` 一次性回填，本迁移**仅加列与约束、不做
    数据变更**——避免大表 UPDATE 造成长锁。

为什么部分索引 ``WHERE document_id IS NOT NULL``：
  - KG 类 chunks 的 ``document_id`` 永远 NULL，索引这部分浪费存储；
  - 仅索引「指向文档的 chunks」，加速 ``DELETE knowledge_documents`` 触发的
    级联探查。与 0029 ``ix_knowledge_arxiv_id`` 同一思路（详见迁移注释）。

为什么 CASCADE 而非 SET NULL：
  - SET NULL 会让历史 chunks 残留为「曾经有 doc 但 doc 已删」的孤儿，与
    Phase 2 的语义（硬删则删 chunks）矛盾；
  - CASCADE 让 DB 自动维护应用层不变量，正交于业务逻辑。

为什么 downgrade 仅 DROP COLUMN：
  - DROP COLUMN 在 PG 中是元数据操作，不重写表，可瞬时回滚；
  - 已删除的孤儿 chunks 无法恢复——独立 CLI ``cleanup_orphan_knowledge``
    才是数据清算入口，本迁移不触碰数据。

参考文献：
  [1] PostgreSQL Documentation, "ALTER TABLE — ADD CONSTRAINT FOREIGN KEY"
  [2] PostgreSQL Documentation, "Indexes on Expressions" / "Partial Indexes"
  [3] M. J. Stonebraker and A. Kumar, "The Logical Design of Distributed Databases,"
      ACM TODS, 1980（CASCADE 与正交化数据完整性约束的早期论述）。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0030"
down_revision: str | None = "0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_SCHEMA = "negentropy"
_TABLE = "knowledge"
_COLUMN = "document_id"
_FK_NAME = "fk_knowledge_document_id"
_INDEX_NAME = "ix_knowledge_document_id"


def upgrade() -> None:
    bind = op.get_bind()

    column_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = :schema AND table_name = :table AND column_name = :col"
        ),
        {"schema": _SCHEMA, "table": _TABLE, "col": _COLUMN},
    ).scalar()
    if not column_exists:
        op.execute(sa.text(f"ALTER TABLE {_SCHEMA}.{_TABLE} ADD COLUMN {_COLUMN} UUID NULL"))

    fk_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_schema = :schema AND table_name = :table AND constraint_name = :fk"
        ),
        {"schema": _SCHEMA, "table": _TABLE, "fk": _FK_NAME},
    ).scalar()
    if not fk_exists:
        op.execute(
            sa.text(
                f"ALTER TABLE {_SCHEMA}.{_TABLE} "
                f"ADD CONSTRAINT {_FK_NAME} "
                f"FOREIGN KEY ({_COLUMN}) "
                f"REFERENCES {_SCHEMA}.knowledge_documents(id) ON DELETE CASCADE"
            )
        )

    index_exists = bind.execute(
        sa.text("SELECT 1 FROM pg_indexes WHERE schemaname = :schema AND indexname = :idx"),
        {"schema": _SCHEMA, "idx": _INDEX_NAME},
    ).scalar()
    if not index_exists:
        op.execute(
            sa.text(
                f"""
                CREATE INDEX IF NOT EXISTS {_INDEX_NAME}
                ON {_SCHEMA}.{_TABLE} ({_COLUMN})
                WHERE {_COLUMN} IS NOT NULL
                """
            )
        )


def downgrade() -> None:
    bind = op.get_bind()

    index_exists = bind.execute(
        sa.text("SELECT 1 FROM pg_indexes WHERE schemaname = :schema AND indexname = :idx"),
        {"schema": _SCHEMA, "idx": _INDEX_NAME},
    ).scalar()
    if index_exists:
        op.execute(sa.text(f"DROP INDEX IF EXISTS {_SCHEMA}.{_INDEX_NAME}"))

    fk_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_schema = :schema AND table_name = :table AND constraint_name = :fk"
        ),
        {"schema": _SCHEMA, "table": _TABLE, "fk": _FK_NAME},
    ).scalar()
    if fk_exists:
        op.execute(sa.text(f"ALTER TABLE {_SCHEMA}.{_TABLE} DROP CONSTRAINT IF EXISTS {_FK_NAME}"))

    column_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = :schema AND table_name = :table AND column_name = :col"
        ),
        {"schema": _SCHEMA, "table": _TABLE, "col": _COLUMN},
    ).scalar()
    if column_exists:
        op.execute(sa.text(f"ALTER TABLE {_SCHEMA}.{_TABLE} DROP COLUMN IF EXISTS {_COLUMN}"))
