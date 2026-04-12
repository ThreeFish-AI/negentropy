from negentropy.model_names import canonicalize_model_name, pricing_lookup_model_name


def test_canonicalize_model_name_for_glm_models():
    assert canonicalize_model_name("glm-5") == "zai/glm-5"
    assert canonicalize_model_name("zai/glm-5") == "zai/glm-5"
    assert canonicalize_model_name("openai/glm-5") == "zai/glm-5"


def test_canonicalize_model_name_keeps_non_glm_models():
    assert canonicalize_model_name("text-embedding-005") == "text-embedding-005"
    assert canonicalize_model_name("openai/gpt-4o-mini") == "openai/gpt-4o-mini"


def test_pricing_lookup_model_name_strips_vendor_prefix():
    assert pricing_lookup_model_name("glm-5") == "glm-5"
    assert pricing_lookup_model_name("zai/glm-5") == "glm-5"


def test_fallback_llm_config():
    from negentropy.config.model_resolver import get_fallback_llm_config

    name, kwargs = get_fallback_llm_config()
    assert name == "zai/glm-5"
    assert kwargs["temperature"] == 0.7
    assert kwargs["drop_params"] is True


def test_fallback_embedding_config():
    from negentropy.config.model_resolver import get_fallback_embedding_config

    name, kwargs = get_fallback_embedding_config()
    assert name == "vertex_ai/text-embedding-005"
    assert kwargs == {}
