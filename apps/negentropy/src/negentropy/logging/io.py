"""
I/O redirection utilities.
"""

from __future__ import annotations

import inspect
import logging
import os
import re
from typing import Any

import structlog


class StreamToLogger:
    """Redirects writes to a logger instance."""

    def __init__(self, logger: structlog.stdlib.BoundLogger, level: int, original_stream: Any):
        self.logger = logger
        self.level = level
        self.original_stream = original_stream
        self.linebuf = ""

    def _infer_source(self) -> str | None:
        frame = inspect.currentframe()
        if frame is None:
            return None

        frame = frame.f_back
        for _ in range(20):
            if frame is None:
                break
            module = frame.f_globals.get("__name__", "")
            if module and not module.startswith(("negentropy.logging", "logging", "structlog")):
                return self._simplify_module_name(module)
            frame = frame.f_back

        return None

    @staticmethod
    def _simplify_module_name(name: str) -> str:
        if name.startswith(("google.adk", "google_adk")):
            parts = name.replace("google_adk.google.adk", "adk").replace("google.adk", "adk").split(".")
            if len(parts) >= 2:
                return f"adk.{parts[-1]}"
            return "adk"
        if name == "__main__":
            return "main"
        return name

    def write(self, buf: str | bytes) -> None:
        if isinstance(buf, bytes):
            buf = buf.decode(self.encoding, errors="replace")

        for line in buf.splitlines(True):
            # If the line ends with a newline, log it immediately
            if line.endswith("\n"):
                self.linebuf += line.rstrip()
                if self.linebuf:
                    # Log as raw message to avoid double formatting if possible,
                    # but here we are in structlog world.
                    source = self._infer_source()
                    if source:
                        self.logger.log(self.level, event=self.linebuf, source=source)
                    else:
                        self.logger.log(self.level, self.linebuf)
                self.linebuf = ""
            else:
                self.linebuf += line

    def flush(self) -> None:
        if self.linebuf:
            source = self._infer_source()
            if source:
                self.logger.log(self.level, event=self.linebuf, source=source)
            else:
                self.logger.log(self.level, self.linebuf)
            self.linebuf = ""

    def isatty(self) -> bool:
        return False

    # Proxy all other methods to original stream
    def __getattr__(self, name: str) -> Any:
        return getattr(self.original_stream, name)

    @property
    def encoding(self) -> str:
        return getattr(self.original_stream, "encoding", "utf-8")


class ExternalProcessLogStream:
    """Adapt external process stderr writes into the unified logging pipeline."""

    _PREFIX_PATTERN = re.compile(r"^\[(?P<timestamp>[^\]]+)\]\s+(?P<level>[A-Z]+):\s*(?P<message>.*)$")
    _LEVELS = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARN": logging.WARNING,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "FATAL": logging.CRITICAL,
        "CRITICAL": logging.CRITICAL,
    }

    def __init__(
        self,
        logger: structlog.stdlib.BoundLogger,
        *,
        source: str,
        default_level: int = logging.INFO,
        encoding: str = "utf-8",
    ) -> None:
        self.logger = logger
        self.source = source
        self.default_level = default_level
        self._encoding = encoding
        self._linebuf = ""

    def write(self, buf: str | bytes) -> int:
        if isinstance(buf, bytes):
            buf = buf.decode(self._encoding, errors="replace")

        self._linebuf += buf
        while "\n" in self._linebuf:
            line, self._linebuf = self._linebuf.split("\n", 1)
            self._emit_line(line.rstrip("\r"))

        return len(buf)

    def flush(self) -> None:
        if self._linebuf:
            self._emit_line(self._linebuf.rstrip("\r"))
            self._linebuf = ""

    def isatty(self) -> bool:
        return False

    @property
    def encoding(self) -> str:
        return self._encoding

    def _emit_line(self, line: str) -> None:
        if not line:
            return

        match = self._PREFIX_PATTERN.match(line)
        event: dict[str, Any] = {"source": self.source}
        level = self.default_level
        message = line

        if match:
            message = match.group("message")
            level = self._LEVELS.get(match.group("level"), self.default_level)
            timestamp = match.group("timestamp")
            if timestamp:
                event["timestamp"] = timestamp

        self.logger.log(level, event=message, **event)


def derive_external_process_source(command: str, args: list[str] | None = None) -> str:
    """Generate a stable source label for external process log streams."""

    candidates = [arg for arg in (args or []) if arg and not arg.startswith("-")]
    raw_label = candidates[0] if candidates else command
    normalized = os.path.basename(raw_label.rstrip("/")) or command
    if normalized.startswith("@") and "/" in raw_label:
        normalized = raw_label.split("/")[-1]
    return f"mcp.{normalized}"
