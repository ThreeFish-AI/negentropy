"""新增 wiki_entry_comments 和 wiki_entry_annotations 表

Revision ID: 0041
Revises: 0040
Create Date: 2026-05-26 00:00:00.000000+00:00

设计动机：
    为 Wiki 站点添加两种用户互动能力：

    1. **页面评论** (wiki_entry_comments)：文档底部的通用评论区，
       关联 entry_id，支持软删除和回复线程（parent_comment_id）。
    2. **文本注解** (wiki_entry_annotations)：锚定到文档正文中具体文本片段
       的注解，使用 W3C Web Annotation TextQuoteSelector 模式进行定位。
       anchor JSONB 字段存储 xpath + exact + prefix + suffix + text_offset。
       被注解的文本在 wiki 页面上以常驻高亮标记，hover 显示 Tooltip。

    两张表独立建模：评论无锚定数据，注解有 anchor JSONB + quoted_text，
    查询模式和数据生命周期差异显著。

幂等性：
    使用 CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS，
    downgrade 使用 DROP TABLE IF EXISTS。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0041"
down_revision: str | None = "0040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    # ── wiki_entry_comments ──
    op.execute(
        sa.text(f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.wiki_entry_comments (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entry_id        UUID NOT NULL REFERENCES {SCHEMA}.wiki_publication_entries(id) ON DELETE CASCADE,
            user_id         VARCHAR(255) NOT NULL,
            body            TEXT NOT NULL,
            status          VARCHAR(20) NOT NULL DEFAULT 'active',
            parent_comment_id UUID REFERENCES {SCHEMA}.wiki_entry_comments(id) ON DELETE CASCADE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    )
    op.execute(
        sa.text(f"CREATE INDEX IF NOT EXISTS ix_wiki_comments_entry_id ON {SCHEMA}.wiki_entry_comments (entry_id)")
    )
    op.execute(
        sa.text(
            f"CREATE INDEX IF NOT EXISTS ix_wiki_comments_entry_status "
            f"ON {SCHEMA}.wiki_entry_comments (entry_id, status)"
        )
    )

    # ── wiki_entry_annotations ──
    op.execute(
        sa.text(f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.wiki_entry_annotations (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entry_id        UUID NOT NULL REFERENCES {SCHEMA}.wiki_publication_entries(id) ON DELETE CASCADE,
            user_id         VARCHAR(255) NOT NULL,
            body            TEXT NOT NULL,
            quoted_text     TEXT NOT NULL,
            anchor          JSONB NOT NULL,
            pub_version     INTEGER NOT NULL,
            status          VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    )
    op.execute(
        sa.text(
            f"CREATE INDEX IF NOT EXISTS ix_wiki_annotations_entry_id ON {SCHEMA}.wiki_entry_annotations (entry_id)"
        )
    )
    op.execute(
        sa.text(
            f"CREATE INDEX IF NOT EXISTS ix_wiki_annotations_entry_status "
            f"ON {SCHEMA}.wiki_entry_annotations (entry_id, status)"
        )
    )
    op.execute(
        sa.text(f"CREATE INDEX IF NOT EXISTS ix_wiki_annotations_user_id ON {SCHEMA}.wiki_entry_annotations (user_id)")
    )


def downgrade() -> None:
    op.execute(sa.text(f"DROP TABLE IF EXISTS {SCHEMA}.wiki_entry_annotations"))
    op.execute(sa.text(f"DROP TABLE IF EXISTS {SCHEMA}.wiki_entry_comments"))
