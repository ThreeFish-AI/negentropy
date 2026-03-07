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


def test_llm_settings_uses_online_pricing_when_available(monkeypatch):
    monkeypatch.setattr(
        "negentropy.config.pricing.get_effective_model_pricing_usd",
        lambda model: ({"input": 1.0, "output": 3.2}, "litellm_online_catalog"),
    )

    settings = LlmSettings(vendor=LlmVendor.ZAI, model_name="glm-5")

    assert settings.full_model_name == "zai/glm-5"
    assert settings.embedding_full_model_name == "zai/glm-5"
    assert settings.model_pricing == {"input": 1.0, "output": 3.2}


def test_llm_settings_falls_back_to_local_pricing(monkeypatch):
    monkeypatch.setattr(
        "negentropy.config.pricing.get_effective_model_pricing_usd",
        lambda model: ({"input": 0.285714, "output": 1.142857}, "local_override"),
    )

    settings = LlmSettings(vendor=LlmVendor.ZAI, model_name="glm-4.7")

    assert settings.model_pricing == {"input": 0.285714, "output": 1.142857}
