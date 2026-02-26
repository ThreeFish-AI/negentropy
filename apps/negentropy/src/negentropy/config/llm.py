"""
LLM Configuration.

Implements a Unified Design Language for model configuration,
abstracting provider-specific details into high-level intents.

Provider References:
- ZAI (Zhipu AI): https://docs.litellm.ai/docs/providers/zai
- GLM Thinking Mode: https://docs.bigmodel.cn/cn/guide/capabilities/thinking-mode
"""

from enum import Enum
from typing import Any, Dict, Literal, Optional

import os

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class LlmVendor(str, Enum):
    """Supported LLM vendors."""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    ZAI = "zai"
    VERTEX_AI = "vertex_ai"
    DEEPSEEK = "deepseek"
    OLLAMA = "ollama"


class LlmSettings(BaseSettings):
    """
    Unified LLM configuration with automatic translation to provider-specific kwargs.

    Environment variables use the `NE_LLM_` prefix.
    """

    model_config = SettingsConfigDict(
        env_prefix="NE_LLM_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
        validate_default=True,
    )

    # Model Pricing (USD per 1M tokens)
    # Reference: https://open.bigmodel.cn/pricing
    # Exchange rate: 1 USD ≈ 7 CNY
    MODEL_PRICING: Dict[str, Dict[str, float]] = {
        "glm-5": {"input": 0.5, "output": 0.5},  # GLM-5: ¥3.5/1M tokens ≈ $0.5/1M
        # Add more models as needed
    }

    # Core Identity
    vendor: LlmVendor = Field(
        default=LlmVendor.ZAI,
        validation_alias="NE_LLM_VENDOR",
        description="The model vendor backend.",
    )
    model_name: str = Field(
        default="glm-4.7",
        description="The specific model identifier (e.g., 'gpt-4o', 'claude-3-7-sonnet', 'glm-4.7').",
    )
    embedding_model_name: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("EMBEDDING_MODEL", "NE_LLM_EMBEDDING_MODEL"),
        description="Embedding model identifier. If unset, defaults to model_name.",
    )
    embedding_vendor: Optional[LlmVendor] = Field(
        default=None,
        validation_alias=AliasChoices("EMBEDDING_VENDOR", "NE_LLM_EMBEDDING_VENDOR"),
        description="Optional vendor override for embedding model.",
    )
    embedding_dimensions: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("EMBEDDING_DIMENSIONS", "NE_LLM_EMBEDDING_DIMENSIONS"),
        description="Optional embedding dimensions (OpenAI text-embedding-3+).",
    )
    embedding_input_type: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("EMBEDDING_INPUT_TYPE", "NE_LLM_EMBEDDING_INPUT_TYPE"),
        description="Optional input_type for embedding models (e.g., 'search_query', 'search_document').",
    )

    # Generation Parameters
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None)
    top_p: Optional[float] = Field(default=None)
    drop_params: Optional[bool] = Field(
        default=None,
        description="是否在 LiteLLM 中自动丢弃不被当前供应商支持的参数。",
    )

    # Thinking / Reasoning Abstraction
    thinking_mode: bool = Field(
        default=False,
        description="Enable extended reasoning/thinking capabilities.",
    )
    thinking_budget: int = Field(
        default=2048,
        description="Token budget for thinking (Claude/GLM).",
    )
    reasoning_effort: Literal["low", "medium", "high"] = Field(
        default="medium",
        description="Reasoning effort level (OpenAI o1/o3).",
    )
    preserve_thinking: bool = Field(
        default=False,
        description="Enable preserved thinking for multi-turn coherence (GLM-specific).",
    )

    @property
    def full_model_name(self) -> str:
        """Returns the LiteLLM-compatible model string (e.g. 'zai/glm-4.7')."""
        if "/" in self.model_name:
            return self.model_name
        return f"{self.vendor.value}/{self.model_name}"

    @property
    def model_pricing(self) -> Optional[Dict[str, float]]:
        """Returns pricing for the current model, if known.

        Returns pricing dict with 'input' and 'output' keys (USD per 1M tokens),
        or None if the model is not in the pricing table.
        """
        model_lower = self.model_name.lower()
        for key, pricing in self.MODEL_PRICING.items():
            if key in model_lower:
                return pricing
        return None

    @property
    def embedding_full_model_name(self) -> str:
        env_model = os.getenv("NE_LLM_EMBEDDING_MODEL")
        model_name = self.embedding_model_name or env_model or self.model_name
        if "/" in model_name:
            return model_name
        vendor = self.embedding_vendor or self.vendor
        return f"{vendor.value}/{model_name}"

    def to_litellm_embedding_kwargs(self) -> Dict[str, Any]:
        kwargs: Dict[str, Any] = {}
        dimensions = self.embedding_dimensions
        if dimensions is None:
            raw = os.getenv("NE_LLM_EMBEDDING_DIMENSIONS")
            if raw is not None:
                try:
                    dimensions = int(raw)
                except ValueError:
                    dimensions = None
        if dimensions is not None:
            kwargs["dimensions"] = dimensions

        input_type = self.embedding_input_type or os.getenv("NE_LLM_EMBEDDING_INPUT_TYPE")
        if input_type:
            kwargs["input_type"] = input_type
        return kwargs

    def to_litellm_kwargs(self) -> Dict[str, Any]:
        """
        Translates the unified configuration into provider-specific kwargs for LiteLLM.
        """
        kwargs: Dict[str, Any] = {
            "temperature": self.temperature,
        }

        if self.max_tokens:
            kwargs["max_tokens"] = self.max_tokens

        if self.top_p is not None:
            kwargs["top_p"] = self.top_p

        if self.drop_params is not None:
            kwargs["drop_params"] = self.drop_params
        else:
            model_lower = self.model_name.lower()
            if self.vendor == LlmVendor.ZAI or "glm" in model_lower:
                # 避免 ZAI/GLM 因未支持参数（如 max_completion_tokens）而失败
                kwargs["drop_params"] = True

        # Handle Thinking/Reasoning Translation
        self._apply_thinking_config(kwargs)

        return kwargs

    def _apply_thinking_config(self, kwargs: Dict[str, Any]) -> None:
        """
        Applies provider-specific thinking/reasoning parameters.

        Each provider has different mechanisms for extended reasoning:
        - OpenAI o1/o3: reasoning_effort parameter
        - ZAI (GLM): thinking dict via extra_body
        - Anthropic (Claude): thinking dict as native parameter
        """
        model_lower = self.model_name.lower()

        # 1. ZAI (Zhipu AI) GLM models
        # Reference: https://docs.litellm.ai/docs/providers/zai
        # Note: LiteLLM currently requires passing `thinking` inside `extra_body` for ZAI
        if self.vendor == LlmVendor.ZAI or "glm" in model_lower:
            thinking_config: Dict[str, Any]
            if self.thinking_mode:
                thinking_config = {
                    "type": "enabled",
                    "budget_tokens": self.thinking_budget,
                }
                if self.preserve_thinking:
                    thinking_config["clear_thinking"] = False
            else:
                thinking_config = {"type": "disabled"}

            kwargs["extra_body"] = {"thinking": thinking_config}
            return

        # 2. Anthropic Claude models
        # Reference: https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking
        if self.vendor == LlmVendor.ANTHROPIC or "claude" in model_lower:
            if self.thinking_mode:
                kwargs["thinking"] = {
                    "type": "enabled",
                    "budget_tokens": self.thinking_budget,
                }
            else:
                kwargs["thinking"] = {"type": "disabled"}
            return

        # 3. OpenAI o1/o3 reasoning models
        # Reference: https://platform.openai.com/docs/guides/reasoning
        if self.vendor == LlmVendor.OPENAI and model_lower.startswith(("o1", "o3")):
            if self.thinking_mode:
                kwargs["reasoning_effort"] = self.reasoning_effort
            return

        # 4. Other Providers: No thinking support (passthrough)
        # Deepseek / Ollama / Vertex AI default behavior is to ignore these params

    @field_validator("embedding_model_name", mode="before")
    @classmethod
    def _load_embedding_model_env(cls, value: Optional[str]) -> Optional[str]:
        return value or os.getenv("NE_LLM_EMBEDDING_MODEL")

    @field_validator("embedding_vendor", mode="before")
    @classmethod
    def _load_embedding_vendor_env(cls, value: Optional[LlmVendor]) -> Optional[LlmVendor]:
        raw = os.getenv("NE_LLM_EMBEDDING_VENDOR")
        if value is not None:
            return value
        if raw is None:
            return None
        normalized = raw.lower()
        if normalized in {"google", "vertex", "vertexai"}:
            return LlmVendor.VERTEX_AI
        try:
            return LlmVendor(normalized)
        except ValueError:
            return None

    @field_validator("embedding_dimensions", mode="before")
    @classmethod
    def _load_embedding_dimensions_env(cls, value: Optional[int]) -> Optional[int]:
        if value is not None:
            return value
        raw = os.getenv("NE_LLM_EMBEDDING_DIMENSIONS")
        if raw is None:
            return None
        try:
            return int(raw)
        except ValueError:
            return None

    @field_validator("embedding_input_type", mode="before")
    @classmethod
    def _load_embedding_input_type_env(cls, value: Optional[str]) -> Optional[str]:
        return value or os.getenv("NE_LLM_EMBEDDING_INPUT_TYPE")
