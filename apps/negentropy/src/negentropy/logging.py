"""
Unified Logging Service for Negentropy.

Provides structured logging with multiple sink support:
- stdio: Standard output (console/json format)
- file: Local file rotation with JSON
- gcloud: Google Cloud Logging (production)

Design Pattern: Strategy Pattern for sink abstraction.
Library: structlog + orjson for high-performance JSON serialization.
"""

from __future__ import annotations

import logging
import sys
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal

import orjson
import structlog
from structlog.typing import EventDict, WrappedLogger

if TYPE_CHECKING:
    from google.cloud.logging import Client as GCloudLoggingClient

# =============================================================================
# Types
# =============================================================================

LogFormat = Literal["console", "json"]

# =============================================================================
# ANSI Color Codes (for console format)
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


# =============================================================================
# JSON Serialization
# =============================================================================


def orjson_dumps(v: Any, *, default: Any = None) -> str:
    """Fast JSON serialization using orjson."""
    return orjson.dumps(v, default=default, option=orjson.OPT_UTC_Z | orjson.OPT_NAIVE_UTC).decode()


# =============================================================================
# Sink Abstraction (Strategy Pattern)
# =============================================================================


class BaseSink(ABC):
    """Abstract base class for log sinks."""

    @abstractmethod
    def emit(self, event_dict: EventDict) -> None:
        """Emit a log event to the sink."""
        ...

    @abstractmethod
    def close(self) -> None:
        """Close the sink and release resources."""
        ...


class StdioSink(BaseSink):
    """Standard I/O sink with configurable format.

    Args:
        fmt: Output format - "console" (colored human-readable) or "json"
        stream: Output stream (default: stderr)
    """

    def __init__(self, fmt: LogFormat = "console", stream: Any = None):
        self._fmt = fmt
        self._stream = stream or sys.stderr

    def emit(self, event_dict: EventDict) -> None:
        if self._fmt == "json":
            self._emit_json(event_dict)
        else:
            self._emit_console(event_dict)

    def _emit_json(self, event_dict: EventDict) -> None:
        """Emit JSON format for machine parsing."""
        json_str = orjson_dumps(event_dict)
        self._stream.write(json_str + "\n")
        self._stream.flush()

    def _emit_console(self, event_dict: EventDict) -> None:
        """Emit colored console format for dev.

        Format: HH:MM:SS │ LEVEL │ logger │ message [key=value ...]
        """
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

        # Shorten logger name (last part only)
        short_logger = logger_name.split(".")[-1] if "." in logger_name else logger_name

        # Format level with fixed width and color
        level_upper = level.upper()
        level_colored = colorize(f"{level_upper:>5}", level)

        # Build extra key=value pairs
        excluded_keys = {"level", "message", "event", "logger", "timestamp", "_name"}
        extras = []
        for k, v in event_dict.items():
            if k not in excluded_keys:
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

        self._stream.write(" ".join(line_parts) + "\n")
        self._stream.flush()

    def close(self) -> None:
        pass


class FileSink(BaseSink):
    """Local file sink with rotation (JSON format)."""

    def __init__(self, path: str | Path, max_bytes: int = 10 * 1024 * 1024, backup_count: int = 5):
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._max_bytes = max_bytes
        self._backup_count = backup_count
        self._file = open(self._path, "a", encoding="utf-8")

    def emit(self, event_dict: EventDict) -> None:
        json_str = orjson_dumps(event_dict)
        self._file.write(json_str + "\n")
        self._file.flush()
        self._maybe_rotate()

    def _maybe_rotate(self) -> None:
        if self._path.stat().st_size > self._max_bytes:
            self._file.close()
            for i in range(self._backup_count - 1, 0, -1):
                src = self._path.with_suffix(f".{i}.log") if i > 0 else self._path
                dst = self._path.with_suffix(f".{i + 1}.log")
                if src.exists():
                    src.rename(dst)
            self._path.rename(self._path.with_suffix(".1.log"))
            self._file = open(self._path, "a", encoding="utf-8")

    def close(self) -> None:
        self._file.close()


