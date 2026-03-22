"""seed data extractor mcp server

Revision ID: a9d3f7b21c4e
Revises: f2c3d4e5a6b7
Create Date: 2026-03-22 08:20:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op

import negentropy.models.base

# revision identifiers, used by Alembic.
revision: str = "a9d3f7b21c4e"
down_revision: Union[str, None] = "f2c3d4e5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Seed the system MCP Hub with the Data Extractor server."""

    schema = negentropy.models.base.NEGENTROPY_SCHEMA
    op.execute(
        f"""
        INSERT INTO {schema}.mcp_servers (
            owner_id,
            visibility,
            name,
            display_name,
            description,
            transport_type,
            command,
            args,
            env,
            url,
            headers,
            is_enabled,
            auto_start,
            config
        )
        VALUES (
            'system:data-extractor-preset',
            'PUBLIC'::{schema}.pluginvisibility,
            'data-extractor',
            'Data Extractor',
            '一款商用级 MCP Server，能够从网页和 PDF 文件中精准提取包括文本、图片、表格、公式等内容，并将之转换为与源文档编排格式一致的 Markdown 文档。',
            'http',
            NULL,
            '[]'::jsonb,
            '{{}}'::jsonb,
            'http://localhost:8081/mcp',
            '{{}}'::jsonb,
            TRUE,
            TRUE,
            '{{}}'::jsonb
        )
        ON CONFLICT (name) DO NOTHING
        """
    )


def downgrade() -> None:
    """Remove the seeded Data Extractor MCP server."""

    schema = negentropy.models.base.NEGENTROPY_SCHEMA
    op.execute(f"DELETE FROM {schema}.mcp_servers WHERE name = 'data-extractor'")
