"""
Log sink abstractions and concrete implementations.
"""

from __future__ import annotations

import sys
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any, Literal
from pathlib import Path
import orjson
from structlog.typing import EventDict

from .formatters import ConsoleFormatter

if TYPE_CHECKING:
    from google.cloud.logging import Client as GCloudLoggingClient

LogFormat = Literal["console", "json"]


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
            output = orjson_dumps(event_dict)
        else:
            use_color = bool(getattr(self._stream, "isatty", lambda: False)())
            output = ConsoleFormatter.format(event_dict, use_color=use_color)

        self._stream.write(output + "\n")
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
