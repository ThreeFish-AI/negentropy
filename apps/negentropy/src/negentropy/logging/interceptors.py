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

    def __init__(self):
        super().__init__()
        self._logger = get_logger("stdlib")

    def emit(self, record: logging.LogRecord) -> None:
        try:
            # Skip if coming from structlog to avoid infinite loops
            # (Though our factory uses PrintLogger/_NOP_FILE, this is extra safety)
            if "structlog" in record.name:
                return

            # Format message using stdlib's formatting (handles %s args)
            msg = self.format(record)

            # Map level
            # Dispatch to structlog
            # We use the original logger name as context
            self._logger.log(level=getattr(logging, record.levelname, logging.INFO), event=msg, logger=record.name)
        except Exception:
            self.handleError(record)


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
