import sys
import os
from unittest.mock import MagicMock, patch, PropertyMock

from negentropy.engine.factories.artifacts import get_artifact_service, reset_artifact_service
from negentropy.config import settings


def test_inmemory_factory():
    print("Testing InMemory Factory...")
    reset_artifact_service()
    # Mock settings
    with patch("negentropy.config.Settings.artifact_service_backend", new_callable=PropertyMock) as mock_backend:
        mock_backend.return_value = "inmemory"
        service = get_artifact_service()
        print(f"Service created: {service}")
        assert service is not None
        assert "InMemoryArtifactService" in str(type(service))
    print("InMemory Factory Test Passed.")


def test_gcs_factory():
    print("Testing GCS Factory...")
    reset_artifact_service()

    # Mock settings
    with patch("negentropy.config.Settings.artifact_service_backend", new_callable=PropertyMock) as mock_backend:
        mock_backend.return_value = "gcs"
        with patch("negentropy.config.Settings.gcs_bucket_name", new_callable=PropertyMock) as mock_bucket:
            mock_bucket.return_value = "test-bucket"
            # Mock google.auth.default to not raise
            with patch("google.auth.default", return_value=(None, None)):
                # Mock GcsArtifactService to avoid real GCS connection
                with patch("google.adk.artifacts.GcsArtifactService") as MockGcsService:
                    service = get_artifact_service()
                    print(f"Service created: {service}")
                    assert service == MockGcsService.return_value
    print("GCS Factory Test Passed.")


def test_gcs_factory_missing_bucket():
    print("Testing GCS Factory Missing Bucket...")
    reset_artifact_service()

    with patch("negentropy.config.Settings.artifact_service_backend", new_callable=PropertyMock) as mock_backend:
        mock_backend.return_value = "gcs"
        with patch("negentropy.config.Settings.gcs_bucket_name", new_callable=PropertyMock) as mock_bucket:
            mock_bucket.return_value = None
            try:
                get_artifact_service()
                print("FAILED: Should have raised ValueError")
            except ValueError as e:
                print(f"Caught expected error: {e}")
                assert "requires GCS_BUCKET_NAME" in str(e)
    print("GCS Factory Missing Bucket Test Passed.")


if __name__ == "__main__":
    test_inmemory_factory()
    test_gcs_factory()
    test_gcs_factory_missing_bucket()
