"""
LLM Vendor 枚举。

模型配置已迁移至 DB (model_configs 表)，通过 Admin UI 管理。
本模块仅保留 LlmVendor 枚举供类型引用。
"""

from enum import Enum


class LlmVendor(str, Enum):
    """Supported LLM vendors."""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    VERTEX_AI = "vertex_ai"
    DEEPSEEK = "deepseek"
    GEMINI = "gemini"
    OLLAMA = "ollama"
