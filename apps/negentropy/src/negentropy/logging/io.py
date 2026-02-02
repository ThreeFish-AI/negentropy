"""
I/O redirection utilities.
"""

from typing import Any
import structlog


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
                    # Log as raw message to avoid double formatting if possible,
                    # but here we are in structlog world.
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

    # Proxy all other methods to original stream
    def __getattr__(self, name: str) -> Any:
        return getattr(self.original_stream, name)

    @property
    def encoding(self) -> str:
        return getattr(self.original_stream, "encoding", "utf-8")
