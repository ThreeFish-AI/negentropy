"""
Unified Logging Service for Negentropy.

Provides structured logging with multiple sink support:
- stdio: Standard output (console/json format)
- file: Local file rotation with JSON
- gcloud: Google Cloud Logging (production)

Design Pattern: Strategy Pattern for sink abstraction.
Library: structlog + orjson for high-performance JSON serialization.
"""

from .core import configure_logging, get_logger

__all__ = ["configure_logging", "get_logger"]
