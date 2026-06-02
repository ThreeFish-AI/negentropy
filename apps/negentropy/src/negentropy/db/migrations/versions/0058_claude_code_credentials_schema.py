"""Declare claude_code config_schema.credentials.oauth_token field for Tools UI

Revision ID: 0058
Revises: 0057
Create Date: 2026-06-02 00:00:00.000000+00:00

设计动机：
    修复 Routine 调用 Claude Code 的 529→401 鉴权失败（详见
    ``engine/claude_code/credentials.py``）。Claude Code 子进程过去未注入真实 Anthropic
    凭证，headless 场景回退交互式登录态失败，致 coding-proxy 的 failover anthropic tier
    转发空凭证 → 401。

    修复需运维在 Interface → Tools → Claude Code 填入「真实 Anthropic 凭证」
    （``claude setup-token`` 长期令牌，或真实 ``sk-ant-`` API Key），存于
    ``builtin_tools.claude_code.credentials.oauth_token``。本迁移仅为既有
    ``claude_code`` 行的 ``config_schema.credentials`` **声明该字段定义**，使
    ``ToolFormDialog`` 动态渲染出对应（password 脱敏）输入框。

    迁移 0039 以 ``ON CONFLICT (name) DO NOTHING`` 种子化该行，故更新 0039 常量不会回灌
    既有行——必须由本迁移幂等补声明。

幂等 / 非破坏性：
    - 仅 ``jsonb_set`` 覆盖 ``config_schema -> 'credentials'``（字段「定义」），
      **不触碰 ``credentials`` 列**（用户已填的真实凭证值），不删除任何数据。
    - 多次执行结果一致。
"""

import sqlalchemy as sa
from alembic import op

revision = "0058"
down_revision = "0057"
branch_labels = None
depends_on = None

SCHEMA = "negentropy"

# 与 0039 的 CLAUDE_CODE_CONFIG_SCHEMA["credentials"] 保持一致（单一事实源：UI 字段定义）。
# 注：本迁移落库的 description 文案后由 0060 修正（sk-ant-oat/sk-ant-api 区分）；此处保留历史原值，
# 由 0060 幂等覆盖既有行——勿改动已应用迁移的落库内容。
_CREDENTIALS_SCHEMA = {
    "oauth_token": {
        "type": "password",
        "title": "Claude Code OAuth Token",
        "description": (
            "claude.ai 订阅长期令牌（`claude setup-token` 生成，注入为 Bearer）；"
            "亦可填真实 `sk-ant-` API Key（注入为 x-api-key）。留空则回退环境变量 / 交互式登录态。"
        ),
    },
}


def upgrade() -> None:
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
            sa.bindparam("cred_schema", value=_CREDENTIALS_SCHEMA, type_=sa.dialects.postgresql.JSONB),
        )
    )


def downgrade() -> None:
    # 回退为空 credentials 占位（与 0039 原始语义一致）；不删除 credentials 列中的存储凭证值。
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.builtin_tools
            SET config_schema = jsonb_set(
                COALESCE(config_schema, '{{}}'::jsonb),
                '{{credentials}}',
                '{{}}'::jsonb,
                true
            )
            WHERE name = 'claude_code' AND owner_id = 'system'
            """
        )
    )
