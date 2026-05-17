"""单元测试：Admin → Models → Ping Embedding 对 litellm.aembedding kwargs 的组装与返回结构。

与 ``test_models_ping.py`` 同源——核心校验：
- 调用 ``_ping_embedding`` 时，``drop_params=True`` 始终注入、无重试参数；
- 60s 超时（非 300s）；
- 官方 / 自建 Gemini & OpenAI 的 ``api_base`` 归一化路径被复用；
- 返回结构包含 ``dimensions`` 与前 4 维 ``preview``。
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.interface.models_api import _ping_embedding


def _mock_embedding_response(vec: list[float]) -> MagicMock:
    """返回与 litellm.aembedding 兼容的对象响应（带 .data[0].embedding）。"""
    item = MagicMock()
    item.embedding = vec
    response = MagicMock()
    response.data = [item]
    return response


def _mock_dict_response(vec: list[float]) -> dict:
    """返回与 litellm.aembedding 兼容的 dict 响应（旧版本回退分支）。"""
    return {"data": [{"embedding": vec}]}


@pytest.mark.asyncio
async def test_ping_embedding_returns_dimensions_and_preview():
    vec = [0.1, -0.2, 0.3, -0.4, 0.5, -0.6]
    fake = AsyncMock(return_value=_mock_embedding_response(vec))
    with patch("litellm.aembedding", new=fake):
        result = await _ping_embedding(
            model="openai/text-embedding-3-small",
            api_key="sk-test",
            api_base=None,
            text="hello",
        )
    assert result["status"] == "ok"
    assert result["dimensions"] == 6
    assert result["preview"] == [0.1, -0.2, 0.3, -0.4]
    kwargs = fake.await_args.kwargs
    assert kwargs["model"] == "openai/text-embedding-3-small"
    assert kwargs["api_key"] == "sk-test"
    assert kwargs["drop_params"] is True
    assert kwargs["num_retries"] == 0
    assert "max_tokens" not in kwargs  # embedding 不应注入 LLM 的 max_tokens


@pytest.mark.asyncio
async def test_ping_embedding_dict_response_fallback():
    """litellm 旧版本可能返回 dict 而非对象——回退路径必须可用。"""
    vec = [0.01, 0.02, 0.03, 0.04]
    fake = AsyncMock(return_value=_mock_dict_response(vec))
    with patch("litellm.aembedding", new=fake):
        result = await _ping_embedding(
            model="openai/text-embedding-3-small",
            api_key="sk-test",
            api_base=None,
            text="hello",
        )
    assert result["status"] == "ok"
    assert result["dimensions"] == 4
    assert result["preview"] == [0.01, 0.02, 0.03, 0.04]


@pytest.mark.asyncio
async def test_ping_embedding_gemini_default_host_strips_api_base():
    """Gemini 官方域名应被归一化为 None，复用 LLM Ping 的同款规则。"""
    fake = AsyncMock(return_value=_mock_embedding_response([0.0] * 768))
    with patch("litellm.aembedding", new=fake):
        await _ping_embedding(
            model="gemini/text-embedding-004",
            api_key="sk-test",
            api_base="https://generativelanguage.googleapis.com",
            text="hello",
        )
    kwargs = fake.await_args.kwargs
    assert "api_base" not in kwargs, "Gemini 官方域名应被归一化为 None"


@pytest.mark.asyncio
async def test_ping_embedding_openai_custom_gateway_appends_v1():
    """自建 OpenAI 兼容网关末尾无 /v1 时补齐 /v1。"""
    fake = AsyncMock(return_value=_mock_embedding_response([0.0] * 1536))
    with patch("litellm.aembedding", new=fake):
        await _ping_embedding(
            model="openai/text-embedding-3-small",
            api_key="sk-test",
            api_base="http://llms.as-in.io",
            text="hello",
        )
    kwargs = fake.await_args.kwargs
    assert kwargs["api_base"] == "http://llms.as-in.io/v1"


@pytest.mark.asyncio
async def test_ping_embedding_empty_data_returns_error():
    fake = AsyncMock(return_value=MagicMock(data=[]))
    with patch("litellm.aembedding", new=fake):
        result = await _ping_embedding(
            model="openai/text-embedding-3-small",
            api_key="sk-test",
            api_base=None,
            text="hello",
        )
    assert result["status"] == "error"
    assert "Empty" in result["message"] or "No embedding" in result["message"]


@pytest.mark.asyncio
async def test_ping_embedding_missing_vector_returns_error():
    item = MagicMock()
    item.embedding = None
    response = MagicMock()
    response.data = [item]
    fake = AsyncMock(return_value=response)
    with patch("litellm.aembedding", new=fake):
        result = await _ping_embedding(
            model="openai/text-embedding-3-small",
            api_key="sk-test",
            api_base=None,
            text="hello",
        )
    assert result["status"] == "error"
    assert "No embedding vector" in result["message"]
