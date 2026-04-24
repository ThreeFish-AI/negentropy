"""Seed: negentropy-perceives 预置 MCP Tools (4 个默认提取工具)

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-24 00:00:00.000000+00:00

按正交分解原则，与 0002 的「预置 Server（纯 DML）」对称，
本迁移承载 negentropy-perceives 之下 4 个预置 MCP Tool 的 seed（纯 DML），
作为 Corpus 创建时默认 extractor_routes 注入的 DB 前提。

预置的 4 个工具（与 `config/knowledge.py:DefaultExtractorRoutesSettings` 保持 SSOT 对齐）：
- parse_webpage_to_markdown   — url 文档（主）
- parse_webpages_to_markdown  — url 文档（备）
- parse_pdf_to_markdown       — file_pdf 文档（主）
- parse_pdfs_to_markdown      — file_pdf 文档（备）

SQL 采用 `INSERT ... ON CONFLICT (server_id, name) DO UPDATE` 幂等 upsert：
- 新部署 alembic upgrade head 会首次写入 4 行；
- 既有部署如被手动污染，也会在任意升级通路上被幂等自愈回归预置；
- 与 `interface/api.py` 中 live discovery 的 existing UPDATE 分支天然兼容，
  后续用户点「Load Tools」会按真实 schema/meta/execution 覆盖，本迁移不会重复插入。

不填充 input_schema/output_schema/icons/annotations/execution/meta —
交由 0001 中已声明的 server_default（`{}`/`[]`）兜底，待 live discovery 补齐。
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Negentropy Perceives MCP Tools 预设（幂等 upsert）
    # 若 server 行因任何原因缺失，CROSS JOIN 自然零命中而不报错。
    op.execute(
        sa.text("""
        INSERT INTO negentropy.mcp_tools (
            server_id, name, title, description, is_enabled
        )
        SELECT s.id, t.name, t.title, t.description, TRUE
        FROM negentropy.mcp_servers s
        CROSS JOIN (VALUES
            ('parse_webpage_to_markdown',  '网页转 Markdown（单篇）', '将单个 URL 网页解析为 Markdown 文档。'),
            ('parse_webpages_to_markdown', '网页转 Markdown（批量）', '将多个 URL 网页批量解析为 Markdown 文档。'),
            ('parse_pdf_to_markdown',      'PDF 转 Markdown（单篇）', '将单个 PDF 文件解析为 Markdown 文档。'),
            ('parse_pdfs_to_markdown',     'PDF 转 Markdown（批量）', '将多个 PDF 文件批量解析为 Markdown 文档。')
        ) AS t(name, title, description)
        WHERE s.name = 'negentropy-perceives'
        ON CONFLICT (server_id, name) DO UPDATE
        SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            is_enabled = EXCLUDED.is_enabled,
            updated_at = now()
    """)
    )


def downgrade() -> None:
    # 仅回收本次 seed 的 4 行，不触碰 schema；不影响 live discovery 写入的其它工具行。
    op.execute(
        sa.text("""
        DELETE FROM negentropy.mcp_tools
        WHERE name IN (
            'parse_webpage_to_markdown',
            'parse_webpages_to_markdown',
            'parse_pdf_to_markdown',
            'parse_pdfs_to_markdown'
        )
          AND server_id IN (
              SELECT id FROM negentropy.mcp_servers WHERE name = 'negentropy-perceives'
          )
    """)
    )
