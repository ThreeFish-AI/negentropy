from negentropy.model_names import (
    canonicalize_model_name,
    extract_vendor,
    observability_model_name,
    pricing_lookup_model_name,
)

# ---------------------------------------------------------------------------
# 调度路径（保持现有契约）
# ---------------------------------------------------------------------------


def test_canonicalize_model_name_is_idempotent_noop():
    assert canonicalize_model_name("openai/gpt-5-mini") == "openai/gpt-5-mini"
    assert canonicalize_model_name("text-embedding-005") == "text-embedding-005"
    assert canonicalize_model_name("anthropic/claude-sonnet-4") == "anthropic/claude-sonnet-4"


def test_canonicalize_model_name_strips_whitespace():
    assert canonicalize_model_name("  openai/gpt-5-mini  ") == "openai/gpt-5-mini"


def test_canonicalize_model_name_handles_empty_input():
    assert canonicalize_model_name(None) is None
    assert canonicalize_model_name("") == ""


def test_pricing_lookup_model_name_strips_vendor_prefix():
    assert pricing_lookup_model_name("openai/gpt-5-mini") == "gpt-5-mini"
    assert pricing_lookup_model_name("anthropic/claude-sonnet-4") == "claude-sonnet-4"


def test_pricing_lookup_model_name_without_vendor_prefix():
    assert pricing_lookup_model_name("gpt-5-mini") == "gpt-5-mini"
    assert pricing_lookup_model_name("text-embedding-005") == "text-embedding-005"


def test_fallback_llm_config():
    from negentropy.config.model_resolver import get_fallback_llm_config

    name, kwargs = get_fallback_llm_config()
    assert name == "openai/gpt-5-mini"
    assert kwargs["temperature"] == 0.7
    assert kwargs["drop_params"] is True
    assert "extra_body" not in kwargs


def test_fallback_embedding_config():
    from negentropy.config.model_resolver import get_fallback_embedding_config

    name, kwargs = get_fallback_embedding_config()
    # Default switched to gemini/text-embedding-004 (768-dim, same as vertex_ai/text-embedding-005)
    # to align with vendor_configs-driven credentials. Override via NEGENTROPY_DEFAULT_EMBEDDING_MODEL.
    assert name == "gemini/text-embedding-004"
    assert kwargs == {}


# ---------------------------------------------------------------------------
# 观测路径：observability_model_name
# ---------------------------------------------------------------------------


def test_observability_model_name_handles_empty_input():
    assert observability_model_name(None) is None
    assert observability_model_name("") == ""
    # 全空白被 strip 后为空串：透传原值，避免误把 "   " 转成空触发上游兜底失败。
    assert observability_model_name("   ") == "   "


def test_observability_model_name_strips_vendor_prefix():
    assert observability_model_name("openai/gpt-5-mini") == "gpt-5-mini"
    assert observability_model_name("anthropic/claude-3-5-sonnet") == "claude-3-5-sonnet"
    assert observability_model_name("gemini/text-embedding-004") == "text-embedding-004"
    assert observability_model_name("vertex_ai/gemini-1.5-pro") == "gemini-1.5-pro"
    assert observability_model_name("deepseek/deepseek-chat") == "deepseek-chat"
    assert observability_model_name("ollama/llama-3-8b") == "llama-3-8b"


def test_observability_model_name_vendor_prefix_case_insensitive():
    # 大小写不敏感（实际 LiteLLM 内部统一小写，但保险起见兼容）。
    assert observability_model_name("Azure/gpt-4") == "gpt-4"
    assert observability_model_name("OpenAI/gpt-5-mini") == "gpt-5-mini"


def test_observability_model_name_strips_date_suffix():
    # OpenAI 风格：YYYY-MM-DD 后缀
    assert observability_model_name("gpt-5-mini-2025-08-07") == "gpt-5-mini"
    assert observability_model_name("gpt-4o-2024-08-06") == "gpt-4o"
    # Anthropic 风格：YYYYMMDD 后缀
    assert observability_model_name("claude-3-5-sonnet-20241022") == "claude-3-5-sonnet"
    assert observability_model_name("claude-3-opus-20240229") == "claude-3-opus"


