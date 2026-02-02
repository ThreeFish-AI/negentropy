"""
Log formatters and color utilities.
"""

from __future__ import annotations

from datetime import datetime
from structlog.typing import EventDict

# =============================================================================
# ANSI Color Codes & Formatter (Orthogonality)
# =============================================================================

COLORS = {
    "reset": "\033[0m",
    "bold": "\033[1m",
    "dim": "\033[2m",
    # Levels
    "debug": "\033[36m",  # Cyan
    "info": "\033[32m",  # Green
    "warning": "\033[33m",  # Yellow
    "error": "\033[31m",  # Red
    "critical": "\033[1;31m",  # Bold Red
    # Components
    "timestamp": "\033[90m",  # Gray
    "logger": "\033[35m",  # Magenta
    "key": "\033[34m",  # Blue
}


def colorize(text: str, color: str) -> str:
    """Apply ANSI color to text."""
    return f"{COLORS.get(color, '')}{text}{COLORS['reset']}"


class ConsoleFormatter:
    """Handles human-readable console log rendering (Separation of Concerns)."""

    EXCLUDED_KEYS = {"level", "message", "event", "logger", "timestamp", "_name"}

    @staticmethod
    def format(event_dict: EventDict) -> str:
        """Format an event dict into a colored string."""
        # Extract core fields
        level = event_dict.get("level", "info").lower()
        message = event_dict.get("message", event_dict.get("event", ""))
        logger_name = event_dict.get("logger", "root")
        timestamp = event_dict.get("timestamp", "")

        # Format timestamp (extract time portion only)
        if timestamp:
            try:
                time_part = timestamp.split("T")[1][:8] if "T" in timestamp else timestamp[:8]
            except (IndexError, TypeError):
                time_part = timestamp[:8]
        else:
            time_part = datetime.now().strftime("%H:%M:%S")

        # Shorten logger name while preserving context
        # Keep at most 2 parts for readability (e.g., 'uvicorn.error', 'adk.sessions')
        parts = logger_name.split(".")
        if len(parts) <= 2:
            short_logger = logger_name
        else:
            short_logger = ".".join(parts[-2:])

        # Pad logger name to fixed width for alignment (20 chars, right-aligned)
        short_logger = f"{short_logger:>20}"

        # Format level with fixed width and color
        level_upper = level.upper()
        level_colored = colorize(f"{level_upper:>5}", level)

        # Build extra key=value pairs
        extras = []
        for k, v in event_dict.items():
            if k not in ConsoleFormatter.EXCLUDED_KEYS:
                key_colored = colorize(k, "key")
                extras.append(f"{key_colored}={v}")

        # Compose output line
        line_parts = [
            colorize(time_part, "timestamp"),
            "│",
            level_colored,
            "│",
            colorize(short_logger, "logger"),
            "│",
            str(message),
        ]

        if extras:
            line_parts.append(colorize(" " + " ".join(extras), "dim"))

        return " ".join(line_parts)
