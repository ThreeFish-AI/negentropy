"""
Core logging configuration and initialization logic.
"""

from __future__ import annotations

import logging
import sys
from typing import Any
from datetime import datetime, timezone

import structlog
from structlog.typing import EventDict, WrappedLogger
from structlog import stdlib

from .sinks import BaseSink, StdioSink, FileSink, GCloudSink, LogFormat
from .io import StreamToLogger

# =============================================================================
# Global State
# =============================================================================

_sinks: list[BaseSink] = []


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Get a structured logger instance."""
    return structlog.get_logger(_name=name or "root")


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


def multi_sink_renderer(logger: WrappedLogger, method_name: str, event_dict: EventDict) -> str:
    """Render log to all configured sinks. Returns empty to suppress default output."""
    for sink in _sinks:
        try:
            sink.emit(event_dict)
        except Exception:
            pass  # Fail silently to avoid breaking the application
    return ""


# =============================================================================
# Configuration Logic
# =============================================================================


def _initialize_sinks(sinks: str, fmt: str, file_path: str, gcloud_project: str | None, gcloud_log_name: str) -> None:
    """Initialize configure sinks based on input."""
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
            # Use sys.stdout for INFO/application logs to separate from actual errors
            _sinks.append(StdioSink(fmt=log_format, stream=sys.stdout))
        elif name == "file":
            _sinks.append(FileSink(file_path))
        elif name == "gcloud":
            _sinks.append(GCloudSink(project_id=gcloud_project, log_name=gcloud_log_name))


def _configure_structlog(level: str) -> None:
    """Configure structlog processors and factory."""
    shared_processors = [
        structlog.stdlib.add_log_level,
        add_timestamp,
        add_logger_name,
        rename_event_key,
        # StackInfoRenderer and format_exc_info are good, but careful with duplication
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
    Configure the unified logging system.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        sinks: Comma-separated sink names (stdio, file, gcloud)
        fmt: Output format for stdio sink (console, json)
        file_path: Path for file sink
        gcloud_project: GCP project ID for gcloud sink
        gcloud_log_name: Log name for gcloud sink
    """
    # Import interceptors here to avoid circular imports if any
    from .interceptors import RedirectStdLibHandler, intercept_third_party_loggers

    # 1. Initialize Sinks
    _initialize_sinks(sinks, fmt, file_path, gcloud_project, gcloud_log_name)

    # 2. Configure Structlog
    _configure_structlog(level)

    # 3. Configure Stdlib Logging (Root)
    # We remove ALL existing handlers and add our RedirectStdLibHandler
    root_logger = logging.getLogger()
    root_logger.handlers = []
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    root_logger.addHandler(RedirectStdLibHandler())

    # 4. Intercept Third-Party Loggers
    intercept_third_party_loggers()

    # 5. Intercept sys.stdout & sys.stderr (for random prints)
    # Check if already intercepted (helper function or check type)
    if not isinstance(sys.stdout, StreamToLogger):
        sys.stdout = StreamToLogger(get_logger("stdout"), logging.INFO, sys.stdout)  # type: ignore

    if not isinstance(sys.stderr, StreamToLogger):
        sys.stderr = StreamToLogger(get_logger("stderr"), logging.INFO, sys.stderr)  # type: ignore
