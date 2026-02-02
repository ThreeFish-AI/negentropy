"""
LLM Configuration.

Implements a Unified Design Language for model configuration,
abstracting provider-specific details into high-level intents.

GLM-4.7 Thinking Mode Reference:
- https://docs.bigmodel.cn/cn/guide/capabilities/thinking-mode
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
        """Returns the LiteLLM-compatible model string (e.g. 'openai/glm-4.7')."""
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
        self._apply_thinking_config(kwargs)

        return kwargs

    def _apply_thinking_config(self, kwargs: Dict[str, Any]) -> None:
        """
        Applies provider-specific thinking/reasoning parameters.

        GLM-4.7 uses OpenAI-compatible API, but the `thinking` parameter is
        GLM-specific. We use `extra_body` to bypass LiteLLM's parameter validation
        and transparently forward the thinking config to BigModel API.
        """
        model_lower = self.model_name.lower()

        # OpenAI o1/o3 reasoning models (use reasoning_effort as standard param)
        if self.provider == "openai" and model_lower.startswith(("o1", "o3")):
            if self.thinking_mode:
                kwargs["reasoning_effort"] = self.reasoning_effort
            return

        # GLM models via OpenAI provider: Use extra_body to bypass validation
        # LiteLLM doesn't recognize glm-4.7 as a valid model, so we pass
        # the thinking parameter via extra_body which is forwarded transparently.
        if "glm" in model_lower:
            thinking_config: Dict[str, Any]
            if self.thinking_mode:
                thinking_config = {
                    "type": "enabled",
                    "budget_tokens": self.thinking_budget,
                }
                # GLM-specific: Preserved Thinking (clear_thinking=False)
                if self.preserve_thinking:
                    thinking_config["clear_thinking"] = False
            else:
                thinking_config = {"type": "disabled"}

            # Use extra_body to pass GLM-specific parameters
            kwargs["extra_body"] = {"thinking": thinking_config}
            return

        # Anthropic Claude models: Use thinking parameter directly
        # LiteLLM natively supports thinking for recognized Claude models
        if self.provider == "anthropic" or "claude" in model_lower:
            if self.thinking_mode:
                kwargs["thinking"] = {
                    "type": "enabled",
                    "budget_tokens": self.thinking_budget,
                }
            else:
                kwargs["thinking"] = {"type": "disabled"}
            return

        # Deepseek / Ollama / Other: No thinking support (passthrough)
