"""build_ping_llm_kwargs / normalize_api_base 单元测试。

覆盖点：
- drop_params=True 默认注入，保障 gpt-5 / o-系对不兼容参数的降级；
- temperature 不被注入（Ping 语义故意避让模型特定约束）；
- OpenAI / Anthropic / Gemini vendor 专属适配；
- 表单覆盖 > vendor_config 的优先级；
- api_base 尾部 `/chat/completions`、`/messages`、多余 `/` 的防御性规范化；
- max_tokens=None 时完全不下传该键。
"""

from __future__ import annotations

from negentropy.config.model_resolver import build_ping_llm_kwargs, normalize_api_base


class TestNormalizeApiBase:
    def test_returns_none_for_none(self) -> None:
        assert normalize_api_base(None) is None

    def test_returns_none_for_blank(self) -> None:
        assert normalize_api_base("") is None
        assert normalize_api_base("   ") is None

    def test_idempotent_on_valid_base(self) -> None:
        assert normalize_api_base("https://api.openai.com/v1") == "https://api.openai.com/v1"
        assert normalize_api_base("http://llms.as-in.io/v1") == "http://llms.as-in.io/v1"

    def test_strips_chat_completions_suffix(self) -> None:
        assert normalize_api_base("http://llms.as-in.io/v1/chat/completions") == "http://llms.as-in.io/v1"

    def test_strips_messages_suffix(self) -> None:
        assert normalize_api_base("https://api.anthropic.com/v1/messages") == "https://api.anthropic.com"

    def test_strips_trailing_slash(self) -> None:
        assert normalize_api_base("https://api.openai.com/v1/") == "https://api.openai.com/v1"
        assert normalize_api_base("https://api.openai.com/v1///") == "https://api.openai.com/v1"

    def test_strips_composed_suffix_then_slash(self) -> None:
        assert normalize_api_base("http://x/v1/chat/completions/") == "http://x/v1"

    def test_strips_whitespace(self) -> None:
        assert normalize_api_base("  https://api.openai.com/v1  ") == "https://api.openai.com/v1"


class TestBuildPingLlmKwargsOpenAI:
    def test_defaults_include_drop_params_and_max_tokens(self) -> None:
        kwargs = build_ping_llm_kwargs(
            "openai",
            "gpt-5-mini",
            api_key_override="sk-test",
            api_base_override="http://llms.as-in.io/v1",
        )
        assert kwargs["drop_params"] is True
        assert kwargs["max_tokens"] == 20
        assert kwargs["api_key"] == "sk-test"
        assert kwargs["api_base"] == "http://llms.as-in.io/v1"

    def test_does_not_inject_temperature(self) -> None:
        kwargs = build_ping_llm_kwargs("openai", "gpt-5-mini", api_key_override="sk")
        assert "temperature" not in kwargs

    def test_non_o_series_has_no_reasoning_effort(self) -> None:
        kwargs = build_ping_llm_kwargs("openai", "gpt-5-mini", api_key_override="sk")
        assert "reasoning_effort" not in kwargs

    def test_max_tokens_none_drops_key(self) -> None:
        kwargs = build_ping_llm_kwargs(
            "openai",
            "gpt-5-mini",
            api_key_override="sk",
            max_tokens=None,
        )
        assert "max_tokens" not in kwargs

    def test_api_base_normalization_happens(self) -> None:
        kwargs = build_ping_llm_kwargs(
            "openai",
            "gpt-5-mini",
            api_key_override="sk",
            api_base_override="http://llms.as-in.io/v1/chat/completions",
        )
        assert kwargs["api_base"] == "http://llms.as-in.io/v1"

    def test_override_wins_over_vendor_config(self) -> None:
        kwargs = build_ping_llm_kwargs(
            "openai",
            "gpt-5-mini",
            api_key_override="sk-from-form",
            api_base_override="http://form/v1",
            vendor_config={"api_key": "sk-from-db", "api_base": "http://db/v1"},
        )
        assert kwargs["api_key"] == "sk-from-form"
        assert kwargs["api_base"] == "http://form/v1"

    def test_vendor_config_used_when_no_override(self) -> None:
        kwargs = build_ping_llm_kwargs(
            "openai",
            "gpt-5-mini",
            vendor_config={"api_key": "sk-db", "api_base": "http://db/v1"},
        )
        assert kwargs["api_key"] == "sk-db"
        assert kwargs["api_base"] == "http://db/v1"


class TestBuildPingLlmKwargsAnthropic:
    def test_disables_thinking_by_default(self) -> None:
        kwargs = build_ping_llm_kwargs(
            "anthropic",
            "claude-sonnet-4",
            api_key_override="sk-ant",
        )
        assert kwargs["thinking"] == {"type": "disabled"}
        assert kwargs["drop_params"] is True
        assert kwargs["max_tokens"] == 20
        assert "temperature" not in kwargs


class TestBuildPingLlmKwargsGemini:
    def test_no_vendor_specific_params(self) -> None:
        kwargs = build_ping_llm_kwargs(
            "gemini",
            "gemini-2.5-flash",
            api_key_override="g-key",
        )
        assert kwargs["drop_params"] is True
        assert kwargs["api_key"] == "g-key"
        assert "thinking" not in kwargs
        assert "reasoning_effort" not in kwargs
        assert "temperature" not in kwargs
