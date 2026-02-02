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

        # Shorten logger name (last part only)
        short_logger = logger_name.split(".")[-1] if "." in logger_name else logger_name

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
            output = orjson_dumps(event_dict)
        else:
            output = ConsoleFormatter.format(event_dict)

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
# Interaction Metrics (Value Transmission)
# =============================================================================


class LiteLLMLoggingCallback:
    """Callback to log interaction metrics (token usage, cost, latency) via structlog."""

    def __init__(self) -> None:
        self._logger = get_logger("negentropy.llm.usage")

    def _get_model_cost(self, kwargs: dict) -> float:
        try:
            from litellm import completion_cost

            # Create a mock response object for cost calculation if response_obj is available
            response_obj = kwargs.get("response_obj")
            if response_obj:
                return float(completion_cost(completion_response=response_obj))
            return 0.0
        except Exception:
            return 0.0

    def log_success_event(self, kwargs: dict, response_obj: Any, start_time: Any, end_time: Any) -> None:
        """Log successful LLM interaction."""
        try:
            model = kwargs.get("model", "unknown")
            input_tokens = 0
            output_tokens = 0

            # Extract usage from response
            if hasattr(response_obj, "usage"):
                usage = response_obj.usage
                input_tokens = getattr(usage, "prompt_tokens", 0)
                output_tokens = getattr(usage, "completion_tokens", 0)

            # Calculate cost
            cost = self._get_model_cost({"response_obj": response_obj, "model": model})

            # Calculate latency
            latency_ms = (end_time - start_time).total_seconds() * 1000

            self._logger.info(
                f"[{model}] {input_tokens} -> {output_tokens} tokens",
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=f"{cost:.6f}",
                latency_ms=f"{latency_ms:.0f}",
            )
        except Exception:
            pass  # Fail safe

    def log_failure_event(self, kwargs: dict, response_obj: Any, start_time: Any, end_time: Any) -> None:
        """Log failed LLM interaction."""
        try:
            model = kwargs.get("model", "unknown")
            exception = kwargs.get("exception", "unknown error")

            latency_ms = (end_time - start_time).total_seconds() * 1000

            get_logger("negentropy.llm.error").error(
                f"[{model}] Failed: {str(exception)}",
                model=model,
                error=str(exception),
                latency_ms=f"{latency_ms:.0f}",
            )
        except Exception:
            pass


# =============================================================================
# Configuration & Public API
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
            _sinks.append(StdioSink(fmt=log_format))
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


def _intercept_third_party_loggers() -> None:
    """Intercept and reconfigure third-party libraries (Uvicorn, LiteLLM)."""
    # 1. Uvicorn: Remove default handlers and propagate to root (handled by structlog)
    for logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
        lg = logging.getLogger(logger_name)
        lg.handlers = []  # Remove Uvicorn's default handlers
        lg.propagate = True

    # 2. LiteLLM: Suppress internal logging to avoid noise and use callback instead
    litellm_logger = logging.getLogger("LiteLLM")
    litellm_logger.handlers = []
    litellm_logger.propagate = False  # Completely silence internal logs
    litellm_logger.setLevel(logging.CRITICAL)  # Only critical errors (if any)


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
    # 1. Initialize Sinks
    _initialize_sinks(sinks, fmt, file_path, gcloud_project, gcloud_log_name)

    # 2. Configure Structlog
    _configure_structlog(level)

    # 3. Configure Stdlib Logging (Root)
    root_level = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stderr,
        level=root_level,
        force=True,
    )

    # 4. Intercept Third-Party Loggers
    _intercept_third_party_loggers()

    # 5. Intercept sys.stdout & sys.stderr (for random prints like "Local timezone: ...")
    # Store original streams to avoid recursion and for attribute proxying
    if not isinstance(sys.stdout, StreamToLogger):
        sys.stdout = StreamToLogger(get_logger("stdout"), logging.INFO, sys.stdout)

    if not isinstance(sys.stderr, StreamToLogger):
        sys.stderr = StreamToLogger(get_logger("stderr"), logging.INFO, sys.stderr)


class StreamToLogger:
    """Redirects writes to a logger instance."""

    def __init__(self, logger: structlog.stdlib.BoundLogger, level: int, original_stream: Any):
        self.logger = logger
        self.level = level
        self.original_stream = original_stream
        self.linebuf = ""

    def write(self, buf: str | bytes) -> None:
        if isinstance(buf, bytes):
            buf = buf.decode(self.encoding, errors="replace")

        for line in buf.splitlines(True):
            # If the line ends with a newline, log it immediately
            if line.endswith("\n"):
                self.linebuf += line.rstrip()
                if self.linebuf:
                    self.logger.log(self.level, self.linebuf)
                self.linebuf = ""
            else:
                self.linebuf += line

    def flush(self) -> None:
        if self.linebuf:
            self.logger.log(self.level, self.linebuf)
            self.linebuf = ""

    def isatty(self) -> bool:
        return False

    @property
    def encoding(self) -> str:
        return getattr(self.original_stream, "encoding", "utf-8")

    def __getattr__(self, name: str) -> Any:
        return getattr(self.original_stream, name)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Get a structured logger instance."""
    return structlog.get_logger(_name=name or "root")
