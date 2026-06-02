"""Fix claude_code credential field hint：区分 sk-ant-api（x-api-key）与 sk-ant-oat（Bearer）

Revision ID: 0060
Revises: 0059
Create Date: 2026-06-02 00:00:00.000000+00:00

设计动机：
    迁移 0058 落库的 ``config_schema.credentials.oauth_token`` 提示文案把任意 ``sk-ant-``
    凭证笼统描述为「注入为 x-api-key 的 API Key」。但 ``claude setup-token`` 生成的
    claude.ai 订阅令牌前缀为 ``sk-ant-oat…``，与 Console API Key（``sk-ant-api…``）认证机制不同：

      - ``sk-ant-api…`` Console API Key → ``x-api-key`` 头（``ANTHROPIC_API_KEY``）；
      - ``sk-ant-oat…`` 订阅 OAuth 令牌  → ``Authorization: Bearer`` 头（``ANTHROPIC_AUTH_TOKEN``）。

    旧文案导致运维误以为填 ``sk-ant-oat…`` 令牌即可，且配套的凭证注入逻辑曾用 ``sk-ant-``
    笼统前缀把 OAuth 令牌误判为 x-api-key（已在 ``engine/claude_code/credentials.py::
    is_console_api_key`` 与 ``service._credential_env`` 修正）。本迁移同步修正 UI 提示文案与
    字段标题，使其与注入逻辑一致。

    迁移 0039/0058 已 seed/声明该字段，故更新源常量不会回灌既有行——必须由本迁移幂等覆盖。

幂等 / 非破坏性：
    - 仅 ``jsonb_set`` 覆盖 ``config_schema -> 'credentials'``（字段「定义」），
      **不触碰 ``credentials`` 列**（用户已填的真实凭证值），不删除任何数据。
    - 多次执行结果一致。
"""

import sqlalchemy as sa
from alembic import op

revision = "0060"
down_revision = "0059"
branch_labels = None
depends_on = None

SCHEMA = "negentropy"

# 修正后的字段定义：标题改为中性「Credential」，文案明确区分两类凭证及各自注入头。
_CREDENTIALS_SCHEMA = {
    "oauth_token": {
        "type": "password",
        "title": "Claude Code Credential",
        "description": (
            "填 Console API Key（`sk-ant-api…`，console.anthropic.com 签发，注入为 x-api-key），"
            "或 claude.ai 订阅令牌（`sk-ant-oat…`，`claude setup-token` 生成，注入为 Bearer）。"
            "留空则回退环境变量 / 交互式登录态。"
        ),
    },
}

# 0058 的原始定义（供 downgrade 还原）。
_CREDENTIALS_SCHEMA_PREV = {
    "oauth_token": {
        "type": "password",
        "title": "Claude Code OAuth Token",
        "description": (
            "claude.ai 订阅长期令牌（`claude setup-token` 生成，注入为 Bearer）；"
            "亦可填真实 `sk-ant-` API Key（注入为 x-api-key）。留空则回退环境变量 / 交互式登录态。"
        ),
    },
}


def _set_credentials_schema(value: dict) -> None:
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.builtin_tools
            SET config_schema = jsonb_set(
                COALESCE(config_schema, '{{}}'::jsonb),
                '{{credentials}}',
                :cred_schema,
                true
            )
            WHERE name = 'claude_code' AND owner_id = 'system'
            """
        ).bindparams(
            sa.bindparam("cred_schema", value=value, type_=sa.dialects.postgresql.JSONB),
        )
    )


def upgrade() -> None:
    _set_credentials_schema(_CREDENTIALS_SCHEMA)


def downgrade() -> None:
    _set_credentials_schema(_CREDENTIALS_SCHEMA_PREV)
