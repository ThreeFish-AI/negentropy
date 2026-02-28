"""Document Storage Service for managing uploaded documents.

This module provides high-level operations for document storage,
including deduplication, listing, and deletion.
"""

from __future__ import annotations

from typing import Optional, Tuple
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.perception import KnowledgeDocument

from .gcs_client import GCSStorageClient, StorageError

logger = get_logger("negentropy.storage.service")


class DocumentStorageService:
    """Service for managing document storage and deduplication.

    This service coordinates between GCS storage and database metadata,
    handling file deduplication based on content hash.
    """

    def __init__(self, gcs_client: Optional[GCSStorageClient] = None):
        self._gcs = gcs_client

    def _get_gcs_client(self) -> GCSStorageClient:
        """Get GCS client (lazy initialization)."""
        if self._gcs is None:
            self._gcs = GCSStorageClient.get_instance()
        return self._gcs

    async def check_duplicate(
        self,
        corpus_id: UUID,
        file_hash: str,
    ) -> Optional[KnowledgeDocument]:
        """Check if document with same hash exists in corpus.

        Args:
            corpus_id: Corpus UUID
            file_hash: SHA-256 hash of file content

        Returns:
            Existing document record if found, None otherwise
        """
        async with AsyncSessionLocal() as db:
            stmt = select(KnowledgeDocument).where(
                KnowledgeDocument.corpus_id == corpus_id,
                KnowledgeDocument.file_hash == file_hash,
                KnowledgeDocument.status == "active",
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

    async def upload_and_store(
        self,
        corpus_id: UUID,
        app_name: str,
        content: bytes,
        filename: str,
        content_type: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> Tuple[KnowledgeDocument, bool]:
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

        Returns:
            Tuple of (document record, is_new) where is_new is False
            if a duplicate was found

        Raises:
            StorageError: If GCS upload fails
        """
        # Compute hash
        file_hash = GCSStorageClient.compute_hash(content)

        # Check for duplicate
        existing = await self.check_duplicate(corpus_id, file_hash)
        if existing:
            logger.info(
                "document_duplicate_found",
                corpus_id=str(corpus_id),
                file_hash=file_hash,
                existing_doc_id=str(existing.id),
            )
            return existing, False

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
                metadata_=metadata or {},
            )
            db.add(doc)

            try:
                await db.commit()
                await db.refresh(doc)
            except IntegrityError:
                # Race condition: another upload completed first
                await db.rollback()
                existing = await self.check_duplicate(corpus_id, file_hash)
                if existing:
                    logger.info(
                        "document_race_condition_resolved",
                        corpus_id=str(corpus_id),
                        file_hash=file_hash,
                    )
                    return existing, False
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
        corpus_id: Optional[UUID] = None,
        app_name: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[list[KnowledgeDocument], int]:
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
        corpus_id: Optional[UUID] = None,
        app_name: Optional[str] = None,
    ) -> Optional[KnowledgeDocument]:
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
        corpus_id: Optional[UUID] = None,
        app_name: Optional[str] = None,
        soft_delete: bool = True,
    ) -> bool:
        """Delete document (soft or hard delete).

        Args:
            document_id: Document UUID to delete
            corpus_id: Optional corpus UUID for validation
            app_name: Optional app name for validation
            soft_delete: If True, mark as deleted; if False, also delete from GCS

        Returns:
            True if deleted, False if not found
        """
        async with AsyncSessionLocal() as db:
            doc = await self.get_document(document_id, corpus_id, app_name)

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
                # Hard delete: remove from GCS first
                try:
                    gcs_client = self._get_gcs_client()
                    gcs_client.delete(doc.gcs_uri)
                except StorageError as exc:
                    logger.warning(
                        "gcs_delete_failed_proceeding_with_db_delete",
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

    async def get_document_content(self, document_id: UUID) -> Optional[bytes]:
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

    async def get_document_content_by_uri(self, gcs_uri: str) -> Optional[bytes]:
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
