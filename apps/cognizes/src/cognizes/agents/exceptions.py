"""Custom exceptions for the application."""

from typing import Any


class BaseAPIException(Exception):
    """API 异常基类."""

    def __init__(
        self,
        message: str,
        code: str | None = None,
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.code = code or self.__class__.__name__
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(BaseAPIException):
    """验证错误."""

    pass


class NotFoundError(BaseAPIException):
    """资源未找到错误."""

    pass


class ProcessingError(BaseAPIException):
    """处理错误."""

    pass


class StorageError(BaseAPIException):
    """存储错误."""

    pass


class ConfigurationError(BaseAPIException):
    """配置错误."""

    pass


class AuthenticationError(BaseAPIException):
    """认证错误."""

    pass


class AuthorizationError(BaseAPIException):
    """授权错误."""

    pass


class RateLimitError(BaseAPIException):
    """速率限制错误."""

    pass


class ServiceUnavailableError(BaseAPIException):
    """服务不可用错误."""

    pass


class TaskError(BaseAPIException):
    """任务执行错误."""

    pass


class AgentError(BaseAPIException):
    """Agent 执行错误."""

    pass


class SkillError(BaseAPIException):
    """Skill 调用错误."""

    pass
