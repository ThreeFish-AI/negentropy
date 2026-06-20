"""BlobStorage 抽象协议。

正交分解「存储机制」与「业务逻辑」：``DocumentStorageService`` 等业务层依赖
本 Protocol，而非具体的存储实现。当前唯一实现为
:class:`~negentropy.storage.postgres_client.PostgresBlobStorage`（PostgreSQL
``bytea``），测试可用内存 Fake 替身注入。

设计要点：
- IO 方法（``upload``/``download``/``delete``/``exists``）为 **async**——底层
  PostgreSQL 走 ``AsyncSessionLocal``，避免在 async 业务层中阻塞事件循环
  （历史上 GCS 客户端为同步调用，是潜在阻塞隐患）。
- ``compute_hash`` / ``build_path`` 为纯函数，保持同步。
- URI scheme 统一为 ``pgblob://{key}``（见 :mod:`negentropy.storage.uri`）。
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class BlobStorage(Protocol):
    """blob 对象存储的抽象协议。

    覆盖原 ``GCSStorageClient`` 的全部公开能力，方法语义等价、仅切换底层实现。
    """

    @staticmethod
    def compute_hash(content: bytes) -> str:
        """计算内容的 SHA-256 哈希（十六进制）。

        Args:
            content: 文件字节。

        Returns:
            SHA-256 hex 字符串。
        """
        ...

    def build_path(self, app_name: str, corpus_segment: str, filename: str) -> str:
        """构造 blob 存储 key（无 scheme 前缀）。

        格式约定：``knowledge/{app_name}/{corpus_segment}/{filename}``。

        Args:
            app_name: 应用名。
            corpus_segment: corpus 段（corpus_id 或 ``library``）。
            filename: 原始文件名（会被清洗）。

        Returns:
            存储 key。
        """
        ...

    async def upload(self, content: bytes, path: str, content_type: str | None = None) -> str:
        """上传字节并返回 blob URI。

        同 key 重复上传为覆盖写（去重已在业务层按 file_hash 完成）。

        Args:
            content: 文件字节。
            path: 存储 key（``build_path`` 产物）。
            content_type: 可选 MIME。

        Returns:
            ``pgblob://{key}`` URI。

        Raises:
            StorageError: 上传失败。
        """
        ...

    async def download(self, uri: str) -> bytes:
        """按 blob URI 下载字节。

        Args:
            uri: ``pgblob://{key}`` URI。

        Returns:
            文件字节。

        Raises:
            ValueError: URI 非法。
            StorageError: 下载失败 / 对象不存在。
        """
        ...

    async def delete(self, uri: str) -> None:
        """按 blob URI 删除对象（不存在视为成功，幂等）。

        Args:
            uri: ``pgblob://{key}`` URI。

        Raises:
            ValueError: URI 非法。
            StorageError: 删除失败。
        """
        ...

    async def exists(self, path: str) -> bool:
        """按存储 key 检查存在性。

        Args:
            path: 存储 key（无 scheme）。

        Returns:
            是否存在。
        """
        ...
