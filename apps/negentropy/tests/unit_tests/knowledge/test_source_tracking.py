"""SourceTracking 策略模式实现 — 单元测试

覆盖以下策略的 extract_metadata() 行为：
  - UrlSourceTracker (source_type="url")
  - PdfSourceTracker (source_type="file_pdf")
  - FileSourceTracker (source_type="file_generic")
  - TextInputTracker (source_type="text_input")
  - SourceTrackingService (策略调度器)
  - 公共工具方法 (_build_summary, _truncate_title)
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from negentropy.knowledge.source_tracking import (
    FileSourceTracker,
    PdfSourceTracker,
    SourceTrackingService,
    SourceTrackingStrategy,
    TextInputTracker,
    TrackingContext,
    UrlSourceTracker,
)

from .conftest import (
    FakeSourceDao,
    make_extracted_document_result,
    make_tracking_context,
)


# =============================================================================
# TestUrlSourceTracker
# =============================================================================


class TestUrlSourceTracker:
    """UrlSourceTracker.extract_metadata() 行为验证"""

    @pytest.mark.asyncio
    async def test_extract_metadata_full_url_page(self) -> None:
        """完整 URL 页面元数据提取：所有字段均正确填充"""
        tracker = UrlSourceTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            plain_text="This is a long enough document content for summary extraction.",
            markdown_content="# My Page Title\n\nSome body text here.",
            metadata={
                "source_url": "https://example.com/page",
                "original_url": "https://example.com/original",
                "title": "My Page Title",
                "author": "John Doe",
            },
            trace={"duration_ms": 1234},
        )
        ctx = make_tracking_context()

        meta = await tracker.extract_metadata(document_id=doc_id, result=result, context=ctx)

        assert meta["source_type"] == "url"
        assert meta["source_url"] == "https://example.com/page"
        assert meta["original_url"] == "https://example.com/original"
        assert meta["title"] == "My Page Title"
        assert meta["author"] == "John Doe"
        assert meta["extraction_duration_ms"] == 1234
        assert meta["extracted_summary"] is not None
        assert meta["extractor_tool_name"] == "parse_pdf_to_markdown"

    @pytest.mark.asyncio
    async def test_extract_metadata_title_from_metadata_priority(self) -> None:
        """标题优先级：metadata.title > trace.title > markdown H1"""
        tracker = UrlSourceTracker()
        doc_id = uuid4()

        # metadata.title 存在时应优先使用
        result_with_meta_title = make_extracted_document_result(
            metadata={"title": "Meta Title", "source_url": "https://example.com"},
            trace={"title": "Trace Title"},
            markdown_content="# Markdown Heading",
        )
        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result_with_meta_title,
            context=make_tracking_context(),
        )
        assert meta["title"] == "Meta Title"

        # 无 metadata.title 时回退到 trace.title
        result_trace_fallback = make_extracted_document_result(
            metadata={"source_url": "https://example.com"},
            trace={"title": "Trace Title Only"},
            markdown_content="# Should Not Use This",
        )
        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result_trace_fallback,
            context=make_tracking_context(),
        )
        assert meta["title"] == "Trace Title Only"

    @pytest.mark.asyncio
    async def test_extract_metadata_title_from_markdown_heading(self) -> None:
        """从 Markdown # Heading 提取标题（metadata/trace 均无 title 时）"""
        tracker = UrlSourceTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"source_url": "https://example.com"},
            trace={},
            markdown_content="# Extracted From Heading\n\nBody text.",
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["title"] == "Extracted From Heading"

    @pytest.mark.asyncio
    async def test_extract_metadata_title_from_first_nonempty_line(self) -> None:
        """无 H1 标题时，回退到 Markdown 第一行非空文本（截断至 200 字符）"""
        tracker = UrlSourceTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"source_url": "https://example.com"},
            trace={},
            markdown_content="\n\nFirst non-empty line used as fallback title.",
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["title"] == "First non-empty line used as fallback title."

    @pytest.mark.asyncio
    async def test_extract_metadata_empty_markdown_returns_none_title(self) -> None:
        """Markdown 为 None 或空字符串时，标题应为 None"""
        tracker = UrlSourceTracker()
        doc_id = uuid4()

        # markdown 为 None
        result_none = make_extracted_document_result(
            metadata={"source_url": "https://example.com"},
            markdown_content=None,
        )
        meta_none = await tracker.extract_metadata(
            document_id=doc_id,
            result=result_none,
            context=make_tracking_context(),
        )
        assert meta_none["title"] is None

        # markdown 为空字符串
        result_empty = make_extracted_document_result(
            metadata={"source_url": "https://example.com"},
            markdown_content="",
        )
        meta_empty = await tracker.extract_metadata(
            document_id=doc_id,
            result=result_empty,
            context=make_tracking_context(),
        )
        assert meta_empty["title"] is None

    @pytest.mark.asyncio
    async def test_extract_metadata_falls_back_to_url_when_no_title(self) -> None:
        """metadata / trace / markdown 均无可用标题时，title 应为 None"""
        tracker = UrlSourceTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"source_url": "https://example.com"},
            trace={},
            markdown_content=None,
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["title"] is None

    @pytest.mark.asyncio
    async def test_source_type_property(self) -> None:
        """source_type 属性返回 'url'"""
        tracker = UrlSourceTracker()
        assert tracker.source_type == "url"

    @pytest.mark.asyncio
    async def test_original_url_falls_back_to_source_url(self) -> None:
        """当 original_url 缺失时，应回退到 source_url"""
        tracker = UrlSourceTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"source_url": "https://example.com/page"},
            # 不设置 original_url
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["original_url"] == "https://example.com/page"


