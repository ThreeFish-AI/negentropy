"""knowledge_documents.corpus_id 可空化以支持独立文档库（Library）

Revision ID: 0067
Revises: 0066
Create Date: 2026-06-10 00:00:00.000000+00:00

设计动机：
    「Import Document」将「转换为 Markdown」与「索引化」两阶段正交解耦：
    文档可先导入文档库（不归属任何 Corpus、不做索引），后续再按需
    「Ingest Document」进任意 Corpus 索引化。库文档以 ``corpus_id IS NULL``
    表示，避免引入魔法 Corpus 行。

去重边界：
    既有 ``UNIQUE(corpus_id, file_hash)``（uq_knowledge_documents_corpus_hash）
    在 PostgreSQL 中对 NULL 行自动豁免（NULL 互异），故为库文档补充部分
    唯一索引 ``(app_name, file_hash) WHERE corpus_id IS NULL``——app 为租户
    边界，同 app 同内容的库文档只允许一份。

幂等性：
    ``DROP NOT NULL`` 与 ``CREATE UNIQUE INDEX IF NOT EXISTS`` 均可重复执行。

downgrade（数据保全红线）：
    若存在库文档（``corpus_id IS NULL`` 行），恢复 NOT NULL 必然破坏数据，
    此时 fail-loud 拒绝降级而非静默删除；无库文档时才恢复 NOT NULL 并
    移除部分唯一索引。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0067"
down_revision: str | None = "0066"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"
LIBRARY_HASH_INDEX = "uq_knowledge_documents_library_hash"


def upgrade() -> None:
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.knowledge_documents ALTER COLUMN corpus_id DROP NOT NULL"))
    op.execute(
        sa.text(
            f"CREATE UNIQUE INDEX IF NOT EXISTS {LIBRARY_HASH_INDEX} "
            f"ON {SCHEMA}.knowledge_documents (app_name, file_hash) "
            "WHERE corpus_id IS NULL"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    library_count = bind.execute(
        sa.text(f"SELECT count(*) FROM {SCHEMA}.knowledge_documents WHERE corpus_id IS NULL")
    ).scalar()
    if library_count:
        raise RuntimeError(
            f"Refusing destructive downgrade: {library_count} library document(s) "
            "(corpus_id IS NULL) exist in knowledge_documents. "
            "Reassign or remove them explicitly before downgrading."
        )
    op.execute(sa.text(f"DROP INDEX IF EXISTS {SCHEMA}.{LIBRARY_HASH_INDEX}"))
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.knowledge_documents ALTER COLUMN corpus_id SET NOT NULL"))
