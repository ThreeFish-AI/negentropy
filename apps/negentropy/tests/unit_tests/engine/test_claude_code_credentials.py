"""resolve_claude_code_credential 解析优先级单测。

锁定：UI credentials > 环境变量（CLAUDE_CODE_OAUTH_TOKEN / sk-ant- ANTHROPIC_API_KEY）> None；
脱敏占位值按「未配置」处理；AfterShip 32 位网关 key 不被误用。
"""

from __future__ import annotations

import pytest

from negentropy.engine.claude_code.credentials import resolve_claude_code_credential


@pytest.fixture(autouse=True)
def _clear_cc_env(monkeypatch):
    """隔离环境：清除可能影响判定的凭证类环境变量。"""
    monkeypatch.delenv("CLAUDE_CODE_OAUTH_TOKEN", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


def test_ui_oauth_token_wins():
    assert resolve_claude_code_credential({"oauth_token": "sk-ant-oat01-real"}) == "sk-ant-oat01-real"


def test_ui_api_key_used_when_no_oauth_token():
    assert resolve_claude_code_credential({"api_key": "sk-ant-api03-real"}) == "sk-ant-api03-real"


def test_ui_oauth_token_preferred_over_api_key():
    creds = {"oauth_token": "tok-oauth", "api_key": "sk-ant-api03-x"}
    assert resolve_claude_code_credential(creds) == "tok-oauth"


def test_masked_value_treated_as_unconfigured(monkeypatch):
    """前端回传脱敏占位（含 ****）应视为未配置，回退环境/None，绝不出示脱敏串。"""
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "env-oauth-token")
    assert resolve_claude_code_credential({"oauth_token": "sk-a****real"}) == "env-oauth-token"


def test_env_oauth_token_fallback(monkeypatch):
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "env-oauth-token")
    assert resolve_claude_code_credential(None) == "env-oauth-token"
    assert resolve_claude_code_credential({}) == "env-oauth-token"


def test_env_anthropic_api_key_only_when_real_sk_ant(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-api03-fromenv")
    assert resolve_claude_code_credential(None) == "sk-ant-api03-fromenv"


def test_env_gateway_key_is_rejected(monkeypatch):
    """AfterShip 32 位网关 key（非 sk-ant-）不可用作 CC 凭证，避免根 failover tier 401。"""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "0f12ec02e91345bb82d14a91b9bea8ca")
    assert resolve_claude_code_credential(None) is None


def test_no_source_returns_none():
    assert resolve_claude_code_credential(None) is None
    assert resolve_claude_code_credential({}) is None
    assert resolve_claude_code_credential({"oauth_token": "", "api_key": "   "}) is None


def test_oauth_token_env_precedes_api_key_env(monkeypatch):
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "env-oauth")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-api03-x")
    assert resolve_claude_code_credential(None) == "env-oauth"