# =============================================================================
# TestPdfSourceTracker
# =============================================================================


class TestPdfSourceTracker:
    """PdfSourceTracker.extract_metadata() 行为验证"""

    @pytest.mark.asyncio
    async def test_extract_metadata_with_pdf_info(self) -> None:
        """PDF 特有字段（page_count、pdf_info）正确注入 raw_metadata"""
        tracker = PdfSourceTracker()
        doc_id = uuid4()
        pdf_info = {"creator": "Acrobat", "producer": "PDFLib"}
        result = make_extracted_document_result(
            metadata={
                "filename": "report.pdf",
                "page_count": 42,
                "pdf_info": pdf_info,
                "author": "Jane Smith",
            },
            trace={"duration_ms": 5678},
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["source_type"] == "file_pdf"
        assert meta["title"] == "report"  # .pdf 被移除
        assert meta["author"] == "Jane Smith"
        assert meta["extraction_duration_ms"] == 5678
        # 验证 PDF 特有字段存在于 raw_metadata._tracking_context 中
        raw = meta.get("raw_metadata", {})
        tc = raw.get("_tracking_context", {})
        assert tc.get("page_count") == 42
        assert tc.get("pdf_info") == pdf_info

    @pytest.mark.asyncio
    async def test_extract_metadata_title_from_filename(self) -> None:
        """文件名去除 .pdf 后缀并将下划线替换为空格作为标题"""
        tracker = PdfSourceTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"filename": "annual_report_2024.pdf"},
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        # 代码逻辑：.replace(".pdf", "").replace("_", " ").strip()
        assert meta["title"] == "annual report 2024"

    @pytest.mark.asyncio
    async def test_extract_metadata_original_url_is_none(self) -> None:
        """PDF 来源的 original_url 始终为 None"""
        tracker = PdfSourceTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"filename": "test.pdf", "source_url": "gs://bucket/test.pdf"},
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["original_url"] is None

    @pytest.mark.asyncio
    async def test_extract_metadata_raw_contains_pdf_specific_fields(self) -> None:
        """raw_metadata._tracking_context 包含 page_count 和 pdf_info 字段"""
        tracker = PdfSourceTracker()
        doc_id = uuid4()
        pdf_info = {"format": "PDF-1.4"}
        result = make_extracted_document_result(
            metadata={
                "filename": "doc.pdf",
                "page_count": 10,
                "pdf_info": pdf_info,
            },
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        raw = meta["raw_metadata"]
        tc = raw.get("_tracking_context", {})
        assert "page_count" in tc
        assert tc["page_count"] == 10
        assert "pdf_info" in tc
        assert tc["pdf_info"] == pdf_info

    @pytest.mark.asyncio
    async def test_source_type_property(self) -> None:
        """source_type 属性返回 'file_pdf'"""
        tracker = PdfSourceTracker()
        assert tracker.source_type == "file_pdf"

    @pytest.mark.asyncio
    async def test_filename_without_extension_uses_as_is(self) -> None:
        """无 .pdf 后缀的文件名（如 README）原样使用作为标题"""
        tracker = PdfSourceTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"filename": "README"},
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["title"] == "README"


