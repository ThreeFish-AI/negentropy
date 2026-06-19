"""测试 run_id 语义化辅助函数：_extract_source_label / _sanitize_label"""

from __future__ import annotations

from negentropy.knowledge.service import _extract_source_label, _sanitize_label

# ---------------------------------------------------------------------------
# _sanitize_label
# ---------------------------------------------------------------------------


class TestSanitizeLabel:
    def test_simple_name(self) -> None:
        assert _sanitize_label("report.pdf") == "report.pdf"

    def test_spaces_replaced(self) -> None:
        assert _sanitize_label("my report name") == "my_report_name"

    def test_special_chars_replaced(self) -> None:
        assert _sanitize_label("hello@world#123") == "hello_world_123"

    def test_consecutive_underscores_collapsed(self) -> None:
        assert _sanitize_label("a   b") == "a_b"

    def test_leading_trailing_stripped(self) -> None:
        assert _sanitize_label("__hello__") == "hello"

    def test_truncation(self) -> None:
        long_name = "a" * 100
        assert len(_sanitize_label(long_name)) == 50

    def test_unicode_preserved(self) -> None:
        assert _sanitize_label("中文文档") == "中文文档"

    def test_empty_string(self) -> None:
        assert _sanitize_label("") == ""

    def test_only_special_chars(self) -> None:
        assert _sanitize_label("@#$%") == ""


# ---------------------------------------------------------------------------
# _extract_source_label — filename 优先级
# ---------------------------------------------------------------------------


class TestExtractFromFilename:
    def test_pdf_filename(self) -> None:
        assert _extract_source_label({"filename": "report.pdf"}) == "report"

    def test_docx_filename(self) -> None:
        assert _extract_source_label({"filename": "meeting notes.docx"}) == "meeting_notes"

    def test_filename_with_path(self) -> None:
        assert _extract_source_label({"filename": "/uploads/my paper.pdf"}) == "my_paper"

    def test_filename_without_extension(self) -> None:
        assert _extract_source_label({"filename": "README"}) == "README"


# ---------------------------------------------------------------------------
# _extract_source_label — URL 优先级
# ---------------------------------------------------------------------------


class TestExtractFromUrl:
    def test_url_with_path(self) -> None:
        assert _extract_source_label({"url": "https://blog.com/post/guide"}) == "guide"

    def test_url_with_trailing_slash(self) -> None:
        assert _extract_source_label({"url": "https://blog.com/post/guide/"}) == "guide"

    def test_url_encoded_path(self) -> None:
        assert _extract_source_label({"url": "https://blog.com/post/my%20article"}) == "my_article"

    def test_url_root_uses_domain(self) -> None:
        assert _extract_source_label({"url": "https://example.com/"}) == "example.com"

    def test_url_no_path_uses_domain(self) -> None:
        assert _extract_source_label({"url": "https://example.com"}) == "example.com"


# ---------------------------------------------------------------------------
# _extract_source_label — source_uri 优先级
# ---------------------------------------------------------------------------


class TestExtractFromSourceUri:
    def test_gcs_uri_with_filename(self) -> None:
        assert _extract_source_label({"source_uri": "pgblob://bucket/app/corpus/report.pdf"}) == "report"

    def test_gcs_uri_without_extension(self) -> None:
        assert _extract_source_label({"source_uri": "pgblob://bucket/app/corpus/data"}) == "data"

    def test_http_source_uri(self) -> None:
        assert _extract_source_label({"source_uri": "https://docs.com/guide/install"}) == "install"

    def test_generic_uri_last_segment(self) -> None:
        assert _extract_source_label({"source_uri": "memory://some/path/doc_name"}) == "doc_name"


# ---------------------------------------------------------------------------
# _extract_source_label — 优先级 & 回退
# ---------------------------------------------------------------------------


class TestExtractPriority:
    def test_filename_over_url(self) -> None:
        """filename 优先级高于 url"""
        result = _extract_source_label({"filename": "file.pdf", "url": "https://x.com/article"})
        assert result == "file"

    def test_url_over_source_uri(self) -> None:
        """url 优先级高于 source_uri"""
        result = _extract_source_label({"url": "https://x.com/article", "source_uri": "pgblob://b/doc.pdf"})
        assert result == "article"

    def test_empty_input_returns_empty(self) -> None:
        assert _extract_source_label({}) == ""

    def test_all_empty_fields_returns_empty(self) -> None:
        assert _extract_source_label({"filename": "", "url": "", "source_uri": ""}) == ""
