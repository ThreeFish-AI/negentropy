"""
Interceptors for capturing standard library and third-party logs.
"""

import logging
from .core import get_logger


class RedirectStdLibHandler(logging.Handler):
    """
    Redirect standard library logging events to structlog.
    This ensures all third-party logs (google-adk, uvicorn, etc.)
    pass through our unified sink pipeline.
    """

    def emit(self, record: logging.LogRecord) -> None:
        try:
            # Skip if coming from structlog to avoid infinite loops
            # (Though our factory uses PrintLogger/_NOP_FILE, this is extra safety)
            if "structlog" in record.name:
                return

            # Format message using stdlib's formatting (handles %s args)
            msg = self.format(record)

            # Derive a clean logger name from the record
            # e.g., "google.adk.cli.fast_api" -> "fast_api"
            #       "uvicorn.access" -> "uvicorn.access"
            logger_name = self._simplify_logger_name(record.name)

            # DEBUG: uncomment to trace logger names
            # print(f"[DEBUG] record.name={record.name!r} -> logger_name={logger_name!r}")

            # Get a structlog logger with the actual module name
            logger = get_logger(logger_name)

            # Map level and dispatch
            logger.log(level=getattr(logging, record.levelname, logging.INFO), event=msg)
        except Exception:
            self.handleError(record)

    @staticmethod
    def _simplify_logger_name(name: str) -> str:
        """
        Simplify a logger name for display.

        Rules:
        - "google.adk.cli.utils.logs" -> "adk.logs"
        - "google_adk.google.adk.sessions..." -> "adk.sessions"
        - "uvicorn.access" -> "uvicorn.access"
        - Other -> keep last 2 parts
        """
        if not name:
            return "stdlib"

        # Handle Google ADK loggers (normalize various prefixes)
        if name.startswith(("google.adk", "google_adk")):
            # Extract everything after "google.adk" or "google_adk.google.adk"
            parts = name.replace("google_adk.google.adk", "adk").replace("google.adk", "adk").split(".")
            # Keep adk + last significant part
            if len(parts) >= 2:
                return f"adk.{parts[-1]}"
            return "adk"

        # For uvicorn, httpcore, etc., keep as-is if short
        parts = name.split(".")
        if len(parts) <= 2:
            return name

        # For other long names, keep last 2 parts
        return ".".join(parts[-2:])



def intercept_third_party_loggers() -> None:
    """Intercept and reconfigure third-party libraries."""

    # 1. Direct interception of known roots
    roots = [
        "uvicorn",
        "uvicorn.access",
        "uvicorn.error",
        "google_adk",
        "google.adk",
    ]

    for logger_name in roots:
        lg = logging.getLogger(logger_name)
        lg.handlers = []
        lg.propagate = True

    # 2. Aggressive walk to catch existing child loggers
    # This ensures loggers like 'google_adk.google.adk.sessions...' are caught
    # even if they were initialized with handlers before we got here.
    logger_dict = logging.Logger.manager.loggerDict
    for name, logger in logger_dict.items():
        if isinstance(logger, logging.PlaceHolder):
            continue

        # Check if this logger belongs to one of our targets
        if any(name.startswith(root) for root in roots):
            logger.handlers = []
            logger.propagate = True

    # LiteLLM special handling
    litellm_logger = logging.getLogger("LiteLLM")
    litellm_logger.handlers = []
    litellm_logger.propagate = False
    litellm_logger.setLevel(logging.CRITICAL)

    # 3. Patch Uvicorn's configuration logic to prevent it from hijacking
    # the root logger or re-adding handlers we just removed.
    try:
        from uvicorn.config import Config

        def noop_configure_logging(self):
            pass

        # Swap the method
        Config.configure_logging = noop_configure_logging
    except ImportError:
        pass

    # 4. Patch Google ADK's logger setup
    try:
        from google.adk.cli.utils import logs

        def noop_setup_adk_logger(level=logging.INFO):
            pass

        logs.setup_adk_logger = noop_setup_adk_logger
    except ImportError:
        pass
