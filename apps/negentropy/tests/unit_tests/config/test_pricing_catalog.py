from negentropy.config.pricing import (
    clear_online_catalog_cache,
    get_effective_model_pricing_usd,
    get_online_model_pricing_usd,
)


def test_get_online_model_pricing_usd_reads_litellm_catalog(monkeypatch):
    clear_online_catalog_cache()
    monkeypatch.setattr(
        "negentropy.config.pricing.litellm_catalog.load_litellm_online_cost_catalog",
        lambda: {
            "openai/gpt-5-mini": {
                "input_cost_per_token": 1e-06,
                "output_cost_per_token": 3.2e-06,
            }
        },
    )
    monkeypatch.setattr(
        "negentropy.config.pricing.litellm_catalog.litellm.get_model_info",
        lambda model: {"key": "openai/gpt-5-mini"},
    )

    assert get_online_model_pricing_usd("openai/gpt-5-mini") == {"input": 1.0, "output": 3.2}


def test_get_effective_model_pricing_usd_returns_missing_when_online_absent(monkeypatch):
    monkeypatch.setattr(
        "negentropy.config.pricing.litellm_catalog.get_online_model_pricing_usd",
        lambda model: None,
    )

    pricing, source = get_effective_model_pricing_usd("openai/gpt-5-mini")

    assert pricing is None
    assert source == "missing"


def test_get_effective_model_pricing_usd_returns_online_when_available(monkeypatch):
    monkeypatch.setattr(
        "negentropy.config.pricing.litellm_catalog.get_online_model_pricing_usd",
        lambda model: {"input": 0.5, "output": 1.5},
    )

    pricing, source = get_effective_model_pricing_usd("openai/gpt-5-mini")

    assert pricing == {"input": 0.5, "output": 1.5}
    assert source == "litellm_online_catalog"
