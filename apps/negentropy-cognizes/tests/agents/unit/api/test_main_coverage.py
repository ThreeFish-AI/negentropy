"""Test main app for better coverage."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from cognizes.api.main import app


def test_app_creation():
    """Test FastAPI app creation and configuration."""
    # Test that app is properly configured
    assert app.title == "Agentic AI Papers API"
    assert app.description == "AI 论文收集、翻译和管理平台 API"
    assert app.version == "1.0.0"
    assert app.docs_url == "/docs"
    assert app.redoc_url == "/redoc"


def test_app_routes():
    """Test that app has the expected routes."""
    client = TestClient(app)

    # Test root route
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data
    assert "docs" in data
    assert "health" in data

    # Test health route
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "agentic-ai-cognizes-api"
    assert data["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_lifespan_context_manager():
    """Test lifespan context manager."""
    from cognizes.api.main import lifespan

    # Test successful initialization and cleanup
    with patch("cognizes.api.services.task_service.task_service") as mock_service:
        mock_service.initialize = AsyncMock()
        mock_service.cleanup = AsyncMock()

        async with lifespan(app):
            pass

        mock_service.initialize.assert_called_once()
        mock_service.cleanup.assert_called_once()


@pytest.mark.asyncio
async def test_lifespan_initialization_failure():
    """Test lifespan with initialization failure."""
    from cognizes.api.main import lifespan

    with patch("cognizes.api.services.task_service.task_service") as mock_service:
        mock_service.initialize = AsyncMock(side_effect=Exception("Init failed"))

        with pytest.raises(Exception, match="Init failed"):
            async with lifespan(app):
                pass


def test_exception_handler_import():
    """Test that exception handler can be imported."""
    from cognizes.api.main import global_exception_handler

    assert callable(global_exception_handler)
