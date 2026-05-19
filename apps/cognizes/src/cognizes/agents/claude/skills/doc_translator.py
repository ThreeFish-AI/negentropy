"""Document translation pipeline: PDF extraction followed by Chinese translation."""

import logging
from typing import Any

from .pdf_reader import handle_pdf_reader
from .zh_translator import handle_zh_translator

logger = logging.getLogger(__name__)


async def handle_doc_translator(params: dict[str, Any]) -> dict[str, Any]:
    """Extract text from a PDF document and translate it to Chinese.

    The function first delegates to :func:`handle_pdf_reader` to extract
    Markdown content, then passes that content to
    :func:`handle_zh_translator` for translation.

    Args:
        params: Dictionary containing PDF source parameters accepted by
            :func:`handle_pdf_reader` (``file_path``, ``url``, etc.).

    Returns:
        A result dictionary with ``success``, ``translated_content``,
        ``content``, ``metadata``, ``assets``, and ``statistics`` on success;
        or ``success``, ``error``, ``error_type`` on failure.
    """
    # Step 1: Extract content from PDF
    pdf_result = await handle_pdf_reader(params)
    if not pdf_result.get("success"):
        return pdf_result

    # Extract the text content from the PDF result
    pdf_content = ""
    if "data" in pdf_result and pdf_result["data"]:
        pdf_content = pdf_result["data"].get("content", "")
    elif "content" in pdf_result:
        pdf_content = pdf_result["content"]

    if not pdf_content:
        return {
            "success": False,
            "error": "No content extracted from PDF",
            "error_type": "ContentExtractionError",
        }

    # Step 2: Translate the extracted content
    translate_params = {
        "content": pdf_content,
        "preserve_formatting": True,
    }
    translate_result = await handle_zh_translator(translate_params)
    if not translate_result.get("success"):
        return translate_result

    translated_text = translate_result.get("translated_text", "")

    return {
        "success": True,
        "translated_content": translated_text,
        "content": translated_text,
        "metadata": {
            **pdf_result.get("metadata", {}),
            **translate_result.get("metadata", {}),
            "original_content": pdf_content,
        },
        "assets": pdf_result.get("assets", {}),
        "statistics": translate_result.get("statistics", {}),
    }
