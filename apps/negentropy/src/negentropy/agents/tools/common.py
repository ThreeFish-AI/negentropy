import datetime
from zoneinfo import ZoneInfo


def get_current_timestamp() -> str:
    """Returns the current timestamp in ISO format."""
    return datetime.datetime.now(ZoneInfo("UTC")).isoformat()


def log_activity(agent_name: str, activity: str) -> str:
    """Logs a specific activity for an agent.

    Args:
        agent_name: Name of the agent performing the activity.
        activity: Description of the activity.

    Returns:
        Confirmation message.
    """
    timestamp = get_current_timestamp()
    # In a real system, this might write to a database or file.
    return f"[{timestamp}] {agent_name}: {activity} (Logged)"