# =============================================================================
# TestFileSourceTracker
# =============================================================================


class TestFileSourceTracker:
    """FileSourceTracker.extract_metadata() 行为验证"""

    @pytest.mark.asyncio
    async def test_extract_metadata_generic_file(self) -> None:
        """通用文件的元数据结构正确"""
        tracker = FileSourceTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"filename": "data.csv", "source_url": "/tmp/data.csv"},
            trace={"duration_ms": 100},
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["source_type"] == "file_generic"
        assert meta["source_url"] == "/tmp/data.csv"
        assert meta["original_url"] is None
        assert meta["extraction_duration_ms"] == 100
        assert "extracted_at" in meta
        assert "raw_metadata" in meta

    @pytest.mark.asyncio
    async def test_extract_metadata_title_strips_extension(self) -> None:
        """文件名应去除扩展名后作为标题（如 report.txt → report）"""
        tracker = FileSourceTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"filename": "report.txt"},
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["title"] == "report"

    @pytest.mark.asyncio
    async def test_extract_metadata_dotfile_preserves_name(self) -> None:
        """点号开头的隐藏文件（如 .gitignore）应保留完整名称"""
        tracker = FileSourceTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"filename": ".gitignore"},
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["title"] == ".gitignore"

    @pytest.mark.asyncio
    async def test_extract_metadata_empty_filename_title_none(self) -> None:
        """空文件名时标题应为 None"""
        tracker = FileSourceTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"filename": ""},
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["title"] is None

    @pytest.mark.asyncio
    async def test_author_always_none(self) -> None:
        """通用文件来源的 author 始终为 None"""
        tracker = FileSourceTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"filename": "notes.txt", "author": "Someone"},
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["author"] is None

    @pytest.mark.asyncio
    async def test_source_type_property(self) -> None:
        """source_type 属性返回 'file_generic'"""
        tracker = FileSourceTracker()
        assert tracker.source_type == "file_generic"


# =============================================================================
# TestTextInputTracker
# =============================================================================


class TestTextInputTracker:
    """TextInputTracker.extract_metadata() 行为验证"""

    @pytest.mark.asyncio
    async def test_extract_metadata_with_custom_title(self) -> None:
        """自定义标题覆盖默认值 '文本输入'"""
        tracker = TextInputTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"title": "My Custom Title"},
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["title"] == "My Custom Title"

    @pytest.mark.asyncio
    async def test_extract_metadata_default_title_text_input(self) -> None:
        """未提供标题时默认值为 '文本输入'"""
        tracker = TextInputTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(metadata={})

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["title"] == "文本输入"

    @pytest.mark.asyncio
    async def test_extractor_fields_are_nullified(self) -> None:
        """extractor_tool_name 和 extractor_server_id 强制置为 None"""
        tracker = TextInputTracker()
        doc_id = uuid4()
        server_uuid = uuid4()
        ctx = make_tracking_context(
            mcp_tool_name="some_tool",
            mcp_server_id=server_uuid,
        )
        result = make_extracted_document_result(metadata={})

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=ctx,
        )

        assert meta["extractor_tool_name"] is None
        assert meta["extractor_server_id"] is None

    @pytest.mark.asyncio
    async def test_source_url_and_original_url_are_none(self) -> None:
        """文本输入的 source_url 和 original_url 始终为 None"""
        tracker = TextInputTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"source_url": "should_be_ignored"},
        )

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["source_url"] is None
        assert meta["original_url"] is None

    @pytest.mark.asyncio
    async def test_extraction_duration_ms_is_none(self) -> None:
        """文本输入的 extraction_duration_ms 始终为 None"""
        tracker = TextInputTracker()
        doc_id = uuid4()
        result = make_extracted_document_result(trace={"duration_ms": 9999})

        meta = await tracker.extract_metadata(
            document_id=doc_id,
            result=result,
            context=make_tracking_context(),
        )

        assert meta["extraction_duration_ms"] is None

    @pytest.mark.asyncio
    async def test_source_type_property(self) -> None:
        """source_type 属性返回 'text_input'"""
        tracker = TextInputTracker()
        assert tracker.source_type == "text_input"


