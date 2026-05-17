"""Thinking / reasoning 参数映射的单元测试。"""


def test_anthropic_thinking_override_enabled_and_disabled():
    from negentropy.config.model_resolver import apply_llm_thinking_override

    enabled = apply_llm_thinking_override(
        "anthropic/claude-4-5-sonnet",
        {"temperature": 0.7},
        True,
        {"thinking_budget": 4096},
    )
    assert enabled["thinking"] == {"type": "enabled", "budget_tokens": 4096}

    disabled = apply_llm_thinking_override(
        "anthropic/claude-4-5-sonnet",
        {"thinking": {"type": "enabled", "budget_tokens": 4096}},
        False,
    )
    assert disabled["thinking"] == {"type": "disabled"}


def test_openai_gpt5_reasoning_override_uses_reasoning_effort():
    from negentropy.config.model_resolver import apply_llm_thinking_override

    enabled = apply_llm_thinking_override(
        "openai/gpt-5-mini",
        {"temperature": 0.7},
        True,
        {"reasoning_effort": "high"},
    )
    assert enabled["reasoning_effort"] == "high"

    disabled = apply_llm_thinking_override(
        "openai/gpt-5-mini",
        {"reasoning_effort": "high"},
        False,
    )
    assert "reasoning_effort" not in disabled


def test_unsupported_vendor_is_left_unchanged():
    from negentropy.config.model_resolver import apply_llm_thinking_override

    kwargs = {"temperature": 0.2}
    out = apply_llm_thinking_override("gemini/gemini-2.5-flash", kwargs, True)
    assert out == kwargs
    assert out is not kwargs


def test_build_llm_kwargs_supports_gpt5_config_thinking_mode():
    from negentropy.config.model_resolver import _build_llm_kwargs

    kwargs = _build_llm_kwargs(
        "openai",
        "gpt-5-mini",
        {"thinking_mode": True, "reasoning_effort": "medium"},
    )
    assert kwargs["reasoning_effort"] == "medium"
