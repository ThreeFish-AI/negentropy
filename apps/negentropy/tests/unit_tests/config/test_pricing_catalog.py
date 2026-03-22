from negentropy.config.pricing import (
    clear_online_catalog_cache,
    get_effective_model_pricing_usd,
    get_online_model_pricing_usd,
)


def test_get_online_model_pricing_usd_prefers_litellm_catalog(monkeypatch):
    clear_online_catalog_cache()
    monkeypatch.setattr(
        "negentropy.config.pricing.litellm_catalog.load_litellm_online_cost_catalog",
        lambda: {
            "zai/glm-5": {
                "input_cost_per_token": 1e-06,
                "output_cost_per_token": 3.2e-06,
            }
        },
    )
    monkeypatch.setattr(
        "negentropy.config.pricing.litellm_catalog.litellm.get_model_info",
        lambda model: {"key": "zai/glm-5"},
    )

    assert get_online_model_pricing_usd("zai/glm-5") == {"input": 1.0, "output": 3.2}


def test_get_effective_model_pricing_usd_falls_back_to_local_override(monkeypatch):
    monkeypatch.setattr(
        "negentropy.config.pricing.litellm_catalog.get_online_model_pricing_usd",
        lambda model: None,
    )

    pricing, source = get_effective_model_pricing_usd("zai/glm-4.7")

    assert pricing == {"input": 0.285714, "output": 1.142857}
    assert source == "local_override"
