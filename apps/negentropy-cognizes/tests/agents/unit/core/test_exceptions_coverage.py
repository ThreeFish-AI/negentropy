"""Test exceptions for better coverage."""

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


def test_base_api_exception():
    """Test BaseAPIException initialization."""
    # Test with just message
    err = BaseAPIException("Test error")
    assert err.message == "Test error"
    assert err.code == "BaseAPIException"
    assert err.details == {}
    assert str(err) == "Test error"

    # Test with code
    err = BaseAPIException("Test error", code="CUSTOM_ERROR")
    assert err.code == "CUSTOM_ERROR"

    # Test with details
    err = BaseAPIException("Test error", details={"field": "value"})
    assert err.details == {"field": "value"}

    # Test with both code and details
    err = BaseAPIException("Test error", code="CUSTOM_ERROR", details={"field": "value"})
    assert err.code == "CUSTOM_ERROR"
    assert err.details == {"field": "value"}


def test_all_exceptions_initialization():
    """Test all exception classes initialization."""
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
        err = exc_class(f"Test {exc_class.__name__}")
        assert err.message == f"Test {exc_class.__name__}"
        assert err.code == exc_class.__name__
        assert str(err) == f"Test {exc_class.__name__}"


def test_exceptions_inheritance():
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
        assert issubclass(exc_class, BaseAPIException)
