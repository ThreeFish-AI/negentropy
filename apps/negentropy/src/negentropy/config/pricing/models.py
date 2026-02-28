"""
Pricing Configuration Models.

Data models for LLM model pricing configuration.
Reference: https://open.bigmodel.cn/pricing
"""

from typing import Dict, Optional

from pydantic import BaseModel, Field


class PricingMetadata(BaseModel):
    """Metadata about the pricing configuration."""

    source: str = Field(
        default="https://open.bigmodel.cn/pricing",
        description="Source URL for pricing information",
    )
    updated_at: str = Field(
        description="Date when pricing was last updated (YYYY-MM-DD)",
    )
    currency: str = Field(
        default="CNY",
        description="Currency for pricing",
    )
    exchange_rate_usd_cny: float = Field(
        default=7.0,
        ge=0.0,
        description="Exchange rate: 1 USD = X CNY",
    )


class ModelPricing(BaseModel):
    """Pricing configuration for a single model.

    Prices are in the currency specified by the parent config (default: CNY).
    Unit: per 1M tokens.
    """

    input: float = Field(
        ge=0.0,
        description="Price per 1M input tokens",
    )
    output: float = Field(
        ge=0.0,
        description="Price per 1M output tokens",
    )
    is_free: bool = Field(
        default=False,
        description="Whether this model is free to use",
    )


class GLMPricingConfig(BaseModel):
    """Root configuration for GLM model pricing."""

    metadata: PricingMetadata
    models: Dict[str, ModelPricing] = Field(
        default_factory=dict,
        description="Mapping of model name (lowercase) to pricing configuration",
    )
