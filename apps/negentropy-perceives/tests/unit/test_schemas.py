"""响应模型 (schemas) 单元测试。"""

from negentropy.perceives.models import (
    LinkItem,
    LinksResponse,
    PageInfoResponse,
    MarkdownResponse,
    BatchMarkdownResponse,
    PDFResponse,
    BatchPDFResponse,
)


class TestLinkItem:
    """LinkItem 模型测试。"""

    def test_required_fields(self):
        """必填字段校验。"""
        item = LinkItem(url="https://example.com", text="Example", is_internal=True)
        assert item.url == "https://example.com"
        assert item.text == "Example"
        assert item.is_internal is True


class TestLinksResponse:
    """LinksResponse 模型测试。"""

    def test_required_fields(self):
        """必填字段校验。"""
        resp = LinksResponse(
            success=True,
            url="https://example.com",
            total_links=2,
            links=[
                LinkItem(url="https://a.com", text="A", is_internal=True),
                LinkItem(url="https://b.com", text="B", is_internal=False),
            ],
            internal_links_count=1,
            external_links_count=1,
        )
        assert resp.total_links == 2
        assert resp.error is None


class TestPageInfoResponse:
    """PageInfoResponse 模型测试。"""

    def test_required_fields(self):
        """必填字段校验。"""
        resp = PageInfoResponse(
            success=True, url="https://example.com", status_code=200
        )
        assert resp.status_code == 200
        assert resp.title is None
        assert resp.description is None

    def test_with_all_fields(self):
        """全字段赋值。"""
        resp = PageInfoResponse(
            success=True,
            url="https://example.com",
            status_code=200,
            title="Test",
            description="Desc",
            content_type="text/html",
            content_length=1024,
            last_modified="2024-01-01",
        )
        assert resp.title == "Test"
        assert resp.content_length == 1024


class TestMarkdownResponse:
    """MarkdownResponse 模型测试。"""

    def test_required_fields(self):
        """必填字段校验。"""
        resp = MarkdownResponse(
            success=True,
            url="https://example.com",
            method="simple",
            conversion_time=0.5,
        )
        assert resp.word_count == 0
        assert resp.images_embedded == 0
        assert resp.markdown_content is None

    def test_with_content(self):
        """含内容的响应。"""
        resp = MarkdownResponse(
            success=True,
            url="https://example.com",
            method="simple",
            markdown_content="# Title\n\nContent",
            word_count=2,
            images_embedded=0,
            conversion_time=1.0,
        )
        assert resp.markdown_content.startswith("# Title")


class TestBatchMarkdownResponse:
    """BatchMarkdownResponse 模型测试。"""

    def test_required_fields(self):
        """必填字段校验。"""
        single = MarkdownResponse(
            success=True, url="https://a.com", method="auto", conversion_time=0.1
        )
        resp = BatchMarkdownResponse(
            success=True,
            total_urls=1,
            successful_count=1,
            failed_count=0,
            results=[single],
            total_conversion_time=0.1,
        )
        assert resp.total_word_count == 0


class TestPDFResponse:
    """PDFResponse 模型测试。"""

    def test_required_fields(self):
        """必填字段校验。"""
        resp = PDFResponse(
            success=True,
            pdf_source="/path/to/file.pdf",
            method="pymupdf",
            output_format="markdown",
            conversion_time=2.0,
        )
        assert resp.page_count == 0
        assert resp.word_count == 0
        assert resp.enhanced_assets is None

    def test_with_enhanced_assets(self):
        """含增强资源的响应。"""
        resp = PDFResponse(
            success=True,
            pdf_source="https://example.com/file.pdf",
            method="auto",
            output_format="markdown",
            conversion_time=3.0,
            enhanced_assets={"images": 5, "tables": 2, "formulas": 1},
        )
        assert resp.enhanced_assets["images"] == 5


class TestBatchPDFResponse:
    """BatchPDFResponse 模型测试。"""

    def test_required_fields(self):
        """必填字段校验。"""
        single = PDFResponse(
            success=True,
            pdf_source="a.pdf",
            method="auto",
            output_format="markdown",
            conversion_time=1.0,
        )
        resp = BatchPDFResponse(
            success=True,
            total_pdfs=1,
            successful_count=1,
            failed_count=0,
            results=[single],
            total_conversion_time=1.0,
        )
        assert resp.total_pages == 0
        assert resp.total_word_count == 0
