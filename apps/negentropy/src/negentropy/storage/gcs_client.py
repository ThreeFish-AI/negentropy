"""GCS Storage Client for knowledge documents.

This module provides a wrapper around Google Cloud Storage for
uploading, downloading, and managing document files.
"""

from __future__ import annotations

import hashlib
from io import BytesIO
from typing import Optional

import google.auth
from google.cloud import storage
from google.cloud.exceptions import GoogleCloudError

from negentropy.config import settings
from negentropy.logging import get_logger

logger = get_logger("negentropy.storage.gcs")


class GCSStorageClient:
    """GCS storage client for knowledge documents.

    Reuses existing GCS configuration from settings.
    Implements singleton pattern for efficient client reuse.
    """

    _instance: Optional["GCSStorageClient"] = None

    def __init__(self, bucket_name: str):
        self._bucket_name = bucket_name
        self._client: Optional[storage.Client] = None
        self._bucket: Optional[storage.Bucket] = None

    @classmethod
    def get_instance(cls) -> "GCSStorageClient":
        """Get singleton instance of GCS client.

        Raises:
            ValueError: If GCS bucket name is not configured
        """
        if cls._instance is None:
            if not settings.gcs_bucket_name:
                raise ValueError("GCS bucket name not configured (NE_SVC_GCS_BUCKET_NAME)")
            cls._instance = cls(settings.gcs_bucket_name)
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Reset singleton instance (useful for testing)."""
        cls._instance = None

    def _ensure_client(self) -> None:
        """Lazy initialization of GCS client."""
        if self._client is None:
            credentials, project = google.auth.default()
            self._client = storage.Client(credentials=credentials, project=project)
            self._bucket = self._client.bucket(self._bucket_name)
            logger.info("gcs_client_initialized", bucket=self._bucket_name, project=project)

    @staticmethod
    def compute_hash(content: bytes) -> str:
        """Compute SHA-256 hash of file content.

        Args:
            content: File content as bytes

        Returns:
            Hexadecimal string of SHA-256 hash
        """
        return hashlib.sha256(content).hexdigest()

    def build_gcs_path(self, app_name: str, corpus_id: str, filename: str) -> str:
        """Build GCS object path.

        Format: knowledge/{app_name}/{corpus_id}/{filename}

        Args:
            app_name: Application name
            corpus_id: Corpus UUID
            filename: Original filename (will be sanitized)

        Returns:
            GCS object path
        """
        from negentropy.knowledge.content import sanitize_filename

        safe_filename = sanitize_filename(filename)
        return f"knowledge/{app_name}/{corpus_id}/{safe_filename}"

    def upload(self, content: bytes, gcs_path: str, content_type: Optional[str] = None) -> str:
        """Upload file content to GCS.

        Args:
            content: File content as bytes
            gcs_path: GCS object path (without gs://bucket/ prefix)
            content_type: MIME type of the file

        Returns:
            Full GCS URI (gs://bucket/path)

        Raises:
            StorageError: If upload fails
        """
        self._ensure_client()

        blob = self._bucket.blob(gcs_path)

        try:
            blob.upload_from_file(
                BytesIO(content),
                content_type=content_type or "application/octet-stream",
            )
        except GoogleCloudError as exc:
            logger.error("gcs_upload_failed", gcs_path=gcs_path, error=str(exc))
            raise StorageError(f"Failed to upload file to GCS: {exc}") from exc

        gcs_uri = f"gs://{self._bucket_name}/{gcs_path}"

        logger.info(
            "gcs_upload_completed",
            gcs_uri=gcs_uri,
            size=len(content),
            content_type=content_type,
        )

        return gcs_uri

    def download(self, gcs_uri: str) -> bytes:
        """Download file content from GCS.

        Args:
            gcs_uri: Full GCS URI (gs://bucket/path)

        Returns:
            File content as bytes

        Raises:
            ValueError: If URI format is invalid
            StorageError: If download fails
        """
        self._ensure_client()

        if not gcs_uri.startswith("gs://"):
            raise ValueError(f"Invalid GCS URI format: {gcs_uri}")

        path = gcs_uri.replace(f"gs://{self._bucket_name}/", "")
        blob = self._bucket.blob(path)

        try:
            content = blob.download_as_bytes()
            logger.info("gcs_download_completed", gcs_uri=gcs_uri, size=len(content))
            return content
        except GoogleCloudError as exc:
            logger.error("gcs_download_failed", gcs_uri=gcs_uri, error=str(exc))
            raise StorageError(f"Failed to download file from GCS: {exc}") from exc

    def delete(self, gcs_uri: str) -> None:
        """Delete file from GCS.

        Args:
            gcs_uri: Full GCS URI (gs://bucket/path)

        Raises:
            ValueError: If URI format is invalid
            StorageError: If deletion fails
        """
        self._ensure_client()

        if not gcs_uri.startswith("gs://"):
            raise ValueError(f"Invalid GCS URI format: {gcs_uri}")

        path = gcs_uri.replace(f"gs://{self._bucket_name}/", "")
        blob = self._bucket.blob(path)

        try:
            blob.delete()
            logger.info("gcs_delete_completed", gcs_uri=gcs_uri)
        except GoogleCloudError as exc:
            logger.error("gcs_delete_failed", gcs_uri=gcs_uri, error=str(exc))
            raise StorageError(f"Failed to delete file from GCS: {exc}") from exc

    def exists(self, gcs_path: str) -> bool:
        """Check if file exists in GCS.

        Args:
            gcs_path: GCS object path (without gs://bucket/ prefix)

        Returns:
            True if file exists, False otherwise
        """
        self._ensure_client()
        blob = self._bucket.blob(gcs_path)
        return blob.exists()


class StorageError(Exception):
    """Exception raised for storage operation failures."""

    pass
