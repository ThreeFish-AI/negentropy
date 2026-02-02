"""
LLM Abstractions.

This package re-exports configuration from config.llm for backward compatibility.
"""

from negentropy.config.llm import LlmSettings

# Backward compatibility alias
LlmConfiguration = LlmSettings

__all__ = ["LlmConfiguration", "LlmSettings"]
