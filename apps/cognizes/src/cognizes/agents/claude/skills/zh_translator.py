"""Chinese translation skill using the Anthropic Claude API."""

import logging
import os
from typing import Any

import anthropic

logger = logging.getLogger(__name__)


def _get_anthropic_client() -> anthropic.Anthropic | None:
    """Create an Anthropic client from environment variables.

    Returns:
        An ``Anthropic`` instance when ``ANTHROPIC_API_KEY`` is set, otherwise
        ``None``.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    base_url = os.getenv("ANTHROPIC_BASE_URL")
    if base_url:
        return anthropic.Anthropic(api_key=api_key, base_url=base_url)
    return anthropic.Anthropic(api_key=api_key)


async def handle_zh_translator(params: dict[str, Any]) -> dict[str, Any]:
    """Translate Markdown content to Chinese using the Claude API.

    Args:
        params: Dictionary containing:
            - content or text: The text to translate.
            - preserve_formatting: Whether to preserve Markdown formatting
              (default ``True``).
            - target_language: Target language code (default ``zh``).

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

    client = _get_anthropic_client()
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
