"""Document Storage Service for managing uploaded documents.

This module provides high-level operations for document storage,
including deduplication, listing, and deletion.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA
from negentropy.models.perception import KnowledgeDocument
from negentropy.serialization import strip_nul_chars

from .exceptions import StorageError
from .postgres_client import get_blob_storage
from .protocol import BlobStorage
from .uri import build_uri, is_blob_uri

logger = get_logger("negentropy.storage.service")


class DocumentStorageService:
    """Service for managing document storage and deduplication.

    This service coordinates between blob storage (PostgreSQL ``bytea`` via
    :class:`~negentropy.storage.protocol.BlobStorage`) and database metadata,
    handling file deduplication based on content hash.
    """

    def __init__(self, blob_storage: BlobStorage | None = None):
        self._blob = blob_storage

    def _get_blob(self) -> BlobStorage:
        """Get blob storage (lazy initialization, defaults to Postgres singleton)."""
        if self._blob is None:
            self._blob = get_blob_storage()
        return self._blob

    @staticmethod
    def _corpus_segment(corpus_id: UUID | None) -> str:
        """GCS 路径中的 corpus 段；库文档（corpus_id=None）固定为 ``library``。

        ``library`` 不可能与 UUID 段冲突，单一收口覆盖原始 / derived / assets 路径。
        """
        return str(corpus_id) if corpus_id else "library"

    @classmethod
    def _build_markdown_path(
        cls,
        *,
        app_name: str,
        corpus_id: UUID | None,
        document_id: UUID,
        filename: str,
    ) -> str:
        """构建 Markdown 衍生文件路径。"""
        stem = Path(filename).stem or "document"
        safe_stem = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in stem)[:120] or "document"
        return f"knowledge/{app_name}/{cls._corpus_segment(corpus_id)}/derived/{document_id}/{safe_stem}.md"

    @classmethod
    def _build_asset_path(
        cls,
        *,
        app_name: str,
        corpus_id: UUID | None,
        document_id: UUID,
        filename: str,
    ) -> str:
        safe_name = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in filename)[:180] or "asset"
        return f"knowledge/{app_name}/{cls._corpus_segment(corpus_id)}/derived/{document_id}/assets/{safe_name}"

    async def check_duplicate(
        self,
        corpus_id: UUID | None,
        file_hash: str,
        *,
        app_name: str | None = None,
    ) -> KnowledgeDocument | None:
        """Check if document with same hash exists in corpus (any status).

        查询范围包含所有状态（active / deleted 等），以匹配数据库唯一约束的实际覆盖范围：
        - corpus 文档：``uq_knowledge_documents_corpus_hash(corpus_id, file_hash)``；
        - 库文档（corpus_id=None）：部分唯一索引
          ``uq_knowledge_documents_library_hash(app_name, file_hash) WHERE corpus_id IS NULL``，
          此时 ``app_name`` 必填（app 为租户边界）。

        Args:
            corpus_id: Corpus UUID；``None`` 表示文档库
            file_hash: SHA-256 hash of file content
            app_name: 库文档查重所需的 app 边界

        Returns:
            Existing document record if found (including soft-deleted), None otherwise
        """
        if corpus_id is None and not app_name:
            raise ValueError("app_name is required when checking library document duplicates")

        if corpus_id is None:
            stmt = select(KnowledgeDocument).where(
                KnowledgeDocument.corpus_id.is_(None),
                KnowledgeDocument.app_name == app_name,
                KnowledgeDocument.file_hash == file_hash,
            )
        else:
            stmt = select(KnowledgeDocument).where(
                KnowledgeDocument.corpus_id == corpus_id,
                KnowledgeDocument.file_hash == file_hash,
            )
        async with AsyncSessionLocal() as db:
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

    async def _best_effort_cleanup(
        self,
        *,
        old_uri: str | None,
        old_markdown_uri: str | None,
        old_metadata: dict | None,
    ) -> None:
        """Best-effort 清理旧 blob 资源，失败仅记录日志，不阻断主流程。"""
        blob = self._get_blob()
        for uri in (old_uri, old_markdown_uri):
            if uri:
                try:
                    await blob.delete(uri)
                except StorageError:
                    logger.warning("reactivate_old_blob_cleanup_failed", uri=uri)

        old_assets = (old_metadata or {}).get("extracted_assets")
        if isinstance(old_assets, list):
            for asset in old_assets:
                if isinstance(asset, dict):
                    uri = asset.get("uri")
                    if isinstance(uri, str) and is_blob_uri(uri):
                        try:
                            await blob.delete(uri)
                        except StorageError:
                            logger.warning("reactivate_old_asset_cleanup_failed", uri=uri)

    async def _reactivate_document(
        self,
        existing_doc: KnowledgeDocument,
        app_name: str,
        content: bytes,
        filename: str,
        content_type: str | None = None,
        metadata: dict | None = None,
        created_by: str | None = None,
    ) -> KnowledgeDocument:
        """复活 soft-deleted 文档：重新上传 blob 并更新记录状态。

        soft-delete 后 blob 可能已被清理，因此需要重新上传。
        同时重置 Markdown 提取状态以触发重新提取。
        """
        blob = self._get_blob()
        blob_path = blob.build_path(app_name, self._corpus_segment(existing_doc.corpus_id), filename)

        blob_uri = await blob.upload(
            content=content,
            path=blob_path,
            content_type=content_type,
        )

        async with AsyncSessionLocal() as db:
            stmt = select(KnowledgeDocument).where(KnowledgeDocument.id == existing_doc.id)
            result = await db.execute(stmt)
            doc = result.scalar_one_or_none()
            if not doc:
                raise StorageError(f"Document {existing_doc.id} disappeared during reactivation")

            # Best-effort 清理旧 blob 资源，防止孤立对象积累
            await self._best_effort_cleanup(
                old_uri=doc.content_uri if doc.content_uri != blob_uri else None,
                old_markdown_uri=doc.markdown_uri,
                old_metadata=doc.metadata_,
            )

            doc.status = "active"
            doc.content_uri = blob_uri
            doc.original_filename = filename
            doc.content_type = content_type
            doc.file_size = len(content)
            doc.metadata_ = metadata or {}
            doc.created_by = created_by
            doc.markdown_content = None
            doc.markdown_uri = None
            doc.markdown_extract_status = "pending"
            doc.markdown_extract_error = None
            doc.markdown_extracted_at = None

            await db.commit()
            await db.refresh(doc)

            logger.info(
                "document_reactivated",
                doc_id=str(doc.id),
                corpus_id=str(doc.corpus_id),
                content_uri=blob_uri,
                file_hash=doc.file_hash,
            )
            return doc

    async def upload_and_store(
        self,
        corpus_id: UUID | None,
        app_name: str,
        content: bytes,
        filename: str,
        content_type: str | None = None,
        metadata: dict | None = None,
        created_by: str | None = None,
    ) -> tuple[KnowledgeDocument, bool]:
        """Upload document to GCS and store metadata.

        This method handles deduplication: if a document with the same
        content hash already exists in the corpus, it returns the existing
        document without uploading again.

        Args:
            corpus_id: Corpus UUID；``None`` 表示导入独立文档库（Library）
            app_name: Application name
            content: File content as bytes
            filename: Original filename
            content_type: MIME type of the file
            metadata: Optional metadata dictionary
            created_by: Optional user identifier of the uploader

        Returns:
            Tuple of (document record, is_new) where is_new is False
            if a duplicate was found

        Raises:
            StorageError: If blob upload fails
        """
        # Compute hash
        blob = self._get_blob()
        file_hash = blob.compute_hash(content)

        # Check for duplicate (any status, including soft-deleted)
        existing = await self.check_duplicate(corpus_id, file_hash, app_name=app_name)
        if existing:
            if existing.status == "active":
                logger.info(
                    "document_duplicate_found",
                    corpus_id=str(corpus_id),
                    file_hash=file_hash,
                    existing_doc_id=str(existing.id),
                )
                return existing, False

            # soft-deleted 文档重新摄入 → 复活
            logger.info(
                "document_reactivating_soft_deleted",
                corpus_id=str(corpus_id),
                file_hash=file_hash,
                existing_doc_id=str(existing.id),
                previous_status=existing.status,
            )
            reactivated = await self._reactivate_document(
                existing_doc=existing,
                app_name=app_name,
                content=content,
                filename=filename,
                content_type=content_type,
                metadata=metadata,
                created_by=created_by,
            )
            return reactivated, False

        # Build blob path
        blob_path = blob.build_path(app_name, self._corpus_segment(corpus_id), filename)

        # Upload to blob storage
        blob_uri = await blob.upload(
            content=content,
            path=blob_path,
            content_type=content_type,
        )

        # Store metadata in database
        async with AsyncSessionLocal() as db:
            doc = KnowledgeDocument(
                corpus_id=corpus_id,
                app_name=app_name,
                file_hash=file_hash,
                original_filename=filename,
                content_uri=blob_uri,
                content_type=content_type,
                file_size=len(content),
                status="active",
                markdown_extract_status="pending",
                metadata_=metadata or {},
                created_by=created_by,
            )
            db.add(doc)

            try:
                await db.commit()
                await db.refresh(doc)
            except IntegrityError:
                # Race condition: another request completed first, or soft-deleted doc exists
                await db.rollback()
                existing = await self.check_duplicate(corpus_id, file_hash, app_name=app_name)
                if existing:
                    if existing.status == "active":
                        logger.info(
                            "document_race_condition_resolved",
                            corpus_id=str(corpus_id),
                            file_hash=file_hash,
                        )
                        return existing, False
                    # 并发场景下发现 deleted 文档 → 复活
                    logger.info(
                        "document_race_condition_reactivating",
                        corpus_id=str(corpus_id),
                        file_hash=file_hash,
                    )
                    reactivated = await self._reactivate_document(
                        existing_doc=existing,
                        app_name=app_name,
                        content=content,
                        filename=filename,
                        content_type=content_type,
                        metadata=metadata,
                        created_by=created_by,
                    )
                    return reactivated, False
                raise

            logger.info(
                "document_stored",
                doc_id=str(doc.id),
                corpus_id=str(corpus_id),
                content_uri=blob_uri,
                file_hash=file_hash,
            )

            return doc, True

    async def list_documents(
        self,
        corpus_id: UUID | None = None,
        app_name: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[KnowledgeDocument], int]:
        """List documents with optional filtering.

        Args:
            corpus_id: Optional corpus UUID filter
            app_name: Optional app name filter
            limit: Maximum number of results
            offset: Offset for pagination

        Returns:
            Tuple of (list of documents, total count)
        """
        async with AsyncSessionLocal() as db:
            # Build base query conditions
            conditions = [KnowledgeDocument.status == "active"]
            if corpus_id:
                conditions.append(KnowledgeDocument.corpus_id == corpus_id)
            if app_name:
                conditions.append(KnowledgeDocument.app_name == app_name)

            # Count query
            count_stmt = select(func.count()).select_from(KnowledgeDocument).where(*conditions)
            count_result = await db.execute(count_stmt)
            total = count_result.scalar() or 0

            # Data query
            stmt = (
                select(KnowledgeDocument)
                .where(*conditions)
                .order_by(KnowledgeDocument.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            result = await db.execute(stmt)
            docs = list(result.scalars().all())

            return docs, total

    async def get_document(
        self,
        document_id: UUID,
        corpus_id: UUID | None = None,
        app_name: str | None = None,
    ) -> KnowledgeDocument | None:
        """Get a specific document by ID.

        Args:
            document_id: Document UUID
            corpus_id: Optional corpus UUID for validation
            app_name: Optional app name for validation

        Returns:
            Document record if found, None otherwise
        """
        async with AsyncSessionLocal() as db:
            conditions = [KnowledgeDocument.id == document_id]
            if corpus_id:
                conditions.append(KnowledgeDocument.corpus_id == corpus_id)
            if app_name:
                conditions.append(KnowledgeDocument.app_name == app_name)

            stmt = select(KnowledgeDocument).where(*conditions)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

    async def delete_document(
        self,
        document_id: UUID,
        corpus_id: UUID | None = None,
        app_name: str | None = None,
        soft_delete: bool = True,
    ) -> bool:
        """Delete document (soft or hard delete).

        Args:
            document_id: Document UUID to delete
            corpus_id: Optional corpus UUID for validation
            app_name: Optional app name for validation
            soft_delete: If True, mark as deleted; if False, also delete from blob storage

        Returns:
            True if deleted, False if not found
        """
        async with AsyncSessionLocal() as db:
            conditions = [KnowledgeDocument.id == document_id]
            if corpus_id:
                conditions.append(KnowledgeDocument.corpus_id == corpus_id)
            if app_name:
                conditions.append(KnowledgeDocument.app_name == app_name)
            stmt = select(KnowledgeDocument).where(*conditions)
            result = await db.execute(stmt)
            doc = result.scalar_one_or_none()

            if not doc:
                return False

            if soft_delete:
                doc.status = "deleted"
                await db.commit()
                logger.info(
                    "document_soft_deleted",
                    doc_id=str(document_id),
                    corpus_id=str(corpus_id),
                )
            else:
                # Hard delete: remove blobs first
                try:
                    blob = self._get_blob()
                    await blob.delete(doc.content_uri)
                    if doc.markdown_uri:
                        await blob.delete(doc.markdown_uri)
                    metadata = dict(doc.metadata_ or {})
                    extracted_assets = metadata.get("extracted_assets")
                    if isinstance(extracted_assets, list):
                        for asset in extracted_assets:
                            if not isinstance(asset, dict):
                                continue
                            uri = asset.get("uri")
                            if isinstance(uri, str) and is_blob_uri(uri):
                                try:
                                    await blob.delete(uri)
                                except StorageError as exc:
                                    logger.warning(
                                        "blob_delete_asset_failed_proceeding_with_db_delete",
                                        doc_id=str(document_id),
                                        asset_uri=uri,
                                        error=str(exc),
                                    )
                except StorageError as exc:
                    logger.warning(
                        "blob_delete_failed_proceeding_with_db_delete",
                        doc_id=str(document_id),
                        error=str(exc),
                    )

                await db.delete(doc)
                await db.commit()
                logger.info(
                    "document_hard_deleted",
                    doc_id=str(document_id),
                    corpus_id=str(corpus_id),
                )

            return True

    async def get_document_by_uri(
        self,
        *,
        content_uri: str,
        corpus_id: UUID | None = None,
        app_name: str | None = None,
        include_deleted: bool = False,
    ) -> KnowledgeDocument | None:
        """按 content_uri 查询文档记录。"""
        async with AsyncSessionLocal() as db:
            conditions = [KnowledgeDocument.content_uri == content_uri]
            if corpus_id:
                conditions.append(KnowledgeDocument.corpus_id == corpus_id)
            if app_name:
                conditions.append(KnowledgeDocument.app_name == app_name)
            if not include_deleted:
                conditions.append(KnowledgeDocument.status == "active")

            stmt = select(KnowledgeDocument).where(*conditions)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

    async def get_document_by_source_uri(
        self,
        *,
        source_uri: str,
        corpus_id: UUID | None = None,
        app_name: str | None = None,
    ) -> KnowledgeDocument | None:
        async with AsyncSessionLocal() as db:
            conditions = [
                or_(
                    KnowledgeDocument.content_uri == source_uri,
                    KnowledgeDocument.metadata_["origin_url"].astext == source_uri,
                )
            ]
            if corpus_id:
                conditions.append(KnowledgeDocument.corpus_id == corpus_id)
            if app_name:
                conditions.append(KnowledgeDocument.app_name == app_name)
            conditions.append(KnowledgeDocument.status == "active")
            stmt = select(KnowledgeDocument).where(*conditions)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

    async def update_markdown_extraction_status(
        self,
        *,
        document_id: UUID,
        status: str,
        error: str | None = None,
    ) -> bool:
        """更新 Markdown 提取状态。"""
        async with AsyncSessionLocal() as db:
            stmt = select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
            result = await db.execute(stmt)
            doc = result.scalar_one_or_none()
            if not doc:
                return False

            doc.markdown_extract_status = status
            doc.markdown_extract_error = error
            if status == "completed":
                doc.markdown_extracted_at = datetime.now(UTC)
            await db.commit()
            return True

    async def save_markdown_content(
        self,
        *,
        document_id: UUID,
        markdown_content: str,
        markdown_uri: str | None = None,
    ) -> bool:
        """保存 Markdown 正文与提取完成状态。"""
        async with AsyncSessionLocal() as db:
            stmt = select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
            result = await db.execute(stmt)
            doc = result.scalar_one_or_none()
            if not doc:
                return False

            # 剥离 NUL（\x00）——PostgreSQL text 列不接受，asyncpg 写入会抛
            # UntranslatableCharacterError；某些 PDF 解析产物会夹带 NUL 字节。
            doc.markdown_content = strip_nul_chars(markdown_content)
            doc.markdown_uri = markdown_uri
            doc.markdown_extract_status = "completed"
            doc.markdown_extract_error = None
            doc.markdown_extracted_at = datetime.now(UTC)
            await db.commit()
            return True

    async def update_document_metadata(
        self,
        *,
        document_id: UUID,
        metadata_patch: dict,
    ) -> bool:
        """合并更新文档 metadata。"""
        async with AsyncSessionLocal() as db:
            stmt = select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
            result = await db.execute(stmt)
            doc = result.scalar_one_or_none()
            if not doc:
                return False

            current = dict(doc.metadata_ or {})
            current.update(metadata_patch)
            doc.metadata_ = current
            await db.commit()
            return True

    async def update_document_display_name(
        self,
        *,
        document_id: UUID,
        display_name: str | None,
        corpus_id: UUID | None = None,
        app_name: str | None = None,
    ) -> KnowledgeDocument | None:
        """更新文档的 Wiki 显示名称。

        - 空白字符串 / 仅空白字符 归一化为 ``None``（与未填等价，由
          展示侧回退到 ``metadata_.title -> original_filename``）。
        - 长度上限 255；超过抛 ``ValueError``。
        - 与 :meth:`get_document` 一致的 ``corpus_id`` / ``app_name`` 权限校验。
        - 同事务回填该文档所有 chunk 的 ``metadata.display_name``（附加式），
          使检索命中片段、来源摘要、聊天引用等 chunk 派生展示即时跟随重命名，
          无需重新 ingest；``display_name`` 清空时同步删除该键。

        Args:
            document_id: 文档 UUID
            display_name: 新的显示名（``None`` / 空白 表示清除覆盖）
            corpus_id: 可选 corpus 校验
            app_name: 可选 app 校验

        Returns:
            更新后的 ``KnowledgeDocument``；若文档不存在或权限不匹配返回 ``None``
        """
        normalized: str | None
        if display_name is None:
            normalized = None
        else:
            stripped = display_name.strip()
            if not stripped:
                normalized = None
            elif len(stripped) > 255:
                raise ValueError("display_name 长度不能超过 255 字符")
            else:
                normalized = stripped

        async with AsyncSessionLocal() as db:
            conditions = [KnowledgeDocument.id == document_id]
            if corpus_id:
                conditions.append(KnowledgeDocument.corpus_id == corpus_id)
            if app_name:
                conditions.append(KnowledgeDocument.app_name == app_name)

            stmt = select(KnowledgeDocument).where(*conditions)
            result = await db.execute(stmt)
            doc = result.scalar_one_or_none()
            if not doc:
                return None

            doc.display_name = normalized

            # 同事务回填该文档所有 chunk 的 metadata.display_name（附加式，
            # 不破坏 original_filename），使检索/引用类展示即时跟随重命名。
            # chunk 仅经 metadata JSONB 中的 document_id 软关联文档（无 FK 列），
            # 物理列名为 metadata（ORM 属性为 metadata_）。
            if normalized is not None:
                backfill_stmt = text(
                    f"""
                    UPDATE {NEGENTROPY_SCHEMA}.knowledge
                    SET metadata = jsonb_set(
                        COALESCE(metadata, '{{}}'::jsonb),
                        '{{display_name}}',
                        :display_name_json::jsonb
                    )
                    WHERE metadata->>'document_id' = :document_id
                    """
                )
                backfill_result = await db.execute(
                    backfill_stmt,
                    {
                        "document_id": str(document_id),
                        "display_name_json": json.dumps(normalized),
                    },
                )
                chunks_updated = backfill_result.rowcount or 0
            else:
                clear_stmt = text(
                    f"""
                    UPDATE {NEGENTROPY_SCHEMA}.knowledge
                    SET metadata = metadata - 'display_name'
                    WHERE metadata->>'document_id' = :document_id
                    """
                )
                clear_result = await db.execute(
                    clear_stmt,
                    {"document_id": str(document_id)},
                )
                chunks_updated = clear_result.rowcount or 0

            await db.commit()
            await db.refresh(doc)
            logger.info(
                "document_display_name_updated",
                doc_id=str(document_id),
                cleared=normalized is None,
                chunks_updated=chunks_updated,
            )
            return doc

    async def delete_blob(self, *, content_uri: str) -> bool:
        """删除任意 blob URI；失败时仅记录日志。"""
        try:
            await self._get_blob().delete(content_uri)
            return True
        except StorageError as exc:
            logger.warning("blob_uri_delete_failed", content_uri=content_uri, error=str(exc))
            return False

    async def upload_markdown_derivative(
        self,
        *,
        document_id: UUID,
        markdown_content: str,
    ) -> str | None:
        """将 Markdown 内容上传到 blob 存储，失败时仅记录日志并返回 None。"""
        doc = await self.get_document(document_id=document_id)
        if not doc:
            return None

        try:
            blob = self._get_blob()
            blob_path = self._build_markdown_path(
                app_name=doc.app_name,
                corpus_id=doc.corpus_id,
                document_id=doc.id,
                filename=doc.original_filename,
            )
            return await blob.upload(
                content=markdown_content.encode("utf-8"),
                path=blob_path,
                content_type="text/markdown; charset=utf-8",
            )
        except Exception as exc:  # noqa: BLE001 - 衍生存储失败不应影响主流程
            logger.warning(
                "markdown_derivative_upload_failed",
                document_id=str(document_id),
                error=str(exc),
            )
            return None

    async def upload_extraction_asset(
        self,
        *,
        document_id: UUID,
        filename: str,
        content: bytes,
        content_type: str,
    ) -> str | None:
        """上传 Negentropy Perceives 生成的衍生资源。"""
        doc = await self.get_document(document_id=document_id)
        if not doc:
            return None

        try:
            blob = self._get_blob()
            blob_path = self._build_asset_path(
                app_name=doc.app_name,
                corpus_id=doc.corpus_id,
                document_id=doc.id,
                filename=filename,
            )
            return await blob.upload(
                content=content,
                path=blob_path,
                content_type=content_type,
            )
        except Exception as exc:  # noqa: BLE001 - 衍生存储失败不应影响主流程
            logger.warning(
                "extraction_asset_upload_failed",
                document_id=str(document_id),
                filename=filename,
                error=str(exc),
            )
            return None

    async def download_extraction_asset(
        self,
        *,
        document_id: UUID,
        filename: str,
    ) -> bytes | None:
        """从 blob 存储下载 Negentropy Perceives 生成的衍生资源。"""
        doc = await self.get_document(document_id=document_id)
        if not doc:
            return None

        blob = self._get_blob()
        blob_path = self._build_asset_path(
            app_name=doc.app_name,
            corpus_id=doc.corpus_id,
            document_id=doc.id,
            filename=filename,
        )
        blob_uri = build_uri(blob_path)

        try:
            return await blob.download(blob_uri)
        except Exception:  # noqa: BLE001
            logger.warning(
                "extraction_asset_download_failed",
                document_id=str(document_id),
                filename=filename,
                content_uri=blob_uri,
            )
            return None

    async def get_document_content(self, document_id: UUID) -> bytes | None:
        """Download document content from blob storage.

        Args:
            document_id: Document UUID

        Returns:
            File content as bytes, or None if document not found
        """
        doc = await self.get_document(document_id)
        if not doc:
            return None

        return await self._get_blob().download(doc.content_uri)

    async def get_document_markdown(self, document_id: UUID) -> str | None:
        """读取文档 Markdown 正文（优先 PostgreSQL，缺失时回退 blob 存储）。"""
        doc = await self.get_document(document_id=document_id)
        if not doc:
            return None

        if doc.markdown_content and doc.markdown_content.strip():
            return doc.markdown_content

        if not doc.markdown_uri:
            return None

        try:
            content = (await self._get_blob().download(doc.markdown_uri)).decode("utf-8")
            if not content.strip():
                logger.warning(
                    "markdown_content_empty",
                    document_id=str(document_id),
                    markdown_uri=doc.markdown_uri,
                )
                return None
            # 最佳努力回填 PostgreSQL，避免后续重复读 blob。
            await self.save_markdown_content(
                document_id=document_id,
                markdown_content=content,
                markdown_uri=doc.markdown_uri,
            )
            return content
        except Exception as exc:  # noqa: BLE001 - 读取失败由调用方决定处理
            logger.warning(
                "markdown_content_load_failed",
                document_id=str(document_id),
                error=str(exc),
            )
            return None

    async def get_document_content_by_uri(self, content_uri: str) -> bytes | None:
        """Download document content by blob URI directly.

        用于 Rebuild 操作，直接通过 blob URI 下载文件内容。

        Args:
            content_uri: blob URI（pgblob://{key}）

        Returns:
            File content as bytes

        Raises:
            StorageError: If blob download fails
        """
        return await self._get_blob().download(content_uri)
