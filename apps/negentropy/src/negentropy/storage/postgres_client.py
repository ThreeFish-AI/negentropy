"""PostgreSQL ``bytea`` 实现的 BlobStorage。

GCS 退役后的唯一 blob 存储后端：知识文档原文 / Markdown 衍生 / 提取图片
资产 / MCP trial 资产统一落入 ``blob_objects`` 表（见
:class:`~negentropy.models.storage.BlobObject`）。

设计：
- 复用 ``db.session.AsyncSessionLocal`` 连接池，与业务表同库（pgvector 唯一
  数据存储哲学）。
- IO 方法为 async，避免在 async 业务层阻塞事件循环。
- ``upload`` 以 ``key`` 为冲突点做 upsert（覆盖写），与原 GCS「同 path 覆盖」
  语义等价。
"""

from __future__ import annotations

import hashlib

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import SQLAlchemyError

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.storage import BlobObject

from .exceptions import StorageError
from .uri import build_uri, parse_uri

logger = get_logger("negentropy.storage.postgres")


class PostgresBlobStorage:
    """``BlobStorage`` 的 PostgreSQL ``bytea`` 实现。

    所有方法语义与原 ``GCSStorageClient`` 等价，仅底层换为本地 PostgreSQL。
    单例由 :func:`get_blob_storage` 提供以便复用；业务层亦可在构造时注入
    测试替身。
    """

    def __init__(self) -> None:
        # BlobObject 在模块顶层导入——blob 存储为唯一后端，模型随本模块加载
        # 注册到 metadata，供 Alembic autogenerate 与建表使用。
        pass

    @staticmethod
    def compute_hash(content: bytes) -> str:
        """计算 SHA-256 哈希（十六进制）。"""
        return hashlib.sha256(content).hexdigest()

    def build_path(self, app_name: str, corpus_segment: str, filename: str) -> str:
        """构造存储 key：``knowledge/{app_name}/{corpus_segment}/{filename}``。

        与原 ``GCSStorageClient.build_gcs_path`` 格式一致（仅函数名中性化）。
        """
        from negentropy.knowledge.ingestion.content import sanitize_filename

        safe_filename = sanitize_filename(filename)
        return f"knowledge/{app_name}/{corpus_segment}/{safe_filename}"

    async def upload(self, content: bytes, path: str, content_type: str | None = None) -> str:
        """上传字节（同 key 覆盖写）并返回 ``pgblob://{path}``。"""
        size = len(content)
        try:
            async with db_session.AsyncSessionLocal() as db:
                stmt = (
                    pg_insert(BlobObject)
                    .values(
                        key=path,
                        content=content,
                        content_type=content_type,
                        size=size,
                    )
                    .on_conflict_do_update(
                        index_elements=[BlobObject.key],
                        set_={
                            "content": content,
                            "content_type": content_type,
                            "size": size,
                        },
                    )
                )
                await db.execute(stmt)
                await db.commit()
        except SQLAlchemyError as exc:
            logger.error("blob_upload_failed", path=path, error=str(exc))
            raise StorageError(f"Failed to upload blob {path}: {exc}") from exc

        uri = build_uri(path)
        logger.info("blob_upload_completed", uri=uri, size=size, content_type=content_type)
        return uri

    async def download(self, uri: str) -> bytes:
        """按 ``pgblob://{key}`` URI 下载字节；不存在抛 ``StorageError``。"""
        key = parse_uri(uri)
        try:
            async with db_session.AsyncSessionLocal() as db:
                result = await db.execute(select(BlobObject.content).where(BlobObject.key == key))
                row = result.one_or_none()
        except SQLAlchemyError as exc:
            logger.error("blob_download_failed", uri=uri, error=str(exc))
            raise StorageError(f"Failed to download blob {uri}: {exc}") from exc

        if row is None:
            raise StorageError(f"Blob not found: {uri}")

        content = row[0]
        logger.info("blob_download_completed", uri=uri, size=len(content))
        return content

    async def get_size(self, uri: str) -> int | None:
        """按 URI 返回对象字节数（仅读 ``size`` 列，不取 ``content``）。"""
        key = parse_uri(uri)
        try:
            async with db_session.AsyncSessionLocal() as db:
                result = await db.execute(select(BlobObject.size).where(BlobObject.key == key))
                row = result.one_or_none()
        except SQLAlchemyError as exc:
            logger.error("blob_get_size_failed", uri=uri, error=str(exc))
            raise StorageError(f"Failed to get blob size {uri}: {exc}") from exc

        return None if row is None else int(row[0])

    async def download_range(self, uri: str, start: int, length: int) -> bytes:
        """下载 ``[start, start+length)`` 字节切片。

        用 PostgreSQL ``substring(content FROM :from FOR :for)`` 只取所需切片，
        避免大 PDF 全量入内存。注意 ``substring`` 为 **1-based**，故 ``start + 1``。
        """
        key = parse_uri(uri)
        try:
            async with db_session.AsyncSessionLocal() as db:
                slice_col = func.substring(BlobObject.content, start + 1, length)
                result = await db.execute(select(slice_col).where(BlobObject.key == key))
                row = result.one_or_none()
        except SQLAlchemyError as exc:
            logger.error("blob_download_range_failed", uri=uri, error=str(exc))
            raise StorageError(f"Failed to download blob range {uri}: {exc}") from exc

        if row is None:
            raise StorageError(f"Blob not found: {uri}")

        # asyncpg 对 bytea 可能回 memoryview，统一归一为 bytes。
        chunk = bytes(row[0])
        logger.info("blob_download_range_completed", uri=uri, start=start, length=len(chunk))
        return chunk

    async def delete(self, uri: str) -> None:
        """按 URI 删除 blob（不存在视为成功，幂等）。"""
        key = parse_uri(uri)
        try:
            async with db_session.AsyncSessionLocal() as db:
                await db.execute(delete(BlobObject).where(BlobObject.key == key))
                await db.commit()
        except SQLAlchemyError as exc:
            logger.error("blob_delete_failed", uri=uri, error=str(exc))
            raise StorageError(f"Failed to delete blob {uri}: {exc}") from exc

        logger.info("blob_delete_completed", uri=uri)

    async def exists(self, path: str) -> bool:
        """按存储 key 检查存在性。"""
        try:
            async with db_session.AsyncSessionLocal() as db:
                result = await db.execute(select(BlobObject.key).where(BlobObject.key == path).limit(1))
                return result.first() is not None
        except SQLAlchemyError as exc:
            logger.error("blob_exists_failed", path=path, error=str(exc))
            raise StorageError(f"Failed to check blob existence {path}: {exc}") from exc


# ---------------------------------------------------------------------------
# 单例工厂
# ---------------------------------------------------------------------------

_blob_storage_instance: PostgresBlobStorage | None = None


def get_blob_storage() -> PostgresBlobStorage:
    """获取 ``PostgresBlobStorage`` 单例。

    PostgreSQL 为唯一 blob 后端，无需枚举切换。测试可通过向
    ``DocumentStorageService`` 注入 Fake 替身来旁路本单例。
    """
    global _blob_storage_instance
    if _blob_storage_instance is None:
        _blob_storage_instance = PostgresBlobStorage()
    return _blob_storage_instance


def reset_blob_storage() -> None:
    """重置单例（测试用）。"""
    global _blob_storage_instance
    _blob_storage_instance = None
