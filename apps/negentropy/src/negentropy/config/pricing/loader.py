"""
Pricing Configuration Loader.

Loads and caches GLM model pricing from JSON configuration file.
Reference: https://open.bigmodel.cn/pricing
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, Optional, Tuple

from .models import GLMPricingConfig, ModelPricing


# Default pricing file location (relative to this module)
_PRICING_FILE = Path(__file__).parent / "glm_pricing.json"


@lru_cache(maxsize=1)
def load_glm_pricing() -> GLMPricingConfig:
    """
    Load GLM pricing configuration from JSON file.

    Uses lru_cache to ensure the file is only read once.

    Returns:
        GLMPricingConfig: The pricing configuration object.

    Raises:
        FileNotFoundError: If the pricing file does not exist.
        ValueError: If the pricing file is invalid JSON.
    """
    if not _PRICING_FILE.exists():
        raise FileNotFoundError(f"Pricing configuration not found: {_PRICING_FILE}")

    with open(_PRICING_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    return GLMPricingConfig.model_validate(data)


def get_model_pricing(model_name: str) -> Optional[ModelPricing]:
    """
    Get pricing for a specific model.

    Performs case-insensitive model name matching.

    Args:
        model_name: The model name (e.g., "glm-5", "GLM-4.7", "glm-4.7-flashx")

    Returns:
        ModelPricing if found, None otherwise.
    """
    config = load_glm_pricing()
    model_lower = model_name.lower()

    # Direct match
    if model_lower in config.models:
        return config.models[model_lower]

    # Partial match with preference for longer (more specific) matches
    # e.g., "glm-4.7-flashx" matches "glm-4.7" over "glm-4"
    best_match: Optional[Tuple[str, ModelPricing]] = None
    for key, pricing in config.models.items():
        if model_lower.startswith(key):
            if best_match is None or len(key) > len(best_match[0]):
                best_match = (key, pricing)

    if best_match:
        return best_match[1]

    return None


def get_model_pricing_usd(model_name: str) -> Optional[Dict[str, float]]:
    """
    Get pricing for a specific model in USD per 1M tokens.

    This function maintains backward compatibility with the existing
    model_pricing property interface in LlmSettings.

    Args:
        model_name: The model name.

    Returns:
        Dict with 'input' and 'output' keys (USD per 1M tokens),
        or None if the model is not in the pricing table.
    """
    pricing = get_model_pricing(model_name)
    if pricing is None:
        return None

    config = load_glm_pricing()
    exchange_rate = config.metadata.exchange_rate_usd_cny

    # Convert CNY to USD
    input_usd = round(pricing.input / exchange_rate, 6)
    output_usd = round(pricing.output / exchange_rate, 6)

    return {"input": input_usd, "output": output_usd}


def clear_pricing_cache() -> None:
    """Clear the pricing configuration cache. Useful for testing."""
    load_glm_pricing.cache_clear()
