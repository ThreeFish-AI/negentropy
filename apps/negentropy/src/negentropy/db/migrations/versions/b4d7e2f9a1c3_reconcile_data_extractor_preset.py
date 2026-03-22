"""reconcile data extractor preset

Revision ID: b4d7e2f9a1c3
Revises: a9d3f7b21c4e
Create Date: 2026-03-22 08:45:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op

import negentropy.models.base

# revision identifiers, used by Alembic.
revision: str = "b4d7e2f9a1c3"
down_revision: Union[str, None] = "a9d3f7b21c4e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Reconcile Data Extractor to the official system preset configuration."""

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
        """
    )


def downgrade() -> None:
    """Downgrade is a no-op because the previous migration already owns the preset row."""

