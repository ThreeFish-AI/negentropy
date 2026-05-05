"""新增 mcp_resource_templates 表（MCP Resource Template 持久化）

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-27 00:00:00.000000+00:00

设计动机：
  Negentropy Perceives MCP Server 的 wrapper 出口动态注册 FileResource
  （URI 形如 ``perceives://pdf/<job_id>/<filename>``），主仓侧需要：
    1. 通过 MCP ``resources/templates/list`` 发现 server 声明的资源模板；
    2. 持久化模板元数据用于 MCP 卡片展示与未来扩展；
    3. **不**持久化动态实例（生命周期与单次工具调用绑定）。

  本迁移仅落地 Resource Templates 一张表，遵循 YAGNI：
    - 静态注册的 Resources（非模板）当前无 server 提供，待真正需要时再加表。
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mcp_resource_templates",
        sa.Column("server_id", sa.UUID(), nullable=False),
        sa.Column("uri_template", sa.String(length=500), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("mime_type", sa.String(length=255), nullable=True),
        sa.Column("annotations", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["server_id"], ["negentropy.mcp_servers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("server_id", "uri_template", name="mcp_resource_templates_server_uri_unique"),
        schema="negentropy",
    )
    op.create_index(
        "ix_mcp_resource_templates_server_id",
        "mcp_resource_templates",
        ["server_id"],
        unique=False,
        schema="negentropy",
    )


def downgrade() -> None:
    op.drop_index("ix_mcp_resource_templates_server_id", table_name="mcp_resource_templates", schema="negentropy")
    op.drop_table("mcp_resource_templates", schema="negentropy")