def test_observability_model_name_combines_prefix_and_date_strip():
    # 前缀 + 日期联动：response.model 经常是 vendor 拼接 + 服务端版本号。
    assert observability_model_name("openai/gpt-5-mini-2025-08-07") == "gpt-5-mini"
    assert observability_model_name("anthropic/claude-3-5-sonnet-20241022") == "claude-3-5-sonnet"


def test_observability_model_name_does_not_strip_non_date_digits():
    # 不误伤本身带数字的模型名（关键不变量）。
    assert observability_model_name("gpt-4o-mini") == "gpt-4o-mini"
    assert observability_model_name("text-embedding-3-large") == "text-embedding-3-large"
    assert observability_model_name("o1-preview") == "o1-preview"
    assert observability_model_name("claude-3-5-sonnet") == "claude-3-5-sonnet"
    # 三/四位数字尾默认不剥（如 Gemini 1.5 Pro 002，未来如确需可加 alias map）。
    assert observability_model_name("gemini-1.5-pro-002") == "gemini-1.5-pro-002"


def test_observability_model_name_bedrock_double_prefix_strips_outer_only():
    # 双层前缀只剥外层；剩余 `anthropic.claude-3-5-sonnet` 与 LiteLLM catalog 对齐。
    assert observability_model_name("bedrock/anthropic.claude-3-5-sonnet") == "anthropic.claude-3-5-sonnet"


def test_observability_model_name_is_idempotent():
    samples = [
        "openai/gpt-5-mini",
        "gpt-5-mini",
        "gpt-5-mini-2025-08-07",
        "openai/gpt-5-mini-2025-08-07",
        "anthropic/claude-3-5-sonnet-20241022",
        "gpt-4o-mini",
        "text-embedding-3-large",
        "bedrock/anthropic.claude-3-5-sonnet",
    ]
    for sample in samples:
        first = observability_model_name(sample)
        second = observability_model_name(first)
        assert first == second, f"not idempotent for {sample!r}: {first!r} -> {second!r}"


def test_observability_model_name_strips_whitespace_first():
    assert observability_model_name("  openai/gpt-5-mini-2025-08-07  ") == "gpt-5-mini"


# ---------------------------------------------------------------------------
# 观测路径：extract_vendor
# ---------------------------------------------------------------------------


def test_extract_vendor_uses_explicit_prefix_first():
    assert extract_vendor("openai/gpt-5-mini") == "openai"
    assert extract_vendor("anthropic/claude-3-5-sonnet") == "anthropic"
    assert extract_vendor("gemini/text-embedding-004") == "gemini"
    assert extract_vendor("vertex_ai/gemini-1.5-pro") == "vertex_ai"
    assert extract_vendor("deepseek/deepseek-chat") == "deepseek"


def test_extract_vendor_prefix_case_insensitive():
    assert extract_vendor("Azure/gpt-4") == "azure"
    assert extract_vendor("OpenAI/gpt-5-mini") == "openai"


def test_extract_vendor_falls_back_to_family_prefix():
    # 裸名通过系族前缀识别（OpenAI 硬编码 fallback 场景）。
    assert extract_vendor("gpt-5-mini") == "openai"
    assert extract_vendor("gpt-4o-mini") == "openai"
    assert extract_vendor("o1-preview") == "openai"
    assert extract_vendor("o3-mini") == "openai"
    assert extract_vendor("chatgpt-4o-latest") == "openai"
    assert extract_vendor("claude-3-5-sonnet") == "anthropic"
    assert extract_vendor("gemini-1.5-pro") == "gemini"
    assert extract_vendor("llama-3-8b") == "meta"
    assert extract_vendor("mistral-large") == "mistral"
    assert extract_vendor("mixtral-8x7b") == "mistral"
    assert extract_vendor("command-r-plus") == "cohere"
    assert extract_vendor("deepseek-chat") == "deepseek"
    assert extract_vendor("text-embedding-3-large") == "openai"


def test_extract_vendor_returns_none_for_unknown():
    assert extract_vendor(None) is None
    assert extract_vendor("") is None
    assert extract_vendor("   ") is None
    assert extract_vendor("some-unknown-model") is None
