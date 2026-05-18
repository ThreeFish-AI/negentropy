"""Chinese translation skill using the Anthropic Claude API."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import anthropic

logger = logging.getLogger(__name__)


async def handle_zh_translator(
    params: dict[str, Any],
    *,
    client: anthropic.Anthropic | None = None,
) -> dict[str, Any]:
    """Translate Markdown content to Chinese using the Claude API.

    Args:
        params: Dictionary containing:
            - content or text: The text to translate.
            - preserve_formatting: Whether to preserve Markdown formatting
              (default ``True``).
            - target_language: Target language code (default ``zh``).
        client: Optional pre-configured Anthropic client.

    Returns:
        A result dictionary with ``success``, ``translated_text``, ``data``,
        ``content``, and ``metadata`` on success; or ``success``, ``error``,
        ``error_type`` on failure.
    """
    content = params.get("content") or params.get("text")
    if not content:
        return {
            "success": False,
            "error": "No content provided",
            "error_type": "ValueError",
        }

    if client is None:
        return {
            "success": False,
            "error": "Anthropic API key not configured",
            "error_type": "ConfigurationError",
        }

    try:
        prompt = f"""Please translate the following Markdown content to Chinese while preserving:

1. All formatting (headers, lists, bold, italic, etc.)
2. Code blocks and inline code
3. URLs and file paths
4. LaTeX mathematical formulas
5. HTML tags
6. Special characters and emojis

Do not translate:
- Code blocks
- URLs
- File paths
- Technical terms that should remain in English

Here is the content to translate:

{content}

Please provide only the translated content without any explanations."""

        response = await client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )

        # --- Extract translated text from response ---
        translated_content = ""
        if hasattr(response, "content") and isinstance(response.content, list):
            for block in response.content:
                if hasattr(block, "text") and isinstance(block.text, str):
                    translated_content = block.text
                    break
                elif isinstance(block, dict) and "text" in block:
                    translated_content = block["text"]
                    break

        return {
            "success": True,
            "translated_text": translated_content,
            "data": translated_content,
            "content": translated_content,
            "metadata": {
                "original_language": "auto-detected",
                "target_language": "zh-CN",
            },
        }

    except Exception as e:
        logger.error(f"Translation error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
        }
