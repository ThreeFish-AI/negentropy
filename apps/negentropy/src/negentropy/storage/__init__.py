"""Storage module for document management.

This module provides GCS-based storage services for knowledge documents.
"""

from .gcs_client import GCSStorageClient
from .service import DocumentStorageService

__all__ = ["GCSStorageClient", "DocumentStorageService"]
