"""Markdown formatting and cleanup skill."""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


async def handle_markdown_formatter(params: dict[str, Any]) -> dict[str, Any]:
    """Apply formatting fixes to raw Markdown content.

    Supported options (all default to ``True``):

    - ``fix_headers``: Ensure blank lines before headings.
    - ``fix_lists``: Ensure blank lines before list items.
    - ``fix_code_blocks``: Normalise fenced code-block openers.

    Args:
        params: Dictionary containing:
            - content: The Markdown text to format.
            - options: A dict of formatting toggles.

    Returns:
        A result dictionary with ``success``, ``formatted_content``,
        ``content``, and ``metadata``.
    """
    content = params.get("content", "")
    options = params.get("options", {})

    formatted_content = content

    # Ensure blank lines before headings
    if options.get("fix_headers", True):
        formatted_content = re.sub(
            r"([^\n])\n(#+\s)",
            r"\1\n\n\2",
            formatted_content,
        )

    # Ensure blank lines before list items
    if options.get("fix_lists", True):
        formatted_content = re.sub(
            r"([^\n])\n(-|\*|\d+\.)\s",
            r"\1\n\n\2 ",
            formatted_content,
        )

    # Normalise fenced code-block openers
    if options.get("fix_code_blocks", True):
        formatted_content = re.sub(
            r"```(\w+)?\n",
            lambda m: f"```{m.group(1) or ''}\n",
            formatted_content,
        )

    return {
        "success": True,
        "formatted_content": formatted_content,
        "content": formatted_content,
        "metadata": {
            "original_length": len(content),
            "formatted_length": len(formatted_content),
        },
    }
