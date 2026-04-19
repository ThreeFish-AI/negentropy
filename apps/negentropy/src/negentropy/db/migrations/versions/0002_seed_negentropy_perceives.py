"""Seed: negentropy-perceives 预置 MCP Server

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-19 00:00:00.000000+00:00

按正交分解原则，将 DDL 与 DML 解耦：0001 仅负责 schema（纯 DDL），
本迁移承载 negentropy-perceives 这一预置 MCP Server 的 seed（纯 DML）。

SQL 模板直接复用 99eb9ff 已验证的 `INSERT ... ON CONFLICT (name) DO UPDATE`：
- 新部署 alembic upgrade head 会首次写入预置；
- 既有部署如被手动污染，也会在任意升级通路上被幂等自愈回归预置。
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Negentropy Perceives MCP Server 预设（幂等 upsert）
    op.execute(
        sa.text("""
        INSERT INTO negentropy.mcp_servers (
            owner_id, visibility, name, display_name, description,
            transport_type, command, args, env, url, headers,
            is_enabled, auto_start, config
        )
        VALUES (
            'system:negentropy-perceives-preset',
            'PUBLIC'::negentropy.pluginvisibility,
            'negentropy-perceives',
            'Negentropy Perceives',
            '一款商用级 MCP Server，能够从网页和 PDF 文件中精准提取包括文本、'
            '图片、表格、公式等内容，并将之转换为与源文档编排格式一致的 Markdown 文档。',
            'http',
            NULL,
            '[]'::jsonb,
            '{}'::jsonb,
            'http://localhost:8092/mcp',
            '{}'::jsonb,
            TRUE,
            TRUE,
            '{}'::jsonb
        )
        ON CONFLICT (name) DO UPDATE
        SET
            owner_id = EXCLUDED.owner_id,
            visibility = EXCLUDED.visibility,
            display_name = EXCLUDED.display_name,
            description = EXCLUDED.description,
            transport_type = EXCLUDED.transport_type,
            command = EXCLUDED.command,
            args = EXCLUDED.args,
            env = EXCLUDED.env,
            url = EXCLUDED.url,
            headers = EXCLUDED.headers,
            is_enabled = EXCLUDED.is_enabled,
            auto_start = EXCLUDED.auto_start,
            config = EXCLUDED.config,
            updated_at = now()
    """)
    )


def downgrade() -> None:
    # 仅回收 seed，不触碰 schema
    op.execute(sa.text("DELETE FROM negentropy.mcp_servers WHERE name = 'negentropy-perceives'"))
