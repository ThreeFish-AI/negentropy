"""
Log formatters and color utilities.
"""

from __future__ import annotations

from datetime import datetime, timezone
from structlog.typing import EventDict

# =============================================================================
# Console Formatter (Aligned Columns)
# =============================================================================


class ConsoleFormatter:
    """Handles human-readable console log rendering (fixed width, right-aligned)."""

    EXCLUDED_KEYS = {"level", "message", "event", "logger", "timestamp", "_name"}
    TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M:%S"
    TIMESTAMP_WIDTH = 19
    LEVEL_WIDTH = 8
    LOGGER_WIDTH = 48
    SEPARATOR = " | "

    @classmethod
    def configure(
        cls,
        *,
        timestamp_format: str | None = None,
        level_width: int | None = None,
        logger_width: int | None = None,
        separator: str | None = None,
    ) -> None:
        """Configure alignment and rendering parameters."""
        if timestamp_format:
            cls.TIMESTAMP_FORMAT = timestamp_format
            cls.TIMESTAMP_WIDTH = len(timestamp_format)
        if level_width:
            cls.LEVEL_WIDTH = level_width
        if logger_width:
            cls.LOGGER_WIDTH = logger_width
        if separator is not None:
            cls.SEPARATOR = separator

    @staticmethod
    def _fit_right(text: str, width: int) -> str:
        if width <= 0:
            return text
        if len(text) > width:
            if width <= 3:
                text = text[-width:]
            else:
                text = "..." + text[-(width - 3) :]
        return f"{text:>{width}}"

    @classmethod
    def _format_timestamp(cls, raw_timestamp: str | None) -> str:
        if raw_timestamp:
            try:
                normalized = raw_timestamp.replace("Z", "+00:00")
                dt = datetime.fromisoformat(normalized)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone().strftime(cls.TIMESTAMP_FORMAT)
            except (ValueError, TypeError):
                pass
        return datetime.now().strftime(cls.TIMESTAMP_FORMAT)

    @staticmethod
    def format(event_dict: EventDict) -> str:
        """Format an event dict into an aligned string."""
        level = event_dict.get("level", "info").lower()
        message = event_dict.get("message", event_dict.get("event", ""))
        logger_name = event_dict.get("logger", "root")
        source = event_dict.get("source")

        display_logger = str(logger_name)
        if logger_name in {"stdout", "stderr"} and source:
            source_parts = str(source).split(".")
            if len(source_parts) <= 2:
                short_source = str(source)
            else:
                short_source = ".".join(source_parts[-2:])
            display_logger = f"{logger_name}:{short_source}"

        timestamp = ConsoleFormatter._format_timestamp(event_dict.get("timestamp"))

        extras = []
        for k, v in event_dict.items():
            if k == "source" and logger_name in {"stdout", "stderr"} and source:
                continue
            if k not in ConsoleFormatter.EXCLUDED_KEYS:
                extras.append(f"{k}={v}")

        if extras:
            message = f"{message} " + " ".join(extras)

        level_upper = level.upper()

        return "".join(
            [
                ConsoleFormatter._fit_right(str(timestamp), ConsoleFormatter.TIMESTAMP_WIDTH),
                ConsoleFormatter.SEPARATOR,
                ConsoleFormatter._fit_right(level_upper, ConsoleFormatter.LEVEL_WIDTH),
                ConsoleFormatter.SEPARATOR,
                ConsoleFormatter._fit_right(display_logger, ConsoleFormatter.LOGGER_WIDTH),
                ConsoleFormatter.SEPARATOR,
                str(message),
            ]
        )
