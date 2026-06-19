"""Storage module for document management.

blob 存储统一经 :class:`~negentropy.storage.protocol.BlobStorage` 抽象，由
:class:`~negentropy.storage.postgres_client.PostgresBlobStorage`（PostgreSQL
``bytea``）实现。``DocumentStorageService`` 为知识文档的高层协调服务
（去重 / 元数据 / 衍生资产）。
"""

from .exceptions import StorageError
from .postgres_client import PostgresBlobStorage, get_blob_storage, reset_blob_storage
from .protocol import BlobStorage
from .service import DocumentStorageService
from .uri import BLOB_SCHEME, build_uri, is_blob_uri, parse_uri

__all__ = [
    # 抽象与异常
    "BlobStorage",
    "StorageError",
    # blob URI 工具
    "BLOB_SCHEME",
    "build_uri",
    "parse_uri",
    "is_blob_uri",
    # PostgreSQL blob 后端
    "PostgresBlobStorage",
    "get_blob_storage",
    "reset_blob_storage",
    # 高层服务
    "DocumentStorageService",
]
