from negentropy.config.llm import LlmSettings, LlmVendor
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


def test_llm_settings_uses_canonical_model_name_and_pricing():
    settings = LlmSettings(vendor=LlmVendor.ZAI, model_name="glm-5")

    assert settings.full_model_name == "zai/glm-5"
    assert settings.embedding_full_model_name == "zai/glm-5"
    assert settings.model_pricing == {"input": 0.571429, "output": 2.571429}
