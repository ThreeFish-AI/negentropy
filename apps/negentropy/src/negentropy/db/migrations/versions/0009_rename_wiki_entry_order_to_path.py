"""Wiki 发布条目：列名 entry_order → entry_path（命名语义化）

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-25 06:50:00.000000+00:00

Naming Refactor（命名语义化）：
  ``wiki_publication_entries.entry_order`` 列原命名容易被误读为"排序权重"，但实际
  存储的是导航树层级路径（Materialized Path，``list[str]`` 序列化为 JSON）。语义
  与命名错配会持续增加阅读成本与新功能误用风险，故重命名为 ``entry_path``。

  - 列类型 / NULL 约束 / 索引 / 唯一约束：均不变；纯重命名。
  - ORM / Pydantic schema / 前端类型同步在同一 PR 提交，避免漂移。

Downgrade 策略：
  - 反向重命名 ``entry_path → entry_order``，对历史快照保持向后兼容。
  - 数据保留：列重命名为零数据丢失操作。

设计溯源：
  - 列重命名属 Refactoring，[6] M. Fowler, *Refactoring: Improving the Design of
    Existing Code*, 2nd ed., Addison-Wesley, 2018, ch. "Renaming Variables".
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publication_entries RENAME COLUMN entry_order TO entry_path"))


def downgrade() -> None:
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publication_entries RENAME COLUMN entry_path TO entry_order"))
