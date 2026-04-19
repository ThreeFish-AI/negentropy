"""单元测试：Admin → Models → Ping 对 litellm kwargs 的组装行为。

关键不变量：
- Gemini 官方默认 `api_base` 被归一化为 None，避免 litellm 1.83.x 漏掉 `/v1beta/`。
- 其它 vendor（OpenAI/Anthropic）`api_base` 恒等透传。
- 始终注入 `drop_params=True`。
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.auth.api import _ping_llm


def _mock_response(content: str = "pong") -> MagicMock:
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = content
    return response


@pytest.mark.asyncio
async def test_ping_gemini_default_host_strips_api_base():
    fake_acompletion = AsyncMock(return_value=_mock_response())
    with patch("litellm.acompletion", new=fake_acompletion):
        await _ping_llm(
            model="gemini/gemini-2.5-flash",
            api_key="sk-test",
            api_base="https://generativelanguage.googleapis.com",
        )
    kwargs = fake_acompletion.await_args.kwargs
    assert kwargs["model"] == "gemini/gemini-2.5-flash"
    assert kwargs["api_key"] == "sk-test"
    assert "api_base" not in kwargs, "Gemini 官方域名应被归一化为 None 以放行 litellm 内置 /v1beta/ URL"
    assert kwargs["drop_params"] is True
    assert kwargs["max_tokens"] == 20


@pytest.mark.asyncio
async def test_ping_gemini_custom_proxy_appends_v1beta():
    fake_acompletion = AsyncMock(return_value=_mock_response())
    with patch("litellm.acompletion", new=fake_acompletion):
        await _ping_llm(
            model="gemini/gemini-2.5-flash",
            api_key="sk-test",
            api_base="https://my-gateway.local",
        )
    kwargs = fake_acompletion.await_args.kwargs
    assert kwargs["api_base"] == "https://my-gateway.local/v1beta"


@pytest.mark.asyncio
async def test_ping_openai_identity_passthrough():
    fake_acompletion = AsyncMock(return_value=_mock_response())
    with patch("litellm.acompletion", new=fake_acompletion):
        await _ping_llm(
            model="openai/gpt-4o-mini",
            api_key="sk-test",
            api_base="https://api.openai.com/v1",
        )
    kwargs = fake_acompletion.await_args.kwargs
    assert kwargs["api_base"] == "https://api.openai.com/v1"
    assert kwargs["drop_params"] is True


@pytest.mark.asyncio
async def test_ping_no_api_base_omits_key():
    fake_acompletion = AsyncMock(return_value=_mock_response())
    with patch("litellm.acompletion", new=fake_acompletion):
        await _ping_llm(
            model="gemini/gemini-2.5-flash",
            api_key="sk-test",
            api_base=None,
        )
    kwargs = fake_acompletion.await_args.kwargs
    assert "api_base" not in kwargs
    assert kwargs["drop_params"] is True


@pytest.mark.asyncio
async def test_ping_returns_pong_message():
    fake_acompletion = AsyncMock(return_value=_mock_response("  pong, here to serve.  "))
    with patch("litellm.acompletion", new=fake_acompletion):
        result = await _ping_llm(
            model="gemini/gemini-2.5-flash",
            api_key="sk-test",
            api_base="https://generativelanguage.googleapis.com",
        )
    assert result["status"] == "ok"
    assert result["message"].startswith("Pong! ")