class GCloudSink(BaseSink):
    """Google Cloud Logging sink for production."""

    def __init__(self, project_id: str | None = None, log_name: str = "negentropy"):
        try:
            from google.cloud import logging as gcloud_logging

            self._client: GCloudLoggingClient = gcloud_logging.Client(project=project_id)
            self._logger = self._client.logger(log_name)
            self._available = True
        except Exception:
            self._available = False
            self._logger = None

    def emit(self, event_dict: EventDict) -> None:
        if not self._available or not self._logger:
            return
        level = event_dict.get("level", "INFO").upper()
        severity_map = {
            "DEBUG": "DEBUG",
            "INFO": "INFO",
            "WARNING": "WARNING",
            "ERROR": "ERROR",
            "CRITICAL": "CRITICAL",
        }
        severity = severity_map.get(level, "DEFAULT")
        self._logger.log_struct(event_dict, severity=severity)

    def close(self) -> None:
        if self._available and self._client:
            self._client.close()


# =============================================================================
# Structlog Processors
# =============================================================================


def add_timestamp(logger: WrappedLogger, method_name: str, event_dict: EventDict) -> EventDict:
    """Add ISO 8601 timestamp to log event."""
    event_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
    return event_dict


def add_logger_name(logger: WrappedLogger, method_name: str, event_dict: EventDict) -> EventDict:
    """Add logger name to log event."""
    event_dict["logger"] = event_dict.get("_name", "root")
    event_dict.pop("_name", None)
    return event_dict


def rename_event_key(logger: WrappedLogger, method_name: str, event_dict: EventDict) -> EventDict:
    """Rename 'event' to 'message' for GCloud compatibility."""
    if "event" in event_dict:
        event_dict["message"] = event_dict.pop("event")
    return event_dict


# =============================================================================
# Multi-Sink Renderer
# =============================================================================

_sinks: list[BaseSink] = []


def multi_sink_renderer(logger: WrappedLogger, method_name: str, event_dict: EventDict) -> str:
    """Render log to all configured sinks. Returns empty to suppress default output."""
    for sink in _sinks:
        try:
            sink.emit(event_dict)
        except Exception:
            pass  # Fail silently to avoid breaking the application
    return ""


# =============================================================================
# Public API
# =============================================================================


def configure_logging(
    *,
    level: str = "INFO",
    sinks: str = "stdio",
    fmt: str = "console",
    file_path: str = "logs/negentropy.log",
    gcloud_project: str | None = None,
    gcloud_log_name: str = "negentropy",
) -> None:
    """
    Configure the logging system.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        sinks: Comma-separated sink names (stdio, file, gcloud)
        fmt: Output format for stdio sink (console, json)
        file_path: Path for file sink
        gcloud_project: GCP project ID for gcloud sink
        gcloud_log_name: Log name for gcloud sink
    """
    global _sinks

    # Close existing sinks
    for sink in _sinks:
        sink.close()
    _sinks.clear()

    # Normalize format
    log_format: LogFormat = "json" if fmt.lower() == "json" else "console"

    # Create requested sinks
    sink_names = [s.strip().lower() for s in sinks.split(",")]
    for name in sink_names:
        if name == "stdio":
            _sinks.append(StdioSink(fmt=log_format))
        elif name == "file":
            _sinks.append(FileSink(file_path))
        elif name == "gcloud":
            _sinks.append(GCloudSink(project_id=gcloud_project, log_name=gcloud_log_name))

    # Configure structlog with custom processor pipeline
    shared_processors = [
        structlog.stdlib.add_log_level,
        add_timestamp,
        add_logger_name,
        rename_event_key,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    # Custom logger factory that suppresses empty output (avoids /dev/null overhead)
    class NopFile:
        def write(self, s: str) -> None:
            pass

        def flush(self) -> None:
            pass

    _NOP_FILE = NopFile()

    class SilentPrintLoggerFactory:
        """Logger factory that returns a logger writing to nowhere."""

        def __call__(self, *args: Any) -> structlog.PrintLogger:
            return structlog.PrintLogger(file=_NOP_FILE)

    structlog.configure(
        processors=shared_processors + [multi_sink_renderer],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, level.upper(), logging.INFO)),
        context_class=dict,
        logger_factory=SilentPrintLoggerFactory(),
        cache_logger_on_first_use=False,
    )

    # Configure stdlib logging level
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stderr,
        level=getattr(logging, level.upper(), logging.INFO),
        force=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Get a structured logger instance."""
    return structlog.get_logger(_name=name or "root")


# =============================================================================
# Module Initialization
# =============================================================================

_default_configured = False


def _ensure_configured() -> None:
    global _default_configured
    if not _default_configured:
        configure_logging()
        _default_configured = True
