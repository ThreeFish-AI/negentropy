"""Add plugins tables for MCP, Skills, SubAgents

Revision ID: d1e2f3a4b5c6
Revises: c3f4e5a6b7c8
Create Date: 2026-03-02 10:00:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c3f4e5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create plugins tables for MCP servers, Skills, SubAgents and permissions."""

    # ==========================================================================
    # Plugin Permissions 表 (需要先创建，因为其他表可能引用)
    # ==========================================================================
    op.create_table(
        "plugin_permissions",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("plugin_type", sa.String(50), nullable=False),
        sa.Column("plugin_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column(
            "permission",
            sa.Enum("view", "edit", name="plugin_permission_type"),
            nullable=False,
            server_default="view",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plugin_type", "plugin_id", "user_id", name="plugin_permissions_unique"),
        schema="negentropy",
    )
    op.create_index("ix_plugin_permissions_plugin", "plugin_permissions", ["plugin_type", "plugin_id"], schema="negentropy")
    op.create_index("ix_plugin_permissions_user", "plugin_permissions", ["user_id"], schema="negentropy")

    # ==========================================================================
    # MCP Servers 表
    # ==========================================================================
    op.create_table(
        "mcp_servers",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        # Ownership and visibility
        sa.Column("owner_id", sa.String(255), nullable=False),
        sa.Column(
            "visibility",
            sa.Enum("private", "shared", "public", name="plugin_visibility"),
            nullable=False,
            server_default="private",
        ),
        # Basic info
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        # Transport config
        sa.Column("transport_type", sa.String(50), nullable=False),
        sa.Column("command", sa.Text(), nullable=True),
        sa.Column("args", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=True),
        sa.Column("env", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=True),
        sa.Column("url", sa.String(500), nullable=True),
        # Status and config
        sa.Column("is_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("auto_start", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="mcp_servers_name_unique"),
        schema="negentropy",
    )
    op.create_index("ix_mcp_servers_owner", "mcp_servers", ["owner_id"], schema="negentropy")
    op.create_index("ix_mcp_servers_visibility", "mcp_servers", ["visibility"], schema="negentropy")

    # ==========================================================================
    # MCP Tools 表
    # ==========================================================================
    op.create_table(
        "mcp_tools",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("server_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("input_schema", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("call_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["server_id"], ["negentropy.mcp_servers.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("server_id", "name", name="mcp_tools_server_name_unique"),
        schema="negentropy",
    )
    op.create_index("ix_mcp_tools_server_id", "mcp_tools", ["server_id"], schema="negentropy")

    # ==========================================================================
    # Skills 表
    # ==========================================================================
    op.create_table(
        "skills",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        # Ownership and visibility
        sa.Column("owner_id", sa.String(255), nullable=False),
        sa.Column(
            "visibility",
            sa.Enum("private", "shared", "public", name="plugin_visibility"),
            nullable=False,
            server_default="private",
        ),
        # Basic info
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(100), server_default="general", nullable=False),
        sa.Column("version", sa.String(50), server_default="1.0.0", nullable=False),
        # Skill definition
        sa.Column("prompt_template", sa.Text(), nullable=True),
        sa.Column("config_schema", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=True),
        sa.Column("default_config", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=True),
        sa.Column("required_tools", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=True),
        # Status
        sa.Column("is_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("priority", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="skills_name_unique"),
        schema="negentropy",
    )
    op.create_index("ix_skills_owner", "skills", ["owner_id"], schema="negentropy")
    op.create_index("ix_skills_category", "skills", ["category"], schema="negentropy")

    # ==========================================================================
    # SubAgents 表
    # ==========================================================================
    op.create_table(
        "sub_agents",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        # Ownership and visibility
        sa.Column("owner_id", sa.String(255), nullable=False),
        sa.Column(
            "visibility",
            sa.Enum("private", "shared", "public", name="plugin_visibility"),
            nullable=False,
            server_default="private",
        ),
        # Basic info
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("agent_type", sa.String(100), nullable=False),
        # Agent config
        sa.Column("system_prompt", sa.Text(), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=True),
        sa.Column("skills", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=True),
        sa.Column("tools", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=True),
        # Status
        sa.Column("is_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="sub_agents_name_unique"),
        schema="negentropy",
    )
    op.create_index("ix_sub_agents_owner", "sub_agents", ["owner_id"], schema="negentropy")


def downgrade() -> None:
    """Drop plugins tables."""

    # Drop SubAgents
    op.drop_index("ix_sub_agents_owner", table_name="sub_agents", schema="negentropy")
    op.drop_table("sub_agents", schema="negentropy")

    # Drop Skills
    op.drop_index("ix_skills_category", table_name="skills", schema="negentropy")
    op.drop_index("ix_skills_owner", table_name="skills", schema="negentropy")
    op.drop_table("skills", schema="negentropy")

    # Drop MCP Tools
    op.drop_index("ix_mcp_tools_server_id", table_name="mcp_tools", schema="negentropy")
    op.drop_table("mcp_tools", schema="negentropy")

    # Drop MCP Servers
    op.drop_index("ix_mcp_servers_visibility", table_name="mcp_servers", schema="negentropy")
    op.drop_index("ix_mcp_servers_owner", table_name="mcp_servers", schema="negentropy")
    op.drop_table("mcp_servers", schema="negentropy")

    # Drop Plugin Permissions
    op.drop_index("ix_plugin_permissions_user", table_name="plugin_permissions", schema="negentropy")
    op.drop_index("ix_plugin_permissions_plugin", table_name="plugin_permissions", schema="negentropy")
    op.drop_table("plugin_permissions", schema="negentropy")

    # Drop enums (sa.Enum without schema= creates types in public schema)
    op.execute("DROP TYPE IF EXISTS plugin_visibility")
    op.execute("DROP TYPE IF EXISTS plugin_permission_type")
