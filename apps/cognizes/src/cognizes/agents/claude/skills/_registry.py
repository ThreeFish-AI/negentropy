"""Skill 注册表与调度器."""

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


class SkillInvoker:
    """Fallback skill implementation using available Python packages."""

    def __init__(self) -> None:
        """Initialize the skill invoker."""
        self.anthropic_client = None
        api_key = os.getenv("ANTHROPIC_API_KEY")
        base_url = os.getenv("ANTHROPIC_BASE_URL")

        if api_key:
            import anthropic

            if base_url:
                self.anthropic_client = anthropic.Anthropic(api_key=api_key, base_url=base_url)
            else:
                self.anthropic_client = anthropic.Anthropic(api_key=api_key)

        self.skill_registry: dict[str, Any] = {
            "pdf-reader": self._handle_pdf_reader,
            "web-translator": self._handle_web_translator,
            "zh-translator": self._handle_zh_translator,
            "doc-translator": self._handle_doc_translator,
            "markdown-formatter": self._handle_markdown_formatter,
            "heartfelt": self._handle_heartfelt,
            "batch-processor": self._handle_batch_processor,
        }

    async def call_skill(self, skill_name: str, params: dict[str, Any]) -> dict[str, Any]:
        """Call a skill by name.

        Args:
            skill_name: Name of the skill to call
            params: Parameters to pass to the skill

        Returns:
            Skill execution result with success status and data or error
        """
        handler = self.skill_registry.get(skill_name)
        if not handler:
            return {
                "success": False,
                "error": f"Unknown skill: {skill_name}",
                "error_type": "SkillNotFoundError",
            }

        try:
            return await handler(params)
        except Exception as e:
            logger.error(f"Error executing skill {skill_name}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__,
            }

    async def _handle_pdf_reader(self, params: dict[str, Any]) -> dict[str, Any]:
        """Delegate to pdf_reader module."""
        from .pdf_reader import handle_pdf_reader

        return await handle_pdf_reader(params)

    async def _handle_web_translator(self, params: dict[str, Any]) -> dict[str, Any]:
        """Delegate to web_translator module."""
        from .web_translator import handle_web_translator

        return await handle_web_translator(params)

    async def _handle_zh_translator(self, params: dict[str, Any]) -> dict[str, Any]:
        """Delegate to zh_translator module."""
        from .zh_translator import handle_zh_translator

        return await handle_zh_translator(params)

    async def _handle_doc_translator(self, params: dict[str, Any]) -> dict[str, Any]:
        """Delegate to doc_translator module."""
        from .doc_translator import handle_doc_translator

        return await handle_doc_translator(params)

    async def _handle_markdown_formatter(self, params: dict[str, Any]) -> dict[str, Any]:
        """Delegate to markdown_formatter module."""
        from .markdown_formatter import handle_markdown_formatter

        return await handle_markdown_formatter(params)

    async def _handle_heartfelt(self, params: dict[str, Any]) -> dict[str, Any]:
        """Delegate to heartfelt module."""
        from .heartfelt import handle_heartfelt

        return await handle_heartfelt(params)

    async def _handle_batch_processor(self, params: dict[str, Any]) -> dict[str, Any]:
        """Delegate to batch_processor module."""
        from .batch_processor import handle_batch_processor

        return await handle_batch_processor(params)

    def _convert_table_to_markdown(self, table: list[list[str]]) -> str:
        """Delegate to pdf_reader module."""
        from .pdf_reader import _convert_table_to_markdown

        return _convert_table_to_markdown(table)
