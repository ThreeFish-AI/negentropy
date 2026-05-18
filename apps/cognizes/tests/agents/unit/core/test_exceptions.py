"""Unit tests for core exceptions."""

import pytest

from cognizes.agents.exceptions import (
    AgentError,
    AuthenticationError,
    AuthorizationError,
    BaseAPIException,
    ConfigurationError,
    NotFoundError,
    ProcessingError,
    RateLimitError,
    ServiceUnavailableError,
    SkillError,
    StorageError,
    TaskError,
    ValidationError,
)


@pytest.mark.unit
class TestBaseAPIException:
    """Test cases for BaseAPIException."""

    def test_basic_exception(self):
        """Test basic exception creation."""
        exc = BaseAPIException("Test message")
        assert exc.message == "Test message"
        assert exc.code == "BaseAPIException"
        assert exc.details == {}
        assert str(exc) == "Test message"

    def test_exception_with_code(self):
        """Test exception with custom code."""
        exc = BaseAPIException("Test message", code="CUSTOM_CODE")
        assert exc.message == "Test message"
        assert exc.code == "CUSTOM_CODE"

    def test_exception_with_details(self):
        """Test exception with details."""
        details = {"field": "value", "number": 42}
        exc = BaseAPIException("Test message", details=details)
        assert exc.message == "Test message"
        assert exc.details == details

    def test_exception_with_code_and_details(self):
        """Test exception with both code and details."""
        details = {"error": "Invalid input"}
        exc = BaseAPIException("Test message", code="VALIDATION_ERROR", details=details)
        assert exc.message == "Test message"
        assert exc.code == "VALIDATION_ERROR"
        assert exc.details == details


@pytest.mark.unit
class TestSpecificExceptions:
    """Test cases for specific exception classes."""

    def test_validation_error(self):
        """Test ValidationError."""
        exc = ValidationError("Invalid data")
        assert isinstance(exc, BaseAPIException)
        assert exc.message == "Invalid data"
        assert exc.code == "ValidationError"

    def test_not_found_error(self):
        """Test NotFoundError."""
        exc = NotFoundError("Resource not found")
        assert isinstance(exc, BaseAPIException)
        assert exc.message == "Resource not found"
        assert exc.code == "NotFoundError"

    def test_processing_error(self):
        """Test ProcessingError."""
        exc = ProcessingError("Processing failed")
        assert isinstance(exc, BaseAPIException)
        assert exc.message == "Processing failed"
        assert exc.code == "ProcessingError"

    def test_storage_error(self):
        """Test StorageError."""
        exc = StorageError("Storage error")
        assert isinstance(exc, BaseAPIException)
        assert exc.message == "Storage error"
        assert exc.code == "StorageError"

    def test_configuration_error(self):
        """Test ConfigurationError."""
        exc = ConfigurationError("Invalid configuration")
        assert isinstance(exc, BaseAPIException)
        assert exc.message == "Invalid configuration"
        assert exc.code == "ConfigurationError"

    def test_authentication_error(self):
        """Test AuthenticationError."""
        exc = AuthenticationError("Authentication failed")
        assert isinstance(exc, BaseAPIException)
        assert exc.message == "Authentication failed"
        assert exc.code == "AuthenticationError"

    def test_authorization_error(self):
        """Test AuthorizationError."""
        exc = AuthorizationError("Access denied")
        assert isinstance(exc, BaseAPIException)
        assert exc.message == "Access denied"
        assert exc.code == "AuthorizationError"

    def test_rate_limit_error(self):
        """Test RateLimitError."""
        exc = RateLimitError("Too many requests")
        assert isinstance(exc, BaseAPIException)
        assert exc.message == "Too many requests"
        assert exc.code == "RateLimitError"

    def test_service_unavailable_error(self):
        """Test ServiceUnavailableError."""
        exc = ServiceUnavailableError("Service down")
        assert isinstance(exc, BaseAPIException)
        assert exc.message == "Service down"
        assert exc.code == "ServiceUnavailableError"

    def test_task_error(self):
        """Test TaskError."""
        exc = TaskError("Task execution failed")
        assert isinstance(exc, BaseAPIException)
        assert exc.message == "Task execution failed"
        assert exc.code == "TaskError"

    def test_agent_error(self):
        """Test AgentError."""
        exc = AgentError("Agent error")
        assert isinstance(exc, BaseAPIException)
        assert exc.message == "Agent error"
        assert exc.code == "AgentError"

    def test_skill_error(self):
        """Test SkillError."""
        exc = SkillError("Skill invocation failed")
        assert isinstance(exc, BaseAPIException)
        assert exc.message == "Skill invocation failed"
        assert exc.code == "SkillError"

    def test_exception_inheritance_chain(self):
        """Test that all exceptions inherit from BaseAPIException."""
        exceptions = [
            ValidationError,
            NotFoundError,
            ProcessingError,
            StorageError,
            ConfigurationError,
            AuthenticationError,
            AuthorizationError,
            RateLimitError,
            ServiceUnavailableError,
            TaskError,
            AgentError,
            SkillError,
        ]

        for exc_class in exceptions:
            exc = exc_class("Test")
            assert isinstance(exc, BaseAPIException)
            assert isinstance(exc, Exception)

    def test_exception_with_full_details(self):
        """Test exception with all parameters."""
        details = {
            "user_id": "123",
            "resource": "paper",
            "action": "delete",
            "timestamp": "2024-01-01T00:00:00Z",
        }
        exc = AuthorizationError(
            "User not authorized",
            code="AUTH_FAILED",
            details=details,
        )
        assert exc.message == "User not authorized"
        assert exc.code == "AUTH_FAILED"
        assert exc.details == details
