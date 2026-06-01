"""Add wiki_entry_views table for page view counting

Revision ID: 0057
Revises: 0056
Create Date: 2026-06-01 00:00:00.000000+00:00

设计动机：
    为 Wiki 条目新增浏览计数能力。每次页面加载通过 ``POST /view`` 端点
    原子递增 view_count，供文章元数据栏展示「浏览次数」。

    采用轻量级 per-entry 计数器（不做用户去重），使用 PostgreSQL
    ``INSERT ... ON CONFLICT DO UPDATE`` 实现原子 upsert，
    避免并发场景下的计数丢失。
"""

from alembic import op

revision = "0057"
down_revision = "0056"
branch_labels = None
depends_on = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.execute(f"""
        CREATE TABLE {SCHEMA}.wiki_entry_views (
            entry_id UUID NOT NULL
                REFERENCES {SCHEMA}.wiki_publication_entries(id) ON DELETE CASCADE,
            view_count BIGINT NOT NULL DEFAULT 0,
            last_viewed_at TIMESTAMP WITH TIME ZONE,
            PRIMARY KEY (entry_id)
        )
    """)


def downgrade() -> None:
    op.execute(f"DROP TABLE IF EXISTS {SCHEMA}.wiki_entry_views")
