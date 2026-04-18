from negentropy.model_names import canonicalize_model_name, pricing_lookup_model_name


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
