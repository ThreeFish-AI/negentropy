"""
Influence Faculty Tools - 影响系部专用工具

提供内容发布、外部交互能力。
"""

from __future__ import annotations

import inspect
import time
from typing import Any

from google.adk.tools import ToolContext

from negentropy.logging import get_logger

logger = get_logger("negentropy.tools.influence")


async def publish_content(content: str, channel: str, tool_context: ToolContext) -> dict[str, Any]:
    """发布内容到指定渠道。

    Args:
        content: 要发布的内容
        channel: 发布渠道

    Returns:
        发布结果
    """
    if tool_context and hasattr(tool_context, "save_artifact"):
        try:
            from google.genai import types

            filename = f"{channel}-{int(time.time())}.md"
            part = types.Part(text=content)
            artifact = tool_context.save_artifact(filename, part)
            if inspect.isawaitable(artifact):
                artifact = await artifact
            return {
                "status": "success",
                "channel": channel,
                "artifact": str(artifact) if artifact is not None else None,
                "filename": filename,
            }
        except Exception as exc:
            logger.error("publish_content failed to save artifact", exc_info=exc)
    return {
        "status": "success",
        "channel": channel,
        "content_preview": content[:200] if len(content) > 200 else content,
        "message": "Content prepared; no publishing backend configured",
    }


def send_notification(message: str, recipient: str, tool_context: ToolContext) -> dict[str, Any]:
    """发送通知给指定接收者。

    Args:
        message: 通知消息
        recipient: 接收者

    Returns:
        发送结果
    """
    if tool_context and hasattr(tool_context, "state"):
        try:
            state = tool_context.state
            queue = state.get("notifications")
            if not isinstance(queue, list):
                queue = []
            queue.append({"recipient": recipient, "message": message})
            state["notifications"] = queue
            return {"status": "success", "queued": True, "count": len(queue)}
        except Exception as exc:
            logger.error("send_notification failed to update state", exc_info=exc)
    return {
        "status": "success",
        "queued": False,
        "message": "Notification backend not configured",
    }
