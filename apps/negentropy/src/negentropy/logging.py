"""
Unified Logging Service for Negentropy.

Provides structured JSON logging with multiple sink support:
- stdio: Standard output (dev)
- file: Local file rotation (dev)
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
from typing import TYPE_CHECKING, Any

import orjson
import structlog
from structlog.typing import EventDict, WrappedLogger

if TYPE_CHECKING:
    from google.cloud.logging import Client as GCloudLoggingClient

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
    """Standard output sink for development."""

    def __init__(self, stream: Any = None):
        self._stream = stream or sys.stderr

    def emit(self, event_dict: EventDict) -> None:
        json_str = orjson_dumps(event_dict)
        self._stream.write(json_str + "\n")
        self._stream.flush()

    def close(self) -> None:
        pass  # No cleanup needed for stdio


class FileSink(BaseSink):
    """Local file sink with optional rotation."""

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
        # Map structlog level to GCloud severity
        level = event_dict.get("level", "INFO").upper()
        severity_map = {
            "DEBUG": "DEBUG",
            "INFO": "INFO",
            "WARNING": "WARNING",
            "ERROR": "ERROR",
            "CRITICAL": "CRITICAL",
        }
        severity = severity_map.get(level, "DEFAULT")
        # GCloud expects struct payload
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
    """Render log to all configured sinks and return JSON string."""
    for sink in _sinks:
        try:
            sink.emit(event_dict)
        except Exception:
            pass  # Fail silently to avoid breaking the application
    return orjson_dumps(event_dict)


# =============================================================================
# Public API
# =============================================================================


def configure_logging(
    *,
    level: str = "INFO",
    sinks: str = "stdio",
    file_path: str = "logs/negentropy.log",
    gcloud_project: str | None = None,
    gcloud_log_name: str = "negentropy",
) -> None:
    """
    Configure the logging system.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        sinks: Comma-separated sink names (stdio, file, gcloud)
        file_path: Path for file sink
        gcloud_project: GCP project ID for gcloud sink
        gcloud_log_name: Log name for gcloud sink
    """
    global _sinks

    # Close existing sinks
    for sink in _sinks:
        sink.close()
    _sinks.clear()

    # Create requested sinks
    sink_names = [s.strip().lower() for s in sinks.split(",")]
    for name in sink_names:
        if name == "stdio":
            _sinks.append(StdioSink())
        elif name == "file":
            _sinks.append(FileSink(file_path))
        elif name == "gcloud":
            _sinks.append(GCloudSink(project_id=gcloud_project, log_name=gcloud_log_name))

    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            add_timestamp,
            add_logger_name,
            rename_event_key,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            multi_sink_renderer,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Also configure stdlib logging to capture ADK/third-party logs
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stderr,
        level=getattr(logging, level.upper(), logging.INFO),
    )
    # Route stdlib logs through structlog
    structlog.stdlib.recreate_defaults()


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """
    Get a structured logger instance.

    Args:
        name: Logger name (typically __name__)

    Returns:
        Bound logger instance
    """
    return structlog.get_logger(_name=name or "root")


# =============================================================================
# Module Initialization
# =============================================================================

# Default configuration (can be overridden by calling configure_logging)
_default_configured = False


def _ensure_configured() -> None:
    global _default_configured
    if not _default_configured:
        configure_logging()
        _default_configured = True
