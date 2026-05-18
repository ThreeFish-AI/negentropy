"""Batch processing skill for parallel item handling."""

import logging
from typing import Any

from ._registry import SkillInvoker

logger = logging.getLogger(__name__)


async def handle_batch_processor(params: dict[str, Any]) -> dict[str, Any]:
    """Process a list of items through configured operations or a named skill.

    Two invocation modes are supported:

    **Operations mode** (``operations`` key provided):
    Each item is processed with mock extraction and translation, producing
    ``extracted`` and ``translated`` keys per result.

    **Skill mode** (``skill`` key provided):
    Each item is dispatched through a :class:`SkillInvoker` instance using
    the given skill name and shared parameters.

    Args:
        params: Dictionary containing:
            - items: List of items (dicts or scalars) to process.
            - operations: Optional list of operation names (e.g.
              ``["extract", "translate"]``).
            - skill: Skill name for the skill mode path.
            - skill_params: Shared parameters forwarded to the skill.
            - batch_size: Number of items per batch (default ``5``).

    Returns:
        A result dictionary with ``success``, ``results``, and ``summary``.
    """
    items = params.get("items", [])
    operations = params.get("operations", [])

    if operations:
        # --- Operations mode: mock extraction/translation per item ---------
        results = []
        for item in items:
            extracted_result = {
                "success": True,
                "content": f"Extracted content from {item.get('path', 'unknown file')}",
            }

            translated_result = {
                "success": True,
                "translated_text": f"Translated content from {item.get('path', 'unknown file')}",
            }

            combined_result = {
                **extracted_result,
                "extracted": extracted_result.get("content", ""),
                "translated": translated_result.get("translated_text", ""),
            }
            results.append(combined_result)

        return {
            "success": True,
            "results": results,
            "summary": {
                "total_items": len(items),
                "successful": len(results),
                "failed": 0,
                "success_rate": 1.0,
            },
        }

    # --- Skill mode: delegate each item through SkillInvoker ---------------
    skill_name = params.get("skill") or ""
    skill_params = params.get("skill_params", {})

    if not items:
        return {
            "success": False,
            "error": "No items provided for batch processing",
            "error_type": "ValueError",
        }

    if not skill_name:
        return {
            "success": False,
            "error": "No skill specified for batch processing",
            "error_type": "ValueError",
        }

    invoker = SkillInvoker()
    batch_size = params.get("batch_size", 5)
    results: list[dict[str, Any]] = []

    for i in range(0, len(items), batch_size):
        batch = items[i : i + batch_size]

        for item in batch:
            item_params = skill_params.copy()
            if isinstance(item, dict):
                item_params.update(item)
            else:
                item_params["content"] = str(item)

            result = await invoker.call_skill(skill_name, item_params)
            results.append(result)

    success_count = sum(1 for r in results if r.get("success", False))
    error_count = len(results) - success_count

    return {
        "success": True,
        "results": results,
        "summary": {
            "total_items": len(items),
            "successful": success_count,
            "failed": error_count,
            "success_rate": success_count / len(results) if results else 0,
        },
    }