# =============================================================================
# TestSourceTrackingService
# =============================================================================


class TestSourceTrackingService:
    """SourceTrackingService 策略调度器行为验证"""

    @pytest.mark.asyncio
    async def test_track_dispatches_to_correct_strategy(self, monkeypatch) -> None:
        """url 类型的 source_kind 应分发到 UrlSourceTracker"""
        service = SourceTrackingService()
        fake_dao = FakeSourceDao()
        fake_db = object()  # 仅作占位符
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"source_url": "https://example.com", "title": "Test URL"},
        )

        monkeypatch.setattr("negentropy.knowledge.source_tracking.SourceDao", fake_dao)
        doc_source = await service.track(
            fake_db,
            document_id=doc_id,
            result=result,
            source_kind="url",
            context=make_tracking_context(),
        )

        # 验证 DAO 收到了正确的参数
        assert len(fake_dao.created_sources) == 1
        created = fake_dao.created_sources[0]
        assert created["source_type"] == "url"
        assert created["source_url"] == "https://example.com"
        assert created["title"] == "Test URL"

    @pytest.mark.asyncio
    async def test_track_resolves_alias_text_to_text_input(self, monkeypatch) -> None:
        """'text' 别名应被解析为 'text_input' 策略"""
        service = SourceTrackingService()
        fake_dao = FakeSourceDao()
        fake_db = object()
        doc_id = uuid4()
        result = make_extracted_document_result(metadata={})

        monkeypatch.setattr("negentropy.knowledge.source_tracking.SourceDao", fake_dao)
        doc_source = await service.track(
            fake_db,
            document_id=doc_id,
            result=result,
            source_kind="text",
            context=make_tracking_context(),
        )

        created = fake_dao.created_sources[0]
        assert created["source_type"] == "text_input"
        assert created["title"] == "文本输入"

    @pytest.mark.asyncio
    async def test_track_raises_on_unknown_source_kind(self) -> None:
        """不支持的 source_kind 应抛出 ValueError"""
        service = SourceTrackingService()
        fake_db = object()
        doc_id = uuid4()
        result = make_extracted_document_result(metadata={})

        with pytest.raises(ValueError, match="No tracking strategy for source_kind"):
            await service.track(
                fake_db,
                document_id=doc_id,
                result=result,
                source_kind="unknown_kind",
                context=make_tracking_context(),
            )

    @pytest.mark.asyncio
    async def test_track_calls_source_dao_create_with_correct_args(self, monkeypatch) -> None:
        """验证 track() 向 DAO.create() 传递了完整且正确的参数集合"""
        service = SourceTrackingService()
        fake_dao = FakeSourceDao()
        fake_db = object()
        doc_id = uuid4()
        corpus_id = uuid4()
        ctx = make_tracking_context(corpus_id=corpus_id)
        result = make_extracted_document_result(
            metadata={"source_url": "https://example.com/doc", "title": "Doc Title"},
            plain_text="Content for summary.",
        )

        monkeypatch.setattr("negentropy.knowledge.source_tracking.SourceDao", fake_dao)
        await service.track(
            fake_db,
            document_id=doc_id,
            result=result,
            source_kind="url",
            context=ctx,
        )

        created = fake_dao.created_sources[0]
        # 核心字段验证
        assert created["document_id"] == doc_id
        assert created["source_type"] == "url"
        assert created["source_url"] == "https://example.com/doc"
        assert created["title"] == "Doc Title"
        assert created["extracted_summary"] is not None
        assert created["extracted_at"] is not None
        assert created["raw_metadata"] is not None
        # tracking_context 注入验证
        tc = created["raw_metadata"].get("_tracking_context", {})
        assert tc["tracker_run_id"] == "run-test-001"
        assert tc["corpus_id"] == str(corpus_id)
        assert tc["app_name"] == "negentropy"

    @pytest.mark.asyncio
    async def test_track_with_none_context_defaults(self, monkeypatch) -> None:
        """context=None 时应使用默认 TrackingContext()"""
        service = SourceTrackingService()
        fake_dao = FakeSourceDao()
        fake_db = object()
        doc_id = uuid4()
        result = make_extracted_document_result(
            metadata={"source_url": "https://example.com", "title": "Default Ctx"},
        )

        monkeypatch.setattr("negentropy.knowledge.source_tracking.SourceDao", fake_dao)
        doc_source = await service.track(
            fake_db,
            document_id=doc_id,
            result=result,
            source_kind="url",
            context=None,
        )

        created = fake_dao.created_sources[0]
        # 默认上下文中 mcp_tool_name / mcp_server_id 应为 None
        assert created["extractor_tool_name"] is None
        assert created["extractor_server_id"] is None
        # tracking_context 中的字段也应为默认值
        tc = created["raw_metadata"].get("_tracking_context", {})
        assert tc["tracker_run_id"] is None
        assert tc["corpus_id"] is None
        assert tc["app_name"] is None


