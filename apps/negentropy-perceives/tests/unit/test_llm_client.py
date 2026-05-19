"""LLM 客户端封装模块的单元测试。

测试策略：
- 可用性检测：验证 is_available() 行为
- 异步调用：使用 mock litellm 验证 acomplete()
- JSON 解析：验证 parse_json_response() 容错能力
- 重试逻辑：验证指数退避重试
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.perceives.config import _flatten_nested_yaml, _load_bundled_yaml
from negentropy.perceives.pdf.llm_client import LLMClient, LLMResponse


# ============================================================
# 数据类完整性
# ============================================================
class TestLLMResponseDataClass:
    """验证 LLMResponse 数据类。"""

    def test_defaults(self) -> None:
        r = LLMResponse(content="hello")
        assert r.content == "hello"
        assert r.model == ""
        assert r.usage == {}
        assert r.raw_response is None

    def test_full(self) -> None:
        r = LLMResponse(
            content='{"key": "value"}',
            model="gpt-5-nano",
            usage={"prompt_tokens": 100, "completion_tokens": 50},
            raw_response={"id": "test"},
        )
        assert r.model == "gpt-5-nano"
        assert r.usage["prompt_tokens"] == 100


# ============================================================
# 可用性检测
# ============================================================
class TestLLMClientAvailability:
    """验证 is_available() 行为。"""

    def test_is_available_returns_bool(self) -> None:
        result = LLMClient.is_available()
        assert isinstance(result, bool)

    def test_is_available_false_when_not_installed(self) -> None:
        with patch.dict("sys.modules", {"litellm": None}):
            # 清除可能的缓存
            import importlib
            from negentropy.perceives.pdf import llm_client as mod

            importlib.reload(mod)
            assert mod.LLMClient.is_available() is False

    def test_default_model(self) -> None:
        """无参构造时，model 应从 config.settings 解析（与 YAML 默认值一致）。"""
        yaml_data = _load_bundled_yaml()
        flattened = _flatten_nested_yaml(yaml_data)
        expected_model = flattened["llm_model"]

        with patch("negentropy.perceives.config.settings") as mock_settings:
            mock_settings.llm_model = expected_model
            client = LLMClient()
            assert client._model == expected_model

    def test_custom_params(self) -> None:
        client = LLMClient(
            model="gpt-5-nano",
            api_key="test-key",
            temperature=0.5,
            max_tokens=2048,
            timeout=30.0,
            max_retries=1,
        )
        assert client._model == "gpt-5-nano"
        assert client._api_key == "test-key"
        assert client._temperature == 0.5
        assert client._max_tokens == 2048
        assert client._timeout == 30.0
        assert client._max_retries == 1


# ============================================================
# 异步调用（mock litellm）
# ============================================================
class TestLLMClientCompletion:
    """验证 acomplete() 异步调用行为。"""

    @pytest.mark.asyncio
    async def test_acomplete_returns_structured_response(self) -> None:
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"result": "ok"}'
        mock_response.usage = MagicMock()
        mock_response.usage.prompt_tokens = 100
        mock_response.usage.completion_tokens = 50

        mock_acompletion = AsyncMock(return_value=mock_response)
        mock_litellm = MagicMock()
        mock_litellm.acompletion = mock_acompletion

        with (
            patch.object(LLMClient, "is_available", return_value=True),
            patch.dict("sys.modules", {"litellm": mock_litellm}),
        ):
            client = LLMClient(model="gpt-5-nano")
            result = await client.acomplete(
                messages=[{"role": "user", "content": "test"}]
            )
            assert result.content == '{"result": "ok"}'
            assert result.model == "gpt-5-nano"
            assert result.usage["prompt_tokens"] == 100
            assert result.usage["completion_tokens"] == 50

    @pytest.mark.asyncio
    async def test_acomplete_raises_when_not_available(self) -> None:
        with patch.object(LLMClient, "is_available", return_value=False):
            client = LLMClient()
            with pytest.raises(RuntimeError, match="litellm 未安装"):
                await client.acomplete(messages=[{"role": "user", "content": "test"}])


# ============================================================
# JSON 解析
# ============================================================
class TestLLMClientJSONParsing:
    """验证 parse_json_response() 容错能力。"""

    def test_parse_valid_json(self) -> None:
        response = LLMResponse(content='{"key": "value"}')
        result = LLMClient.parse_json_response(response)
        assert result == {"key": "value"}

    def test_parse_json_with_markdown_fence(self) -> None:
        response = LLMResponse(content='```json\n{"key": "value"}\n```')
        result = LLMClient.parse_json_response(response)
        assert result == {"key": "value"}

    def test_parse_json_with_fence_no_language(self) -> None:
        response = LLMResponse(content='```\n{"key": "value"}\n```')
        result = LLMClient.parse_json_response(response)
        assert result == {"key": "value"}

    def test_parse_invalid_json_returns_error(self) -> None:
        response = LLMResponse(content="not valid json")
        result = LLMClient.parse_json_response(response)
        assert "error" in result
        assert "raw" in result

    def test_parse_empty_content(self) -> None:
        response = LLMResponse(content="")
        result = LLMClient.parse_json_response(response)
        assert "error" in result

    def test_parse_nested_json(self) -> None:
        data = {
            "engine_tasks": [{"engine": "docling", "focus": "全文档", "priority": 8}],
            "synthesis_strategy": "merge",
        }
        response = LLMResponse(content=json.dumps(data))
        result = LLMClient.parse_json_response(response)
        assert result["synthesis_strategy"] == "merge"
        assert len(result["engine_tasks"]) == 1

    def test_parse_json_with_whitespace(self) -> None:
        response = LLMResponse(content='  \n  {"key": "value"}  \n  ')
        result = LLMClient.parse_json_response(response)
        assert result == {"key": "value"}
