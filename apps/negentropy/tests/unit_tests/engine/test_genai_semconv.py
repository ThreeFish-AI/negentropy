"""P3-3 · OTel GenAI Semantic Conventions 单测。

验证：
- extract_vendor 把模型名前缀映射到正确 system（vendor 单一事实源已下沉到
  ``negentropy.model_names``，`instrumentation` 仅作 OTel 注入）；
- _apply_model_normalization 统一写入模型名归一化 + cost 属性；
- _inject_genai_semconv_attrs 写入非模型 GenAI semconv 标准属性；
- fail-soft：缺字段 / 异常 / 不可写 span 都不抛。
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

# ----------------------------------------------------------------------------
# extract_vendor（取代历史上的 instrumentation._detect_genai_system）
# ----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "model,expected",
    [
        ("gpt-5.4-turbo", "openai"),
        ("o1-mini", "openai"),
        ("openai/gpt-4o", "openai"),
        ("claude-opus-4-7", "anthropic"),
        ("anthropic/claude-haiku-4-5", "anthropic"),
        ("gemini-2.5-pro", "gemini"),
        ("gemini/gemini-flash", "gemini"),
        ("vertex_ai/gemini-pro", "vertex_ai"),
        ("mistral/mistral-large", "mistral"),
        ("cohere/command-r", "cohere"),
        ("llama-3.1-70b", "meta"),
        ("ollama/llama3", "ollama"),
        ("groq/llama-3", "groq"),
        ("deepseek/deepseek-chat", "deepseek"),
    ],
)
def test_extract_vendor_known_prefixes(model: str, expected: str) -> None:
    from negentropy.model_names import extract_vendor

    assert extract_vendor(model) == expected


@pytest.mark.parametrize("model", ["", None, "unknown-vendor/foo", "totally-made-up-model"])
def test_extract_vendor_unknown_returns_none(model: str | None) -> None:
    from negentropy.model_names import extract_vendor

    assert extract_vendor(model) is None


# ----------------------------------------------------------------------------
# _inject_genai_semconv_attrs
# ----------------------------------------------------------------------------


def _make_writable_span() -> Any:
    """构造能记录 attribute 调用的 mock span。"""
    span = MagicMock()
    span.is_recording.return_value = True
    span._captured: dict[str, Any] = {}

    def _set(key: str, value: Any) -> None:
        span._captured[key] = value

    span.set_attribute.side_effect = _set
    return span


def _make_response_obj(
    *, model: str | None, usage: dict | None, response_id: str | None, finish_reasons: list[str]
) -> Any:
    """模拟 LiteLLM ModelResponse — 既支持 .get() 也支持 attribute 访问。"""
    obj = MagicMock()

    data: dict[str, Any] = {}
    if model is not None:
        data["model"] = model
    if response_id is not None:
        data["id"] = response_id
    if finish_reasons:
        data["choices"] = [{"finish_reason": fr} for fr in finish_reasons]

    def _getter(key, default=None):
        return data.get(key, default)

    obj.get = _getter
    obj.model = model
    obj.id = response_id
    obj.choices = data.get("choices")

    if usage is not None:
        usage_mock = MagicMock()
        usage_mock.prompt_tokens = usage.get("prompt_tokens")
        usage_mock.completion_tokens = usage.get("completion_tokens")
        obj.usage = usage_mock
    else:
        obj.usage = None

    return obj


def test_inject_genai_full_attributes_for_anthropic_chat() -> None:
    from negentropy.instrumentation import _apply_model_normalization

    span = _make_writable_span()
    kwargs = {
        "model": "claude-opus-4-7",
        "temperature": 0.7,
        "top_p": 0.95,
        "max_tokens": 4096,
    }
    response = _make_response_obj(
        model="claude-opus-4-7",
        usage={"prompt_tokens": 120, "completion_tokens": 360},
        response_id="msg_01abc",
        finish_reasons=["stop"],
    )

    _apply_model_normalization(span, kwargs, response)

    captured = span._captured
    assert captured["gen_ai.system"] == "anthropic"
    assert captured["gen_ai.operation.name"] == "chat"
    assert captured["gen_ai.request.model"] == "anthropic/claude-opus-4-7"
    assert captured["gen_ai.response.model"] == "anthropic/claude-opus-4-7"
    assert captured["gen_ai.request.temperature"] == 0.7
    assert captured["gen_ai.request.top_p"] == 0.95
    assert captured["gen_ai.request.max_tokens"] == 4096
    assert captured["gen_ai.usage.input_tokens"] == 120
    assert captured["gen_ai.usage.output_tokens"] == 360
    assert captured["gen_ai.response.id"] == "msg_01abc"
    assert captured["gen_ai.response.finish_reasons"] == ["stop"]


def test_inject_genai_skips_unknown_system() -> None:
    """未知 vendor 应跳过 gen_ai.system，但仍写入其它字段。"""
    from negentropy.instrumentation import _inject_genai_semconv_attrs

    span = _make_writable_span()
    kwargs = {"model": "totally-made-up"}
    response = _make_response_obj(
        model="totally-made-up",
        usage={"prompt_tokens": 10, "completion_tokens": 5},
        response_id=None,
        finish_reasons=[],
    )

    _inject_genai_semconv_attrs(span, kwargs, response)

    captured = span._captured
    assert "gen_ai.system" not in captured
    assert captured["gen_ai.operation.name"] == "chat"
    assert captured["gen_ai.usage.input_tokens"] == 10


def test_inject_genai_handles_missing_usage_and_choices() -> None:
    """response 无 usage / choices 时不抛，仅写出存在字段。"""
    from negentropy.instrumentation import _apply_model_normalization

    span = _make_writable_span()
    kwargs = {"model": "gpt-5.4-turbo"}
    response = _make_response_obj(
        model="gpt-5.4-turbo",
        usage=None,
        response_id=None,
        finish_reasons=[],
    )

    _apply_model_normalization(span, kwargs, response)

    captured = span._captured
    assert captured["gen_ai.system"] == "openai"
    assert captured["gen_ai.operation.name"] == "chat"
    # 不存在的字段不应被强行写入
    assert "gen_ai.usage.input_tokens" not in captured
    assert "gen_ai.response.finish_reasons" not in captured


def test_inject_genai_skips_when_span_not_writable() -> None:
    """is_recording=False 的 span 不应被写入任何属性（lifecycle 一致性）。"""
    from negentropy.instrumentation import _inject_genai_semconv_attrs

    span = MagicMock()
    span.is_recording.return_value = False
    span._captured = {}
    span.set_attribute.side_effect = AssertionError("should not be called")

    kwargs = {"model": "gpt-4"}
    response = _make_response_obj(
        model="gpt-4",
        usage={"prompt_tokens": 1, "completion_tokens": 1},
        response_id="r",
        finish_reasons=["stop"],
    )

    # 不抛 + 不调用 set_attribute
    _inject_genai_semconv_attrs(span, kwargs, response)


def test_inject_genai_fail_soft_on_response_exception() -> None:
    """response_obj 访问抛异常时不应向上传播。"""
    from negentropy.instrumentation import _apply_model_normalization

    span = _make_writable_span()
    response = MagicMock()

    def _boom(*_args, **_kwargs):
        raise RuntimeError("simulated provider quirk")

    response.get = _boom
    response.usage = MagicMock()
    response.usage.prompt_tokens = 5
    response.usage.completion_tokens = 5

    # 不抛
    _apply_model_normalization(span, {"model": "gpt-4"}, response)
    # 仍能写入基础字段（system + operation.name）
    assert span._captured.get("gen_ai.system") == "openai"


def test_inject_genai_handles_none_span() -> None:
    """None span 应直接 return，不抛 AttributeError。"""
    from negentropy.instrumentation import _inject_genai_semconv_attrs

    _inject_genai_semconv_attrs(None, {"model": "gpt-4"}, None)


def test_inject_genai_sets_operation_name_embeddings() -> None:
    """Embedding 调用的 kwargs 应产出 ``gen_ai.operation.name = "embeddings"``。"""
    from negentropy.instrumentation import _apply_model_normalization

    span = _make_writable_span()
    kwargs = {
        "model": "gemini/text-embedding-004",
        "input": ["hello", "world"],
    }
    response = _make_response_obj(
        model="text-embedding-004",
        usage={"prompt_tokens": 8, "completion_tokens": 0},
        response_id=None,
        finish_reasons=[],
    )

    _apply_model_normalization(span, kwargs, response)

    captured = span._captured
    assert captured["gen_ai.operation.name"] == "embeddings"
    assert captured["gen_ai.system"] == "gemini"
