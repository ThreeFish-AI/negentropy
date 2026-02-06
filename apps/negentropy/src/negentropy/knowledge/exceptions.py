"""
Knowledge 模块统一异常体系

遵循 AGENTS.md 的正交分解原则，将异常按领域、基础设施、验证三个维度解耦。

参考文献:
[1] E. Gamma, R. Helm, R. Johnson, and J. Vlissides, "Design Patterns: Elements of Reusable Object-Oriented Software,"
    Addison-Wesley Professional, 1994.
"""

from __future__ import annotations

from typing import Any, Dict, Optional


class KnowledgeError(Exception):
    """Knowledge 模块基础异常类

    所有 Knowledge 相关异常的根节点，便于统一捕获和处理。
    """

    def __init__(
        self,
        message: str,
        *,
        code: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.details = details or {}


# ================================
# 领域异常 (Domain Error)
# 业务逻辑层面的异常，对应业务规则的违背
# ================================


class DomainError(KnowledgeError):
    """领域异常基类

    表示业务逻辑层面的错误，如资源不存在、版本冲突等。
    """

    pass


class CorpusNotFound(DomainError):
    """语料库不存在异常

    当尝试访问不存在的 Corpus 时抛出。
    """

    def __init__(
        self,
        *,
        app_name: str,
        corpus_name: Optional[str] = None,
        corpus_id: Optional[str] = None,
    ) -> None:
        if corpus_name:
            message = f"Corpus '{corpus_name}' not found in app '{app_name}'"
            details = {"app_name": app_name, "corpus_name": corpus_name}
        elif corpus_id:
            message = f"Corpus with id '{corpus_id}' not found"
            details = {"app_name": app_name, "corpus_id": corpus_id}
        else:
            message = f"Corpus not found in app '{app_name}'"
            details = {"app_name": app_name}

        super().__init__(message, code="CORPUS_NOT_FOUND", details=details)


class KnowledgeNotFound(DomainError):
    """知识块不存在异常

    当尝试访问不存在的 Knowledge 时抛出。
    """

    def __init__(
        self,
        *,
        knowledge_id: str,
        corpus_id: Optional[str] = None,
    ) -> None:
        message = f"Knowledge with id '{knowledge_id}' not found"
        details = {"knowledge_id": knowledge_id}
        if corpus_id:
            details["corpus_id"] = corpus_id

        super().__init__(message, code="KNOWLEDGE_NOT_FOUND", details=details)


class VersionConflict(DomainError):
    """版本冲突异常

    当预期版本与实际版本不匹配时抛出，用于乐观锁控制。
    """

    def __init__(
        self,
        *,
        resource_type: str,
        resource_id: str,
        expected_version: int,
        actual_version: int,
    ) -> None:
        message = (
            f"{resource_type} '{resource_id}' version conflict: "
            f"expected {expected_version}, got {actual_version}"
        )
        details = {
            "resource_type": resource_type,
            "resource_id": resource_id,
            "expected_version": expected_version,
            "actual_version": actual_version,
        }
        super().__init__(message, code="VERSION_CONFLICT", details=details)


# ================================
# 基础设施异常 (Infrastructure Error)
# 技术基础设施层面的异常，如外部服务失败、数据库错误等
# ================================


class InfrastructureError(KnowledgeError):
    """基础设施异常基类

    表示技术基础设施层面的错误，如外部服务调用失败、数据库错误等。
    """

    pass


class EmbeddingFailed(InfrastructureError):
    """向量化失败异常

    当调用 Embedding 服务失败时抛出。
    """

    def __init__(
        self,
        *,
        text_preview: str,
        model: str,
        reason: str,
    ) -> None:
        message = f"Embedding failed for model '{model}': {reason}"
        details = {
            "text_preview": text_preview[:100] if text_preview else "",
            "model": model,
            "reason": reason,
        }
        super().__init__(message, code="EMBEDDING_FAILED", details=details)


class SearchError(InfrastructureError):
    """检索失败异常

    当执行检索操作失败时抛出。
    """

    def __init__(
        self,
        *,
        corpus_id: str,
        search_mode: str,
        reason: str,
    ) -> None:
        message = f"Search failed in {search_mode} mode: {reason}"
        details = {
            "corpus_id": corpus_id,
            "search_mode": search_mode,
            "reason": reason,
        }
        super().__init__(message, code="SEARCH_ERROR", details=details)


class DatabaseError(InfrastructureError):
    """数据库操作异常

    当数据库操作失败时抛出。
    """

    def __init__(
        self,
        *,
        operation: str,
        table: str,
        reason: str,
    ) -> None:
        message = f"Database error during {operation} on {table}: {reason}"
        details = {
            "operation": operation,
            "table": table,
            "reason": reason,
        }
        super().__init__(message, code="DATABASE_ERROR", details=details)


# ================================
# 验证异常 (Validation Error)
# 输入验证失败异常，如参数不符合业务规则
# ================================


class ValidationError(KnowledgeError):
    """验证异常基类

    表示输入验证失败，如参数不符合业务规则。
    """

    pass


class InvalidChunkSize(ValidationError):
    """无效的分块大小异常

    当 chunk_size 参数不符合要求时抛出。
    """

    def __init__(
        self,
        *,
        chunk_size: int,
        reason: str,
    ) -> None:
        message = f"Invalid chunk_size {chunk_size}: {reason}"
        details = {
            "chunk_size": chunk_size,
            "reason": reason,
        }
        super().__init__(message, code="INVALID_CHUNK_SIZE", details=details)


class InvalidSearchConfig(ValidationError):
    """无效的检索配置异常

    当搜索配置参数不符合要求时抛出。
    """

    def __init__(
        self,
        *,
        config_key: str,
        config_value: Any,
        reason: str,
    ) -> None:
        message = f"Invalid search config '{config_key}'={config_value}: {reason}"
        details = {
            "config_key": config_key,
            "config_value": str(config_value),
            "reason": reason,
        }
        super().__init__(message, code="INVALID_SEARCH_CONFIG", details=details)


class InvalidMetadata(ValidationError):
    """无效的元数据异常

    当元数据格式不符合要求时抛出。
    """

    def __init__(
        self,
        *,
        field: str,
        reason: str,
    ) -> None:
        message = f"Invalid metadata field '{field}': {reason}"
        details = {
            "field": field,
            "reason": reason,
        }
        super().__init__(message, code="INVALID_METADATA", details=details)