# =============================================================================
# TestCommonUtilityMethods
# =============================================================================


class TestCommonUtilityMethods:
    """公共工具方法 _build_summary 与 _truncate_title 的行为验证"""

    def test_build_summary_truncates_long_text(self) -> None:
        """超过 SUMMARY_MAX_LENGTH (300) 的文本应截断并附加 '...'"""
        long_text = "A" * 400
        result = make_extracted_document_result(plain_text=long_text)

        summary = SourceTrackingStrategy._build_summary(result)

        assert summary is not None
        assert len(summary) == SourceTrackingStrategy.SUMMARY_MAX_LENGTH  # 300
        assert summary.endswith(SourceTrackingStrategy.ELLIPSIS)  # 以 ... 结尾

    def test_build_summary_short_text_unchanged(self) -> None:
        """不超过 SUMMARY_MAX_LENGTH 的文本应原样返回"""
        short_text = "Short content."
        result = make_extracted_document_result(plain_text=short_text)

        summary = SourceTrackingStrategy._build_summary(result)

        assert summary == short_text

    def test_build_summary_empty_plain_text_returns_none(self) -> None:
        """plain_text 为空或 None 时应返回 None"""
        # 空字符串
        result_empty = make_extracted_document_result(plain_text="")
        assert SourceTrackingStrategy._build_summary(result_empty) is None

        # None
        result_none = make_extracted_document_result(plain_text=None)
        assert SourceTrackingStrategy._build_summary(result_none) is None

    def test_truncate_title_within_limit_unchanged(self) -> None:
        """不超过 TITLE_MAX_LENGTH (500) 的标题应原样返回"""
        title = "A" * 500
        assert SourceTrackingStrategy._truncate_title(title) == title

        short_title = "Normal Title"
        assert SourceTrackingStrategy._truncate_title(short_title) == short_title

    def test_truncate_title_exceeds_limit(self) -> None:
        """超过 TITLE_MAX_LENGTH (500) 的标题应截断"""
        long_title = "B" * 600
        truncated = SourceTrackingStrategy._truncate_title(long_title)

        assert truncated is not None
        assert len(truncated) == SourceTrackingStrategy.TITLE_MAX_LENGTH  # 500
        assert truncated == "B" * 500

    def test_truncate_title_none_input_returns_none(self) -> None:
        """输入为 None 时应返回 None"""
        assert SourceTrackingStrategy._truncate_title(None) is None

        # 空字符串同样返回 None
        assert SourceTrackingStrategy._truncate_title("") is None

    def test_truncate_title_custom_max_len(self) -> None:
        """自定义 max_len 参数应生效"""
        title = "C" * 100
        custom_max = 50
        truncated = SourceTrackingStrategy._truncate_title(title, max_len=custom_max)

        assert truncated is not None
        assert len(truncated) == custom_max
        assert truncated == "C" * 50

        # 未超限时不截断
        short = "Short"
        assert SourceTrackingStrategy._truncate_title(short, max_len=100) == "Short"
