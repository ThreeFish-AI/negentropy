"""创建 builtin_tools 表并种子化 google_search 工具

Revision ID: 0031
Revises: 0030
Create Date: 2026-05-11 00:00:00.000000+00:00

设计动机：
  将 Google Search 等内置工具的配置从 config.default.yaml + 环境变量
  迁移至数据库驱动，支持 UI 管理 + SubAgent/Skill 动态挂载。

  种子化步骤读取环境变量 NE_SEARCH_GOOGLE_API_KEY / NE_SEARCH_GOOGLE_CX_ID，
  自动迁移现有部署的凭证到 builtin_tools 表（ON CONFLICT DO NOTHING 保证幂等）。
"""

import os
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0031"
down_revision: str | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"

# Google Search 工具的 config_schema，供 UI 动态渲染表单
GOOGLE_SEARCH_CONFIG_SCHEMA = {
    "config": {
        "cx_id": {
            "type": "string",
            "title": "Custom Search Engine ID",
            "description": "Google Programmable Search Engine CX ID",
        },
        "max_retries": {
            "type": "integer",
            "title": "Max Retries",
            "default": 3,
            "minimum": 0,
            "maximum": 10,
        },
        "timeout_seconds": {
            "type": "number",
            "title": "Timeout (seconds)",
            "default": 10.0,
            "minimum": 1.0,
            "maximum": 60.0,
        },
        "base_backoff_seconds": {
            "type": "number",
            "title": "Base Backoff (seconds)",
            "default": 1.0,
            "minimum": 0.1,
        },
        "max_results": {
            "type": "integer",
            "title": "Max Results",
            "default": 10,
            "minimum": 1,
            "maximum": 100,
        },
    },
    "credentials": {
        "api_key": {
            "type": "password",
            "title": "Google API Key",
            "description": "Google Cloud API Key for Custom Search API",
            "required": True,
        },
    },
}


def upgrade() -> None:
    op.execute(
        sa.text(f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.builtin_tools (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id VARCHAR(255) NOT NULL,
            visibility VARCHAR(20) NOT NULL DEFAULT 'private',
            name VARCHAR(255) NOT NULL,
            display_name VARCHAR(255),
            description TEXT,
            tool_type VARCHAR(50) NOT NULL,
            version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
            config JSONB NOT NULL DEFAULT '{{}}'::jsonb,
            credentials JSONB NOT NULL DEFAULT '{{}}'::jsonb,
            config_schema JSONB NOT NULL DEFAULT '{{}}'::jsonb,
            is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            is_system BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT builtin_tools_name_unique UNIQUE (name)
        )
    """)
    )

    op.execute(sa.text(f"CREATE INDEX IF NOT EXISTS ix_builtin_tools_owner ON {SCHEMA}.builtin_tools (owner_id)"))
    op.execute(sa.text(f"CREATE INDEX IF NOT EXISTS ix_builtin_tools_tool_type ON {SCHEMA}.builtin_tools (tool_type)"))

    # 种子化 google_search：从环境变量读取凭证
    api_key = os.environ.get("NE_SEARCH_GOOGLE_API_KEY", "")
    cx_id = os.environ.get("NE_SEARCH_GOOGLE_CX_ID", "")

    config = {
        "cx_id": cx_id or "d5ee76f9215be4ee9",
        "max_retries": 3,
        "timeout_seconds": 10.0,
        "base_backoff_seconds": 1.0,
        "max_results": 10,
    }
    credentials = {"api_key": api_key} if api_key else {}
    config_schema = GOOGLE_SEARCH_CONFIG_SCHEMA

    op.execute(
        sa.text(
            f"""
        INSERT INTO {SCHEMA}.builtin_tools
            (owner_id, visibility, name, display_name, description,
             tool_type, version, config, credentials, config_schema,
             is_enabled, is_system)
        VALUES (
            'system', 'public', 'google_search', 'Google Search',
            'Web search via Google Custom Search API. Provides real-time web search capabilities for agents.',
            'search', '1.0.0',
            :config, :credentials, :config_schema,
            TRUE, TRUE
        )
        ON CONFLICT (name) DO NOTHING
    """
        ).bindparams(
            sa.bindparam("config", value=config, type_=sa.dialects.postgresql.JSONB),
            sa.bindparam("credentials", value=credentials, type_=sa.dialects.postgresql.JSONB),
            sa.bindparam("config_schema", value=config_schema, type_=sa.dialects.postgresql.JSONB),
        )
    )


def downgrade() -> None:
    op.execute(sa.text(f"DROP TABLE IF EXISTS {SCHEMA}.builtin_tools CASCADE"))
