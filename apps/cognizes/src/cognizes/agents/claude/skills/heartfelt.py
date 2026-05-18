"""Deep heartfelt analysis skill powered by the Anthropic Claude API."""

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


async def handle_heartfelt(params: dict[str, Any]) -> dict[str, Any]:
    """Perform a deep, heartfelt analysis of document content.

    When the Anthropic API is not configured the function falls back to a
    basic text summary describing the content length and a short preview.

    Args:
        params: Dictionary containing:
            - content: The document text to analyse.
            - analysis_type: Type of analysis (default ``"comprehensive"``).

    Returns:
        A result dictionary with ``success``, ``analysis``, ``insights``,
        ``content``, and ``metadata`` on success; or ``success``, ``error``,
        ``error_type`` on failure.
    """
    content = params.get("content", "")
    analysis_type = params.get("analysis_type", "comprehensive")

    client = _get_anthropic_client()

    # Fallback: simple text analysis when no API key is available
    if client is None:
        simple_analysis = (
            f"Document Analysis ({analysis_type}):\n\n"
            f"Content length: {len(content)} characters.\n\n"
            f"The document contains text that appears to be "
            f"{content[:100]}... (truncated for brevity)."
        )

        return {
            "success": True,
            "analysis": simple_analysis,
            "insights": simple_analysis,
            "content": simple_analysis,
            "metadata": {
                "analysis_type": analysis_type,
                "original_length": len(content),
            },
        }

    try:
        if analysis_type == "comprehensive":
            prompt = f"""Please provide a heartfelt, comprehensive analysis of the following document content. Include:

1. Key themes and main ideas
2. Emotional tone and sentiment
3. Important insights and takeaways
4. Personal reflections and connections
5. Actionable conclusions

Content to analyze:

{content}

Please provide a thoughtful, human-like analysis that goes beyond simple summary."""
        else:
            prompt = f"""Please analyze the following document content from a heartfelt perspective:

{content}

Focus on the emotional and human aspects of the content."""

        response = client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )

        # --- Extract analysis text from response ---
        analysis = ""
        if hasattr(response, "content") and isinstance(response.content, list):
            for block in response.content:
                if hasattr(block, "text") and isinstance(block.text, str):
                    analysis = block.text
                    break
                elif isinstance(block, dict) and "text" in block:
                    analysis = block["text"]
                    break

        return {
            "success": True,
            "analysis": analysis,
            "insights": analysis,
            "content": analysis,
            "metadata": {
                "analysis_type": analysis_type,
                "original_length": len(content),
            },
        }

    except Exception as e:
        logger.error(f"Heartfelt analysis error: {str(e)}")
        return {
            "success": False,
            "error": f"Analysis failed: {str(e)}",
            "error_type": type(e).__name__,
        }
