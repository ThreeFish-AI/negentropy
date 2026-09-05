"""Definition Registry 建表 —— 所有「定义源」的单一事实源（SSOT）基座

Revision ID: 0095
Revises: 0094
Create Date: 2026-07-10 00:00:00.000000+00:00

设计动机：
    把分散在文件系统 / 代码里的定义源（Skill 模板 / Routine 预设 / Harness 技能
    SKILL.md / 代码内置 Agent 规格）统一收敛到 ``negentropy.definitions`` 一张表，
    以「整段源文本入库 + 表单编辑器维护」承载，消除 YAML↔DB↔SKILL.md 的
    split-brain。本迁移只建表结构，各定义族的播种由后续迁移（0096..）分阶段落地。

幂等性 / 非破坏：
    - upgrade：``CREATE TABLE`` 前以 information_schema 探测存在性（可重入）。
    - downgrade：**非破坏 no-op**（AGENTS.md「谨慎回滚，严禁删数据」）。本表在后续
      阶段会承载 SSOT 定义源，回滚 drop 会丢数据，故不 drop；结构清理如需，走人工。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0095"
down_revision: str | None = "0094"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def _table_exists(bind, table: str) -> bool:
    return bool(
        bind.execute(
            sa.text("SELECT 1 FROM information_schema.tables WHERE table_schema = :s AND table_name = :t"),
            {"s": SCHEMA, "t": table},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "definitions"):
        op.create_table(
            "definitions",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("kind", sa.String(length=50), nullable=False),
            sa.Column("key", sa.String(length=255), nullable=False),
            sa.Column("format", sa.String(length=16), nullable=False, server_default="yaml"),
            sa.Column("source", sa.Text(), nullable=False, server_default=""),
            sa.Column("meta", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("version", sa.String(length=50), nullable=True),
            sa.Column("checksum", sa.String(length=64), nullable=True),
            sa.Column("owner_id", sa.String(length=255), nullable=False, server_default="system"),
            sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            schema=SCHEMA,
        )
        op.create_unique_constraint("uq_definitions_kind_key", "definitions", ["kind", "key"], schema=SCHEMA)
        op.create_index("ix_definitions_kind", "definitions", ["kind"], schema=SCHEMA)
        op.create_index("ix_definitions_kind_enabled", "definitions", ["kind", "is_enabled"], schema=SCHEMA)
        op.create_index("ix_definitions_owner", "definitions", ["owner_id"], schema=SCHEMA)


def downgrade() -> None:
    # 非破坏 no-op：本表承载 SSOT 定义源，回滚不 drop 以防数据丢失。
    pass
