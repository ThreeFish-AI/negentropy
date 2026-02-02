"""
LLM Configuration.

Implements a Unified Design Language for model configuration,
abstracting provider-specific details into high-level intents.
"""

from typing import Any, Dict, Literal, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class LlmSettings(BaseSettings):
    """
    Unified LLM configuration with automatic translation to provider-specific kwargs.

    Environment variables use the `NE_LLM_` prefix.
    """

    model_config = SettingsConfigDict(
        env_prefix="NE_LLM_",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core Identity
    provider: Literal["openai", "anthropic", "vertex_ai", "deepseek", "ollama"] = Field(
        default="openai",
        description="The model provider backend.",
    )
    model_name: str = Field(
        default="glm-4.7",
        description="The specific model identifier (e.g., 'gpt-4o', 'claude-3-7-sonnet').",
    )

    # Generation Parameters
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None)
    top_p: Optional[float] = Field(default=None)

    # Thinking / Reasoning Abstraction
    thinking_mode: bool = Field(
        default=False,
        description="Enable extended reasoning/thinking capabilities.",
    )
    thinking_budget: int = Field(
        default=2048,
        description="Token budget for thinking (Claude).",
    )
    reasoning_effort: Literal["low", "medium", "high"] = Field(
        default="medium",
        description="Reasoning effort level (OpenAI o1/o3).",
    )

    @property
    def full_model_name(self) -> str:
        """Returns the LiteLLM-compatible model string (e.g. 'anthropic/claude-3-7-sonnet')."""
        if "/" in self.model_name:
            return self.model_name
        return f"{self.provider}/{self.model_name}"

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

        # Handle Thinking/Reasoning Translation
        if self.thinking_mode:
            self._apply_thinking_config(kwargs)
        else:
            self._apply_standard_config(kwargs)

        return kwargs

    def _apply_thinking_config(self, kwargs: Dict[str, Any]) -> None:
        """Applies provider-specific thinking/reasoning parameters."""
        model_lower = self.model_name.lower()

        # Anthropic (Claude 3.7+)
        if self.provider == "anthropic" or "claude" in model_lower:
            kwargs["thinking"] = {
                "type": "enabled",
                "budget_tokens": self.thinking_budget,
            }
            return

        # OpenAI (o1, o3-mini)
        if self.provider == "openai" or model_lower.startswith(("o1", "o3")):
            kwargs["reasoning_effort"] = self.reasoning_effort
            return

    def _apply_standard_config(self, kwargs: Dict[str, Any]) -> None:
        """Ensures thinking is explicitly disabled if necessary."""
        model_lower = self.model_name.lower()

        if self.provider == "anthropic" or "claude" in model_lower:
            kwargs["thinking"] = {"type": "disabled"}
