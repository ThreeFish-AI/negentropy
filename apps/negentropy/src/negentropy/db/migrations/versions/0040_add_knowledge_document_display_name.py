"""knowledge_documents 新增 display_name 列以支持 Wiki 显示名编辑

Revision ID: 0040
Revises: 0039
Create Date: 2026-05-26 00:00:00.000000+00:00

设计动机：
    源文件名 (``original_filename``) 在抓取 / OCR 过程中常带有传播瑕疵
    （截断、前缀冗余、空格被下划线替代等）；用作 Wiki 站点页面标题会
    损害可读性。新增一列 ``display_name`` 作为「Wiki 站点上显示的名称」
    的用户手填值，既保留源文件名的可追溯性，又支持就地修正。

    Wiki 同步管线 (``wiki_service.sync_publication``) 将按
    ``display_name -> metadata_.title -> original_filename`` 的优先级
    决定 ``WikiPublicationEntry.entry_title``，编辑后由用户主动触发
    「从 Catalog 同步」/「同步并发布」生效，不在写入时产生隐式发布。

幂等性：
    使用 ``ADD COLUMN IF NOT EXISTS`` 保证重复执行安全；downgrade 仅
    ``DROP COLUMN`` 该新增列，不触碰其它业务数据。既有行的 ``display_name``
    为 ``NULL``，运行时优先级链回退到现有行为。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0040"
down_revision: str | None = "0039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.knowledge_documents ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)"))


def downgrade() -> None:
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.knowledge_documents DROP COLUMN IF EXISTS display_name"))
