"""
文档来源追踪 — 服务层 (Strategy Pattern)

根据不同来源类型（URL/PDF/文件/文本）采用不同的追踪策略，
从 ExtractedDocumentResult 中提取特定元数据并持久化到 DocSource 表。

设计模式:
  - SourceTrackingService: 策略调度器
  - UrlSourceTracker: Web Page 来源追踪
  - PdfSourceTracker: PDF 文件来源追踪
  - FileSourceTracker: 通用文件来源追踪
  - TextInputTracker: 文本输入来源追踪
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.knowledge.extraction import ExtractedDocumentResult
from negentropy.knowledge.source_dao import SourceDao
from negentropy.models.perception import DocSource
from negentropy.logging import get_logger

logger = get_logger(__name__.rsplit(".", 1)[0])


# =============================================================================
# 数据传递对象
# =============================================================================


@dataclass(frozen=True)
class TrackingContext:
    """来源追踪上下文（传入策略的额外信息）"""

    tracker_run_id: Optional[str] = None
    corpus_id: Optional[UUID] = None
    app_name: Optional[str] = None
    # MCP 工具调用信息（由调用方注入）
    mcp_tool_name: Optional[str] = None
    mcp_server_id: Optional[UUID] = None


# =============================================================================
# 策略接口与实现
# =============================================================================


class SourceTrackingStrategy(ABC):
    """来源追踪策略抽象基类"""

    # 常量
    TITLE_MAX_LENGTH = 500
    SUMMARY_MAX_LENGTH = 300
    ELLIPSIS = "..."

    @abstractmethod
    async def extract_metadata(
        self,
        *,
        document_id: UUID,
        result: ExtractedDocumentResult,
        context: TrackingContext,
    ) -> dict[str, Any]:
        """从提取结果中提取来源特定的元数据

        返回字典，键对应 DocSource 的字段名（不含 id/document_id/created_at/updated_at/raw_metadata）
        """
        ...

    @property
    @abstractmethod
    def source_type(self) -> str:
        """此策略对应的 source_type 值"""
        ...

    # ------------------------------------------------------------------
    # 公共工具方法（供子类复用，消除元数据构建重复代码）
    # ------------------------------------------------------------------

    def _build_common_metadata(
        self,
        context: TrackingContext,
        *,
        extra_raw: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """构建所有策略共有的元数据字段

        Args:
            context: 追踪上下文
            extra_raw: 额外注入 raw_metadata 的键值对

        Returns:
            包含 extracted_at / extractor_tool_name / extractor_server_id / raw_metadata 的字典
        """
        tracking_ctx: dict[str, Any] = {
            "tracker_run_id": context.tracker_run_id,
            "corpus_id": str(context.corpus_id) if context.corpus_id else None,
            "app_name": context.app_name,
        }
        if extra_raw:
            tracking_ctx.update(extra_raw)

        return {
            "extracted_at": datetime.now(timezone.utc),
            "extractor_tool_name": context.mcp_tool_name,
            "extractor_server_id": str(context.mcp_server_id) if context.mcp_server_id else None,
            "raw_metadata": {"_tracking_context": tracking_ctx},
        }

    @staticmethod
    def _build_summary(result: ExtractedDocumentResult) -> str | None:
        """构建提取摘要（截断至 SUMMARY_MAX_LENGTH）"""
        plain_text = result.plain_text or ""
        if not plain_text:
            return None
        if len(plain_text) > SourceTrackingStrategy.SUMMARY_MAX_LENGTH:
            return plain_text[: SourceTrackingStrategy.SUMMARY_MAX_LENGTH - len(SourceTrackingStrategy.ELLIPSIS)] + SourceTrackingStrategy.ELLIPSIS
        return plain_text

    @staticmethod
    def _truncate_title(title: str | None, max_len: int | None = None) -> str | None:
        """安全截断标题至指定长度"""
        if not title:
            return None
        limit = max_len or SourceTrackingStrategy.TITLE_MAX_LENGTH
        return title[:limit] if len(title) > limit else title


class UrlSourceTracker(SourceTrackingStrategy):
    """Web Page 来源追踪策略

    从 URL 提取结果中获取：原始 URL、最终 URL、页面标题、重定向链等。
    """

    @property
    def source_type(self) -> str:
        return "url"

    async def extract_metadata(
        self,
        *,
        document_id: UUID,
        result: ExtractedDocumentResult,
        context: TrackingContext,
    ) -> dict[str, Any]:
        metadata = result.metadata or {}
        trace = result.trace or {}

        # 从 metadata 获取 URL 信息
        source_url = metadata.get("source_url") or metadata.get("url")
        original_url = metadata.get("original_url") or source_url

        # 标题优先级：metadata.title > trace.title > 从 markdown 第一行提取
        title = (
            metadata.get("title")
            or trace.get("title")
            or self._extract_title_from_markdown(result.markdown_content)
        )

        return {
            "source_type": self.source_type,
            "source_url": source_url,
            "original_url": original_url,
            "title": self._truncate_title(title),
            "author": metadata.get("author"),
            "extracted_summary": self._build_summary(result),
            "extraction_duration_ms": trace.get("duration_ms"),
            **self._build_common_metadata(context, extra_raw=metadata),
        }

    @staticmethod
    def _extract_title_from_markdown(markdown: str | None) -> str | None:
        """从 Markdown 内容第一行提取标题"""
        if not markdown:
            return None
        for line in markdown.split("\n"):
            stripped = line.strip()
            if stripped.startswith("#"):
                return stripped.lstrip("# ").strip()
            if stripped:
                return stripped[:200]
        return None


class PdfSourceTracker(SourceTrackingStrategy):
    """PDF 文件来源追踪策略

    从 PDF 提取结果中获取：文件元数据、页数、作者等。
    """

    @property
    def source_type(self) -> str:
        return "file_pdf"

    async def extract_metadata(
        self,
        *,
        document_id: UUID,
        result: ExtractedDocumentResult,
        context: TrackingContext,
    ) -> dict[str, Any]:
        metadata = result.metadata or {}
        trace = result.trace or {}

        title = (
            metadata.get("title")
            or trace.get("title")
            or metadata.get("filename", "").replace(".pdf", "").replace("_", " ").strip()
        )

        return {
            "source_type": self.source_type,
            "source_url": metadata.get("source_url"),
            "original_url": None,
            "title": self._truncate_title(title),
            "author": metadata.get("author"),
            "extracted_summary": self._build_summary(result),
            "extraction_duration_ms": trace.get("duration_ms"),
            **self._build_common_metadata(
                context,
                extra_raw={
                    **metadata,
                    "page_count": metadata.get("page_count"),
                    "pdf_info": metadata.get("pdf_info"),
                },
            ),
        }


class FileSourceTracker(SourceTrackingStrategy):
    """通用文件来源追踪策略"""

    @property
    def source_type(self) -> str:
        return "file_generic"

    async def extract_metadata(
        self,
        *,
        document_id: UUID,
        result: ExtractedDocumentResult,
        context: TrackingContext,
    ) -> dict[str, Any]:
        metadata = result.metadata or {}
        trace = result.trace or {}

        filename = metadata.get("filename", "")
        # rsplit 安全处理：无扩展名时返回原文件名；以点开头的文件（如 .gitignore）返回空字符串
        title = filename.rsplit(".", 1)[0] if filename and not filename.startswith(".") else (filename or None)

        return {
            "source_type": self.source_type,
            "source_url": metadata.get("source_url"),
            "original_url": None,
            "title": self._truncate_title(title),
            "author": None,
            "extracted_summary": self._build_summary(result),
            "extraction_duration_ms": trace.get("duration_ms"),
            **self._build_common_metadata(context, extra_raw=metadata),
        }


class TextInputTracker(SourceTrackingStrategy):
    """文本输入来源追踪策略"""

    @property
    def source_type(self) -> str:
        return "text_input"

    async def extract_metadata(
        self,
        *,
        document_id: UUID,
        result: ExtractedDocumentResult,
        context: TrackingContext,
    ) -> dict[str, Any]:
        metadata = result.metadata or {}

        # 文本输入无 extractor 信息，覆盖公共构建器的默认值
        base = self._build_common_metadata(context, extra_raw=metadata)
        base["extractor_tool_name"] = None
        base["extractor_server_id"] = None

        return {
            "source_type": self.source_type,
            "source_url": None,
            "original_url": None,
            "title": self._truncate_title(metadata.get("title", "文本输入")),
            "author": None,
            "extracted_summary": self._build_summary(result),
            "extraction_duration_ms": None,
            **base,
        }


# =============================================================================
# 策略调度器
# =============================================================================


class SourceTrackingService:
    """文档来源追踪服务

    职责:
    1. 根据 source_kind 分发到对应的追踪策略
    2. 协调 DAO 层完成记录的创建和关联
    3. 更新 KnowledgeDocument.source_id 外键
    """

    def __init__(self) -> None:
        self._strategies: dict[str, SourceTrackingStrategy] = {
            "url": UrlSourceTracker(),
            "file_pdf": PdfSourceTracker(),
            "file_generic": FileSourceTracker(),
            "text_input": TextInputTracker(),
        }

    async def track(
        self,
        db: AsyncSession,
        *,
        document_id: UUID,
        result: ExtractedDocumentResult,
        source_kind: str,
        context: TrackingContext | None = None,
    ) -> DocSource:
        """执行来源追踪

        Args:
            db: 数据库会话
            document_id: 关联的 KnowledgeDocument ID
            result: 提取管道返回的结果
            source_kind: 来源类型（"url"/"file_pdf"/"file_generic"/"text_input"）
            context: 额外追踪上下文

        Returns:
            创建的 DocSource 记录

        Raises:
            ValueError: 不支持的 source_kind
        """
        strategy = self._strategies.get(source_kind)
        if strategy is not None:
            pass  # 直接匹配到策略
        else:
            # 兼容别名映射（如 "text" → "text_input"）
            _ALIASES: dict[str, str] = {"text": "text_input"}
            aliased = _ALIASES.get(source_kind)
            if aliased and aliased in self._strategies:
                strategy = self._strategies[aliased]
            else:
                raise ValueError(f"No tracking strategy for source_kind: {source_kind!r}")

        ctx = context or TrackingContext()

        # 1. 使用策略提取元数据
        meta = await strategy.extract_metadata(
            document_id=document_id,
            result=result,
            context=ctx,
        )

        # 2. 通过 DAO 持久化
        doc_source = await SourceDao.create(
            db,
            document_id=document_id,
            **meta,
        )

        logger.info("source_tracked", extra={
            "doc_source_id": str(doc_source.id),
            "document_id": str(document_id),
            "source_type": meta.get("source_type"),
            "title": meta.get("title"),
        })

        return doc_source

    async def get_provenance(
        self,
        db: AsyncSession,
        document_id: UUID,
    ) -> DocSource | None:
        """查询文档的溯源信息"""
        return await SourceDao.get_by_document_id(db, document_id)

    async def get_by_id(
        self,
        db: AsyncSession,
        source_id: UUID,
    ) -> DocSource | None:
        """按 ID 查询单条来源记录"""
        return await SourceDao.get_by_id(db, source_id)

    async def list_sources(
        self,
        db: AsyncSession,
        corpus_id: UUID,
        source_type: Optional[str] = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[DocSource], int]:
        """列出语料库下的来源记录"""
        return await SourceDao.list_by_corpus(
            db,
            corpus_id=corpus_id,
            source_type=source_type,
            offset=offset,
            limit=limit,
        )
