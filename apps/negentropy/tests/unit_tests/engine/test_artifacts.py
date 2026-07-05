from unittest.mock import PropertyMock, patch

import pytest

from negentropy.engine.factories.artifacts import (
    ArtifactBackend,
    get_artifact_service,
    reset_artifact_service,
)


def test_inmemory_factory():
    """inmemory 后端：返回 ADK InMemoryArtifactService。"""
    reset_artifact_service()
    with patch("negentropy.config.Settings.artifact_service_backend", new_callable=PropertyMock) as mock_backend:
        mock_backend.return_value = "inmemory"
        service = get_artifact_service()
        assert service is not None
        assert "InMemoryArtifactService" in str(type(service))


def test_postgres_factory():
    """postgres 后端：返回自研 PostgresArtifactService。"""
    reset_artifact_service()
    with patch("negentropy.config.Settings.artifact_service_backend", new_callable=PropertyMock) as mock_backend:
        mock_backend.return_value = "postgres"
        service = get_artifact_service()
        from negentropy.engine.adapters.postgres.artifact_service import PostgresArtifactService

        assert isinstance(service, PostgresArtifactService)


def test_unsupported_backend_raises():
    """不支持的后端（含已退役的 gcs）应抛 ValueError。"""
    reset_artifact_service()
    with patch("negentropy.config.Settings.artifact_service_backend", new_callable=PropertyMock) as mock_backend:
        mock_backend.return_value = "gcs"  # GCS 已退役
        with pytest.raises(ValueError, match="Unsupported artifact backend"):
            get_artifact_service()


def test_backend_enum_no_gcs():
    """ArtifactBackend 不再包含 GCS 选项。"""
    values = {b.value for b in ArtifactBackend}
    assert values == {"inmemory", "postgres"}
    assert "gcs" not in values


if __name__ == "__main__":
    test_inmemory_factory()
    test_postgres_factory()
    test_unsupported_backend_raises()
    test_backend_enum_no_gcs()
