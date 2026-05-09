"""Document Storage Service for managing uploaded documents.

This module provides high-level operations for document storage,
including deduplication, listing, and deletion.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.exc import IntegrityError

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA
from negentropy.models.perception import Knowledge, KnowledgeDocument

from .gcs_client import GCSStorageClient, StorageError

logger = get_logger("negentropy.storage.service")


def resolve_document_source_uri(doc: KnowledgeDocument | None) -> str | None:
    """统一解析 KnowledgeDocument 对应的 ``source_uri``。

    Knowledge 行通过 ``source_uri`` 软关联到 KnowledgeDocument：
      - URL 类文档（``metadata.source_type == 'url'``）：取 ``metadata.origin_url``；
      - 普通上传文档：取 ``gcs_uri``。

    与 ``api.py`` 同名 helper 的语义保持一致；本函数下沉到 storage 层供 storage
    服务内部直接复用，避免跨层耦合（详见 ISSUE-078 Phase 2）。
    """
    if doc is None:
        return None
    metadata = doc.metadata_ or {}
    if metadata.get("source_type") == "url":
        origin_url = metadata.get("origin_url")
        if isinstance(origin_url, str) and origin_url:
            return origin_url
    if doc.gcs_uri:
        return doc.gcs_uri
    return None


class DocumentStorageService:
    """Service for managing document storage and deduplication.

    This service coordinates between GCS storage and database metadata,
    handling file deduplication based on content hash.
    """

    def __init__(self, gcs_client: GCSStorageClient | None = None):
        self._gcs = gcs_client

    def _get_gcs_client(self) -> GCSStorageClient:
        """Get GCS client (lazy initialization)."""
        if self._gcs is None:
            self._gcs = GCSStorageClient.get_instance()
        return self._gcs

    @staticmethod
    def _build_markdown_gcs_path(
        *,
        app_name: str,
        corpus_id: UUID,
        document_id: UUID,
        filename: str,
    ) -> str:
        """构建 Markdown 衍生文件路径。"""
        stem = Path(filename).stem or "document"
        safe_stem = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in stem)[:120] or "document"
        return f"knowledge/{app_name}/{corpus_id}/derived/{document_id}/{safe_stem}.md"

    @staticmethod
    def _build_asset_gcs_path(
        *,
        app_name: str,
        corpus_id: UUID,
        document_id: UUID,
        filename: str,
    ) -> str:
        safe_name = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in filename)[:180] or "asset"
        return f"knowledge/{app_name}/{corpus_id}/derived/{document_id}/assets/{safe_name}"

    async def check_duplicate(
        self,
        corpus_id: UUID,
        file_hash: str,
    ) -> KnowledgeDocument | None:
        """Check if document with same hash exists in corpus (any status).

        查询范围包含所有状态（active / deleted 等），以匹配数据库唯一约束
        ``uq_knowledge_documents_corpus_hash(corpus_id, file_hash)`` 的实际覆盖范围。

        Args:
            corpus_id: Corpus UUID
            file_hash: SHA-256 hash of file content

        Returns:
            Existing document record if found (including soft-deleted), None otherwise
        """
        async with AsyncSessionLocal() as db:
            stmt = select(KnowledgeDocument).where(
                KnowledgeDocument.corpus_id == corpus_id,
                KnowledgeDocument.file_hash == file_hash,
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # Knowledge chunks 联动（ISSUE-078 Phase 2）
    #
    # KnowledgeDocument 与 Knowledge 之间没有数据库级 FK（仅靠 source_uri 文本
    # 软关联，详见 ISSUE-078 RCA），因此 doc 删除/复活路径必须主动维护 chunks
    # 生命周期，避免：
    #   - 硬删后 chunks 成为孤儿（FK 意义孤儿，污染 corpus 计数与检索）
    #   - 软删后 chunks 仍被 RAG 检索命中（污染语义 / 关键词搜索结果）
    #   - reactivation 旧 chunks 与新 ingest 叠加（双套互不一致 chunks）
    #
    # 三类操作均在与 doc 同一 session 内执行，确保事务原子性。
    # ------------------------------------------------------------------

    @staticmethod
    async def _hard_delete_chunks_in_session(
        db,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: str | None,
    ) -> int:
        """硬删除指定 doc 对应的全部 chunks（父+子，hierarchical 共享 source_uri）。

        ``source_uri IS NULL`` 时不做删除（KG 类直连知识无 doc 来源，永远不应被
        doc 删除路径误删）；返回删除行数供日志审计。
        """
        if source_uri is None:
            return 0
        stmt = delete(Knowledge).where(
            Knowledge.corpus_id == corpus_id,
            Knowledge.app_name == app_name,
            Knowledge.source_uri == source_uri,
        )
        result = await db.execute(stmt)
        return result.rowcount or 0

    @staticmethod
    async def _archive_chunks_in_session(
        db,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: str | None,
    ) -> int:
        """软删除联动：批量给指定 doc 的全部 chunks 打 ``archived=true`` 与 ``is_enabled=false``。

        语义与 ``KnowledgeService.archive_source`` 对齐（ISSUE-078 Phase 2 复用范式）：
          - ``metadata.archived = true`` 让既有 ``_active_filter_expr`` 过滤生效，
            chunks 不再参与 corpus 计数 / 检索；
          - ``is_enabled = false`` 是冗余防御层，所有走 ``_enabled_filter_expr``
            的检索路径同样会跳过它们。

        软删可恢复：reactivation 路径会直接 hard delete 旧 chunks 让重新 ingest
        写一份干净的，因此不必在此处处理 unset 反向操作。

        使用 ``jsonb_set`` 原生函数（与 ``archive_knowledge_by_source`` 同范式），
        避免 SQLAlchemy 表达式层 cast 的类型不匹配。
        """
        if source_uri is None:
            return 0
        stmt = text(
            f"""
            UPDATE {NEGENTROPY_SCHEMA}.knowledge
            SET metadata = jsonb_set(
                    COALESCE(metadata, '{{}}'::jsonb),
                    '{{archived}}',
                    'true'::jsonb
                ),
                is_enabled = FALSE
            WHERE corpus_id = :corpus_id
              AND app_name = :app_name
              AND source_uri = :source_uri
            """
        )
        result = await db.execute(
            stmt,
            {
                "corpus_id": corpus_id,
                "app_name": app_name,
                "source_uri": source_uri,
            },
        )
        return result.rowcount or 0

    @staticmethod
    def _best_effort_cleanup_gcs(
        gcs_client: GCSStorageClient,
        *,
        old_gcs_uri: str | None,
        old_markdown_gcs_uri: str | None,
        old_metadata: dict | None,
    ) -> None:
        """Best-effort 清理旧 GCS 资源，失败仅记录日志，不阻断主流程。"""
        for uri in (old_gcs_uri, old_markdown_gcs_uri):
            if uri:
                try:
                    gcs_client.delete(uri)
                except StorageError:
                    logger.warning("reactivate_old_gcs_cleanup_failed", uri=uri)

        old_assets = (old_metadata or {}).get("extracted_assets")
        if isinstance(old_assets, list):
            for asset in old_assets:
                if isinstance(asset, dict):
                    uri = asset.get("uri")
                    if isinstance(uri, str) and uri.startswith("gs://"):
                        try:
                            gcs_client.delete(uri)
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
        """复活 soft-deleted 文档：重新上传 GCS 并更新记录状态。

        soft-delete 后 GCS 文件可能已被清理，因此需要重新上传。
        同时重置 Markdown 提取状态以触发重新提取。
        """
        gcs_client = self._get_gcs_client()
        gcs_path = gcs_client.build_gcs_path(app_name, str(existing_doc.corpus_id), filename)

        gcs_uri = gcs_client.upload(
            content=content,
            gcs_path=gcs_path,
            content_type=content_type,
        )

        async with AsyncSessionLocal() as db:
            stmt = select(KnowledgeDocument).where(KnowledgeDocument.id == existing_doc.id)
            result = await db.execute(stmt)
            doc = result.scalar_one_or_none()
            if not doc:
                raise StorageError(f"Document {existing_doc.id} disappeared during reactivation")

            # Best-effort 清理旧 GCS 资源，防止孤立 blob 积累
            self._best_effort_cleanup_gcs(
                gcs_client,
                old_gcs_uri=doc.gcs_uri if doc.gcs_uri != gcs_uri else None,
                old_markdown_gcs_uri=doc.markdown_gcs_uri,
                old_metadata=doc.metadata_,
            )

            # 复活联动（ISSUE-078 Phase 2）：旧 chunks（软删时被 archive 的）必须
            # 在重置 doc 状态前 hard delete，让随后的 markdown 重新提取 + 重新
            # ingest 写入一份干净的；否则旧 archived chunks 与新 chunks 叠加
            # （source_uri 相同），既污染检索（部分仍 archived 但 query 解 archive），
            # 又让 corpus 计数与文档详情口径再次出错。
            old_source_uri = resolve_document_source_uri(doc)
            purged_count = await self._hard_delete_chunks_in_session(
                db,
                corpus_id=doc.corpus_id,
                app_name=doc.app_name,
                source_uri=old_source_uri,
            )

            doc.status = "active"
            doc.gcs_uri = gcs_uri
            doc.original_filename = filename
            doc.content_type = content_type
            doc.file_size = len(content)
            doc.metadata_ = metadata or {}
            doc.created_by = created_by
            doc.markdown_content = None
            doc.markdown_gcs_uri = None
            doc.markdown_extract_status = "pending"
            doc.markdown_extract_error = None
            doc.markdown_extracted_at = None

            await db.commit()
            await db.refresh(doc)

            logger.info(
                "document_reactivated",
                doc_id=str(doc.id),
                corpus_id=str(doc.corpus_id),
                gcs_uri=gcs_uri,
                file_hash=doc.file_hash,
                reactivate_purge_chunks=purged_count,
                old_source_uri=old_source_uri,
            )
            return doc

    async def upload_and_store(
        self,
        corpus_id: UUID,
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
            corpus_id: Corpus UUID
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
            StorageError: If GCS upload fails
        """
        # Compute hash
        file_hash = GCSStorageClient.compute_hash(content)

        # Check for duplicate (any status, including soft-deleted)
        existing = await self.check_duplicate(corpus_id, file_hash)
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

        # Build GCS path
        gcs_client = self._get_gcs_client()
        gcs_path = gcs_client.build_gcs_path(app_name, str(corpus_id), filename)

        # Upload to GCS
        gcs_uri = gcs_client.upload(
            content=content,
            gcs_path=gcs_path,
            content_type=content_type,
        )

        # Store metadata in database
        async with AsyncSessionLocal() as db:
            doc = KnowledgeDocument(
                corpus_id=corpus_id,
                app_name=app_name,
                file_hash=file_hash,
                original_filename=filename,
                gcs_uri=gcs_uri,
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
                existing = await self.check_duplicate(corpus_id, file_hash)
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
                gcs_uri=gcs_uri,
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

        Phase 2（ISSUE-078）联动 Knowledge chunks 生命周期：
          - 软删：批量 archive chunks（``metadata.archived=true`` + ``is_enabled=false``），
            防止 RAG 检索仍命中已删 doc；语义可逆，reactivation 时由
            ``_reactivate_document`` 直接 hard delete 旧 chunks 让重新 ingest 写一份干净的。
          - 硬删：在同一事务内删除 chunks 后再删除 doc 行，杜绝 FK 意义孤儿。

        Args:
            document_id: Document UUID to delete
            corpus_id: Optional corpus UUID for validation
            app_name: Optional app name for validation
            soft_delete: If True, mark as deleted; if False, also delete from GCS

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

            doc_corpus_id = doc.corpus_id
            doc_app_name = doc.app_name
            source_uri = resolve_document_source_uri(doc)

            if soft_delete:
                # 软删联动：先 archive chunks 再标记 doc，单事务原子提交。
                archived_count = await self._archive_chunks_in_session(
                    db,
                    corpus_id=doc_corpus_id,
                    app_name=doc_app_name,
                    source_uri=source_uri,
                )
                doc.status = "deleted"
                await db.commit()
                logger.info(
                    "document_soft_deleted",
                    doc_id=str(document_id),
                    corpus_id=str(corpus_id),
                    chunks_archived=archived_count,
                    source_uri=source_uri,
                )
            else:
                # Hard delete: remove from GCS first
                try:
                    gcs_client = self._get_gcs_client()
                    gcs_client.delete(doc.gcs_uri)
                    if doc.markdown_gcs_uri:
                        gcs_client.delete(doc.markdown_gcs_uri)
                    metadata = dict(doc.metadata_ or {})
                    extracted_assets = metadata.get("extracted_assets")
                    if isinstance(extracted_assets, list):
                        for asset in extracted_assets:
                            if not isinstance(asset, dict):
                                continue
                            uri = asset.get("uri")
                            if isinstance(uri, str) and uri.startswith("gs://"):
                                try:
                                    gcs_client.delete(uri)
                                except StorageError as exc:
                                    logger.warning(
                                        "gcs_delete_asset_failed_proceeding_with_db_delete",
                                        doc_id=str(document_id),
                                        asset_uri=uri,
                                        error=str(exc),
                                    )
                except StorageError as exc:
                    logger.warning(
                        "gcs_delete_failed_proceeding_with_db_delete",
                        doc_id=str(document_id),
                        error=str(exc),
                    )

                # 硬删联动：先删 chunks 再删 doc，单事务原子提交，杜绝 FK 意义孤儿。
                chunks_deleted = await self._hard_delete_chunks_in_session(
                    db,
                    corpus_id=doc_corpus_id,
                    app_name=doc_app_name,
                    source_uri=source_uri,
                )
                await db.delete(doc)
                await db.commit()
                logger.info(
                    "document_hard_deleted",
                    doc_id=str(document_id),
                    corpus_id=str(corpus_id),
                    chunks_deleted=chunks_deleted,
                    source_uri=source_uri,
                )

            return True

    async def get_document_by_gcs_uri(
        self,
        *,
        gcs_uri: str,
        corpus_id: UUID | None = None,
        app_name: str | None = None,
        include_deleted: bool = False,
    ) -> KnowledgeDocument | None:
        """按 gcs_uri 查询文档记录。"""
        async with AsyncSessionLocal() as db:
            conditions = [KnowledgeDocument.gcs_uri == gcs_uri]
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
                    KnowledgeDocument.gcs_uri == source_uri,
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
        markdown_gcs_uri: str | None = None,
    ) -> bool:
        """保存 Markdown 正文与提取完成状态。"""
        async with AsyncSessionLocal() as db:
            stmt = select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
            result = await db.execute(stmt)
            doc = result.scalar_one_or_none()
            if not doc:
                return False

            doc.markdown_content = markdown_content
            doc.markdown_gcs_uri = markdown_gcs_uri
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

    async def delete_gcs_uri(self, *, gcs_uri: str) -> bool:
        """删除任意 GCS URI；失败时仅记录日志。"""
        try:
            self._get_gcs_client().delete(gcs_uri)
            return True
        except StorageError as exc:
            logger.warning("gcs_uri_delete_failed", gcs_uri=gcs_uri, error=str(exc))
            return False

    async def upload_markdown_derivative(
        self,
        *,
        document_id: UUID,
        markdown_content: str,
    ) -> str | None:
        """将 Markdown 内容上传到 GCS，失败时仅记录日志并返回 None。"""
        doc = await self.get_document(document_id=document_id)
        if not doc:
            return None

        try:
            gcs_client = self._get_gcs_client()
            gcs_path = self._build_markdown_gcs_path(
                app_name=doc.app_name,
                corpus_id=doc.corpus_id,
                document_id=doc.id,
                filename=doc.original_filename,
            )
            return gcs_client.upload(
                content=markdown_content.encode("utf-8"),
                gcs_path=gcs_path,
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
            gcs_client = self._get_gcs_client()
            gcs_path = self._build_asset_gcs_path(
                app_name=doc.app_name,
                corpus_id=doc.corpus_id,
                document_id=doc.id,
                filename=filename,
            )
            return gcs_client.upload(
                content=content,
                gcs_path=gcs_path,
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
        """从 GCS 下载 Negentropy Perceives 生成的衍生资源。"""
        doc = await self.get_document(document_id=document_id)
        if not doc:
            return None

        gcs_client = self._get_gcs_client()
        gcs_path = self._build_asset_gcs_path(
            app_name=doc.app_name,
            corpus_id=doc.corpus_id,
            document_id=doc.id,
            filename=filename,
        )
        gcs_uri = f"gs://{gcs_client._bucket_name}/{gcs_path}"

        try:
            return gcs_client.download(gcs_uri)
        except Exception:  # noqa: BLE001
            logger.warning(
                "extraction_asset_download_failed",
                document_id=str(document_id),
                filename=filename,
                gcs_uri=gcs_uri,
            )
            return None

    async def get_document_content(self, document_id: UUID) -> bytes | None:
        """Download document content from GCS.

        Args:
            document_id: Document UUID

        Returns:
            File content as bytes, or None if document not found
        """
        doc = await self.get_document(document_id)
        if not doc:
            return None

        gcs_client = self._get_gcs_client()
        return gcs_client.download(doc.gcs_uri)

    async def get_document_markdown(self, document_id: UUID) -> str | None:
        """读取文档 Markdown 正文（优先 PostgreSQL，缺失时回退 GCS）。"""
        doc = await self.get_document(document_id=document_id)
        if not doc:
            return None

        if doc.markdown_content and doc.markdown_content.strip():
            return doc.markdown_content

        if not doc.markdown_gcs_uri:
            return None

        try:
            gcs_client = self._get_gcs_client()
            content = gcs_client.download(doc.markdown_gcs_uri).decode("utf-8")
            if not content.strip():
                logger.warning(
                    "markdown_content_empty",
                    document_id=str(document_id),
                    markdown_gcs_uri=doc.markdown_gcs_uri,
                )
                return None
            # 最佳努力回填 PostgreSQL，避免后续重复读 GCS。
            await self.save_markdown_content(
                document_id=document_id,
                markdown_content=content,
                markdown_gcs_uri=doc.markdown_gcs_uri,
            )
            return content
        except Exception as exc:  # noqa: BLE001 - 读取失败由调用方决定处理
            logger.warning(
                "markdown_content_load_failed",
                document_id=str(document_id),
                error=str(exc),
            )
            return None

    async def get_document_content_by_uri(self, gcs_uri: str) -> bytes | None:
        """Download document content by GCS URI directly.

        用于 Rebuild 操作，直接通过 GCS URI 下载文件内容。

        Args:
            gcs_uri: Full GCS URI (gs://bucket/path)

        Returns:
            File content as bytes

        Raises:
            StorageError: If GCS download fails
        """
        gcs_client = self._get_gcs_client()
        return gcs_client.download(gcs_uri)
