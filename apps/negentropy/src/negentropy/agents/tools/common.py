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
