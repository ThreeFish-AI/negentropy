"""
I/O redirection utilities.
"""

from typing import Any
import inspect
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
