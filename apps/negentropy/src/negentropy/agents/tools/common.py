import datetime
from typing import Any
from zoneinfo import ZoneInfo

from google.adk.tools import ToolContext

from negentropy.logging import get_logger

logger = get_logger("negentropy.tools.common")


def get_current_timestamp() -> str:
    """Returns the current timestamp in ISO format."""
    return datetime.datetime.now(ZoneInfo("UTC")).isoformat()


def log_activity(agent_name: str, activity: str, tool_context: ToolContext) -> dict[str, Any]:
    """Logs a specific activity for an agent.

    Args:
        agent_name: Name of the agent performing the activity.
        activity: Description of the activity.

    Returns:
        Logging result.
    """
    timestamp = get_current_timestamp()
    record = {
        "timestamp": timestamp,
        "agent_name": agent_name,
        "activity": activity,
    }
    # Persist in session state for downstream traceability when available.
    if tool_context and hasattr(tool_context, "state"):
        try:
            state = tool_context.state
            logs = state.get("activity_log")
            if not isinstance(logs, list):
                logs = []
            logs.append(record)
            state["activity_log"] = logs
        except Exception as exc:
            logger.warning("failed to append activity log to state", exc_info=exc)
    return {"status": "success", "record": record}


# ---------------------------------------------------------------------------
# Tool Progress 公共助手（C3 旁路；状态写入 state.tool_progress[tool_call_id]）
# ---------------------------------------------------------------------------
#
# 设计动机：
#   多个写入型工具（ingest_paper / ingest_to_corpus / 未来 write_file 等）
#   均需要在 ADK state_delta 中上报进度供前端 home-body 渲染进度条；将该范式
#   抽到 ``common`` 模块作为 SSOT，避免分散在各工具内重复实现导致漂移。
#
# 历史与兼容：
#   - 原私有名 ``_emit_tool_progress`` / ``_clear_tool_progress`` 定义于
#     ``agents/tools/paper.py``；本次抽取后 ``paper.py`` 通过 module-level alias
#     保留旧名，避免既有测试与外部调用方断裂。


def emit_tool_progress(
    tool_context: ToolContext | None,
    *,
    tool_call_id: str,
    percent: float,
    stage: str | None = None,
    eta: float | None = None,
) -> None:
    """通过 ADK state_delta 推送 Tool Progress（C3 旁路）。

    设计要点：
    - 写入 ``state.tool_progress[tool_call_id]``，前端 home-body 提取后渲染进度条；
    - 不参与 message-ledger 比对（仅文本内容参与），避开 ISSUE-031 时间窗回归；
    - 单点写入语义：调用方按语义里程碑（5%/20%/60%/100%）触发，里程碑天然稀疏，
      不需要时间维度 throttle；如未来增加细粒度推送，应在此处按 ``tool_call_id``
      维护上次推送时间戳实现真正的节流，并同步更新
      docs/architecture/framework.md §9.7。
    """
    if tool_context is None or not hasattr(tool_context, "state"):
        return
    try:
        state = tool_context.state
        existing = state.get("tool_progress")
        bucket: dict[str, Any] = existing if isinstance(existing, dict) else {}
        snapshot: dict[str, Any] = {
            "percent": max(0.0, min(100.0, float(percent))),
        }
        if stage:
            snapshot["stage"] = stage
        if eta is not None:
            snapshot["eta"] = eta
        bucket[tool_call_id] = snapshot
        state["tool_progress"] = bucket
    except Exception as exc:
        logger.debug("tool_progress_emit_skipped", error=str(exc), tool_call_id=tool_call_id)


def clear_tool_progress(
    tool_context: ToolContext | None,
    *,
    tool_call_id: str,
) -> None:
    """清理终态（completed/error）的 ``tool_progress`` 条目，避免 stale 残留。"""
    if tool_context is None or not hasattr(tool_context, "state"):
        return
    try:
        state = tool_context.state
        existing = state.get("tool_progress")
        if isinstance(existing, dict) and tool_call_id in existing:
            del existing[tool_call_id]
            state["tool_progress"] = existing
    except Exception:
        pass
