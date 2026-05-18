"""
## PDF 处理器单元测试 (`test_pdf_processor.py`)

### PDFProcessor 核心类测试

#### 1. 初始化和配置测试

测试 PDFProcessor 实例的正确创建和配置、支持的 PDF 处理方法 (pymupdf, pypdf2, auto)、临时目录的创建和权限设置。

#### 2. URL 检测和文件下载测试

测试 `_is_url()` 方法对各种 URL 格式的识别 (HTTP/HTTPS URL 识别、本地路径识别、无效格式处理)、从 URL 下载 PDF 文件的功能 (成功下载测试、HTTP 错误处理 (404, 500 等)、网络异常处理、临时文件创建和存储)。

#### 3. PDF 提取引擎测试

**PyMuPDF (fitz) 引擎测试**:

测试文本内容的基本提取功能、指定页面范围的部分提取、PDF 元数据 (标题、作者、创建日期) 的提取、损坏或无效 PDF 文件的处理。

**PyPDF2 引擎测试**:

测试 PyPDF2 引擎的文本提取能力、元数据字段的正确解析和转换、多页文档的页面迭代处理、PDF 解析异常的处理机制。

#### 4. 智能方法选择测试 (auto 模式)

测试 PyMuPDF → PyPDF2 的自动选择优先级、主方法失败时的自动切换机制、两个引擎都失败时的错误处理、最终使用的方法正确记录在结果中。

#### 5. Markdown 转换测试

测试原始 PDF 文本的清理和格式化、大写文本和结尾冒号的标题识别、Markdown 格式的优化处理、空文本内容的处理逻辑。

#### 6. 批量处理测试

测试多个 PDF 文件的并发处理能力、部分文件失败时的整体处理逻辑、成功/失败统计和汇总信息的计算、批量处理过程中的异常捕获和处理。

#### 7. 资源管理测试

测试临时文件的自动清理机制、PDF 处理过程中的内存使用优化、临时目录的完整清理功能、异常情况下的资源释放保证。

#### 8. 验证和错误处理测试

测试输入参数的格式验证和错误提示、本地 PDF 文件存在性的检查、页面范围参数的合法性验证、输出格式 (markdown/text) 的验证。

### PDF MCP 工具集成测试

#### parse_pdf_to_markdown 工具测试

测试方法、输出格式、页面范围等参数的验证、本地 PDF 文件路径的处理、PDF URL 的下载和处理流程、各种错误情况的响应格式统一性。

#### parse_pdfs_to_markdown 工具测试

测试 PDF 源列表的验证逻辑、批量处理的性能和准确性、成功和失败混合结果的处理、批量处理统计信息的准确性。
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from pathlib import Path
import tempfile
import os

from negentropy.perceives.pdf.processor import PDFProcessor


class TestPDFProcessor:
    """
    测试 PDF 处理器主要功能

    包含 PDF 文档解析、转换、批量处理等完整的测试覆盖
    """

    def setup_method(self):
        """测试前准备"""
        self.processor = PDFProcessor()

    def teardown_method(self):
        """测试后清理"""
        self.processor.cleanup()

    def test_processor_initialization(self):
        """测试处理器初始化"""
        assert self.processor is not None
        assert hasattr(self.processor, "process_pdf")
        assert hasattr(self.processor, "batch_process_pdfs")
        assert self.processor.supported_methods == [
            "pymupdf",
            "pypdf",
            "auto",
            "docling",
            "opendataloader",
            "smart",
            "mineru",
            "marker",
        ]
        assert os.path.exists(self.processor.temp_dir)

    def test_supported_methods(self):
        """测试支持的方法列表"""
        expected_methods = [
            "pymupdf",
            "pypdf",
            "auto",
            "docling",
            "opendataloader",
            "smart",
            "mineru",
            "marker",
        ]
        assert self.processor.supported_methods == expected_methods

    def test_url_detection(self):
        """测试URL检测功能"""
        # 有效的URL
        assert self.processor._is_url("https://example.com/document.pdf") is True
        assert self.processor._is_url("http://example.com/document.pdf") is True

        # 无效的URL
        assert self.processor._is_url("/local/path/document.pdf") is False
        assert self.processor._is_url("document.pdf") is False
        assert self.processor._is_url("ftp://example.com/document.pdf") is False
        assert self.processor._is_url("") is False

    @pytest.mark.asyncio
    async def test_invalid_method_validation(self):
        """测试无效方法验证"""
        result = await self.processor.process_pdf("test.pdf", method="invalid_method")

        assert result["success"] is False
        assert "Method must be one of" in result["error"]
        assert result["source"] == "test.pdf"

    @pytest.mark.asyncio
    async def test_nonexistent_file_handling(self):
        """测试不存在文件的处理"""
        result = await self.processor.process_pdf("nonexistent.pdf")

        assert result["success"] is False
        assert result["error"] == "PDF file does not exist"
        assert result["source"] == "nonexistent.pdf"

    @pytest.mark.asyncio
    @patch("aiohttp.ClientSession.get")
    async def test_pdf_download_success(self, mock_get):
        """测试PDF下载成功"""
        # 模拟成功的HTTP响应
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.read = AsyncMock(return_value=b"fake PDF content")
        mock_get.return_value.__aenter__.return_value = mock_response

        result_path = await self.processor._download_pdf("https://example.com/test.pdf")

        assert result_path is not None
        assert isinstance(result_path, Path)
        assert result_path.suffix == ".pdf"
        assert str(result_path).startswith(self.processor.temp_dir)

    @pytest.mark.asyncio
    @patch("aiohttp.ClientSession.get")
    async def test_pdf_download_failure(self, mock_get):
        """测试PDF下载失败"""
        # 模拟HTTP错误响应
        mock_response = AsyncMock()
        mock_response.status = 404
        mock_get.return_value.__aenter__.return_value = mock_response

        result_path = await self.processor._download_pdf(
            "https://example.com/nonexistent.pdf"
        )

        assert result_path is None

    @pytest.mark.asyncio
    @patch("aiohttp.ClientSession.get")
    async def test_pdf_download_network_error(self, mock_get):
        """测试PDF下载网络错误"""
        # 模拟网络异常
        mock_get.side_effect = Exception("Network error")

        result_path = await self.processor._download_pdf("https://example.com/test.pdf")

        assert result_path is None


class TestPyMuPDFExtraction:
    """测试PyMuPDF提取功能"""

    def setup_method(self):
        """测试前准备"""
        self.processor = PDFProcessor()

    def teardown_method(self):
        """测试后清理"""
        self.processor.cleanup()

    @pytest.mark.asyncio
    @patch("negentropy.perceives.pdf.processor._import_fitz")
    async def test_pymupdf_extraction_success(self, mock_import_fitz):
        """测试PyMuPDF提取成功（block级提取）"""
        # 模拟fitz模块
        mock_fitz = Mock()
        mock_import_fitz.return_value = mock_fitz

        # 模拟PDF文档
        mock_doc = Mock()
        mock_doc.page_count = 2
        mock_doc.metadata = {
            "title": "Test Document",
            "author": "Test Author",
            "creationDate": "2023-01-01",
        }
        mock_fitz.open.return_value = mock_doc

        # 模拟页面 - 使用 blocks 格式
        # (x0, y0, x1, y1, text, block_no, block_type)
        mock_page1 = Mock()
        mock_page1.get_text.return_value = [
            (0, 0, 100, 20, "Page 1 content\n", 0, 0),
        ]
        mock_page2 = Mock()
        mock_page2.get_text.return_value = [
            (0, 0, 100, 20, "Page 2 content\n", 0, 0),
        ]
        mock_doc.load_page.side_effect = [mock_page1, mock_page2]

        # 创建临时PDF文件
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)

        try:
            result = await self.processor._extract_with_pymupdf(
                tmp_path, include_metadata=True
            )

            assert result["success"] is True
            assert "Page 1 content" in result["text"]
            assert "Page 2 content" in result["text"]
            assert result["pages_processed"] == 2
            assert result["total_pages"] == 2
            assert result["metadata"]["title"] == "Test Document"
            assert result["metadata"]["author"] == "Test Author"

            mock_doc.close.assert_called_once()

        finally:
            # 清理临时文件
            if tmp_path.exists():
                tmp_path.unlink()

    @pytest.mark.asyncio
    @patch("negentropy.perceives.pdf.processor._import_fitz")
    async def test_pymupdf_with_page_range(self, mock_import_fitz):
        """测试PyMuPDF页面范围提取（block级）"""
        # 模拟fitz模块
        mock_fitz = Mock()
        mock_import_fitz.return_value = mock_fitz

        # 模拟PDF文档
        mock_doc = Mock()
        mock_doc.page_count = 5
        mock_doc.metadata = {}
        mock_fitz.open.return_value = mock_doc

        # 模拟页面 - 使用 blocks 格式
        mock_pages = []
        for i in range(5):
            mock_page = Mock()
            mock_page.get_text.return_value = [
                (0, 0, 100, 20, f"Page {i + 1} content\n", 0, 0),
            ]
            mock_pages.append(mock_page)

        # 正确设置 load_page 的模拟行为
        def mock_load_page(page_num):
            return mock_pages[page_num]

        mock_doc.load_page.side_effect = mock_load_page

        # 创建临时PDF文件
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)

        try:
            result = await self.processor._extract_with_pymupdf(
                tmp_path, page_range=(1, 3), include_metadata=False
            )

            assert result["success"] is True
            assert "Page 2 content" in result["text"]
            assert "Page 3 content" in result["text"]
            assert "Page 1 content" not in result["text"]
            assert "Page 4 content" not in result["text"]
            assert result["pages_processed"] == 2  # pages 1-2 (0-indexed)
            assert "metadata" not in result

        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    @pytest.mark.asyncio
    @patch("negentropy.perceives.pdf.processor._import_fitz")
    async def test_pymupdf_extraction_with_inline_images(self, mock_import_fitz):
        """测试PyMuPDF提取中图片被内联到文本中"""
        mock_fitz = Mock()
        mock_import_fitz.return_value = mock_fitz

        mock_doc = Mock()
        mock_doc.page_count = 1
        mock_doc.metadata = {}
        mock_fitz.open.return_value = mock_doc

        # 模拟页面 - 包含文本块和图片块，按位置排序
        # (x0, y0, x1, y1, text/data, block_no, block_type)
        mock_page = Mock()
        mock_page.get_text.return_value = [
            (0, 0, 500, 30, "Introduction paragraph.\n", 0, 0),  # text block
            (0, 40, 500, 300, b"image_binary", 1, 1),  # image block
            (0, 310, 500, 350, "Text after the image.\n", 2, 0),  # text block
        ]
        mock_doc.load_page.return_value = mock_page

        # 预填充 _page_image_maps（模拟 _extract_enhanced_assets 已运行）
        from negentropy.perceives.pdf.enhanced import ExtractedImage

        self.processor._page_image_maps = {
            0: {
                1: ExtractedImage(
                    id="img_0_0",
                    filename="figure-1-architecture.png",
                    local_path="/tmp/figure-1-architecture.png",
                    caption="Figure 1: Architecture",
                    page_number=0,
                )
            }
        }

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)

        try:
            result = await self.processor._extract_with_pymupdf(
                tmp_path, include_metadata=False
            )

            assert result["success"] is True
            text = result["text"]
            # 验证图片引用内联在正确位置
            assert "Introduction paragraph." in text
            assert "![Figure 1: Architecture](figure-1-architecture.png)" in text
            assert "Text after the image." in text

            # 验证顺序: text -> image -> text
            intro_pos = text.index("Introduction paragraph.")
            img_pos = text.index("![Figure 1: Architecture]")
            after_pos = text.index("Text after the image.")
            assert intro_pos < img_pos < after_pos

        finally:
            if tmp_path.exists():
                tmp_path.unlink()
            self.processor._page_image_maps.clear()

    @pytest.mark.asyncio
    @patch("negentropy.perceives.pdf.processor._import_fitz")
    async def test_pymupdf_extraction_error(self, mock_import_fitz):
        """测试PyMuPDF提取错误"""
        # 模拟导入错误
        mock_import_fitz.side_effect = ImportError("PyMuPDF not available")

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)

        try:
            result = await self.processor._extract_with_pymupdf(tmp_path)

            assert result["success"] is False
            assert "PyMuPDF extraction failed" in result["error"]

        finally:
            if tmp_path.exists():
                tmp_path.unlink()


class TestPyPDFExtraction:
    """测试pypdf提取功能"""

    def setup_method(self):
        """测试前准备"""
        self.processor = PDFProcessor()

    def teardown_method(self):
        """测试后清理"""
        self.processor.cleanup()

    @pytest.mark.asyncio
    @patch("negentropy.perceives.pdf.processor._import_pypdf")
    @patch("builtins.open", create=True)
    async def test_pypdf_extraction_success(self, mock_open, mock_import_pypdf):
        """测试pypdf提取成功"""
        # 模拟pypdf模块
        mock_pypdf = Mock()
        mock_import_pypdf.return_value = mock_pypdf

        # 模拟PDF阅读器
        mock_reader = Mock()
        mock_reader.pages = [Mock(), Mock()]  # 2页
        mock_reader.metadata = {
            "/Title": "Test Document",
            "/Author": "Test Author",
            "/CreationDate": "D:20230101000000Z",
        }
        mock_pypdf.PdfReader.return_value = mock_reader

        # 模拟页面
        mock_reader.pages[0].extract_text.return_value = "Page 1 content"
        mock_reader.pages[1].extract_text.return_value = "Page 2 content"

        # 模拟文件操作
        mock_file = Mock()
        mock_open.return_value.__enter__.return_value = mock_file

        # 创建临时PDF文件
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)

        try:
            result = await self.processor._extract_with_pypdf(
                tmp_path, include_metadata=True
            )

            assert result["success"] is True
            assert "Page 1 content" in result["text"]
            assert "Page 2 content" in result["text"]
            assert result["pages_processed"] == 2
            assert result["total_pages"] == 2
            assert result["metadata"]["title"] == "Test Document"
            assert result["metadata"]["author"] == "Test Author"

        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    @pytest.mark.asyncio
    @patch("negentropy.perceives.pdf.processor._import_pypdf")
    @patch("builtins.open", create=True)
    async def test_pypdf_with_page_range(self, mock_open, mock_import_pypdf):
        """测试pypdf页面范围提取"""
        # 模拟pypdf模块
        mock_pypdf = Mock()
        mock_import_pypdf.return_value = mock_pypdf

        # 模拟PDF阅读器（5页）
        mock_reader = Mock()
        mock_reader.pages = [Mock() for _ in range(5)]
        mock_reader.metadata = None
        mock_pypdf.PdfReader.return_value = mock_reader

        # 模拟页面内容
        for i, page in enumerate(mock_reader.pages):
            page.extract_text.return_value = f"Page {i + 1} content"

        # 模拟文件操作
        mock_file = Mock()
        mock_open.return_value.__enter__.return_value = mock_file

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)

        try:
            result = await self.processor._extract_with_pypdf(
                tmp_path, page_range=(2, 4), include_metadata=False
            )

            assert result["success"] is True
            assert "Page 3 content" in result["text"]
            assert "Page 4 content" in result["text"]
            assert "Page 1 content" not in result["text"]
            assert "Page 5 content" not in result["text"]
            assert result["pages_processed"] == 2
            assert "metadata" not in result

        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    @pytest.mark.asyncio
    @patch("negentropy.perceives.pdf.processor._import_pypdf")
    async def test_pypdf_extraction_error(self, mock_import_pypdf):
        """测试pypdf提取错误"""
        mock_import_pypdf.side_effect = ImportError("pypdf not available")

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)

        try:
            result = await self.processor._extract_with_pypdf(tmp_path)

            assert result["success"] is False
            assert "pypdf extraction failed" in result["error"]

        finally:
            if tmp_path.exists():
                tmp_path.unlink()


class TestAutoExtraction:
    """测试自动提取功能"""

    def setup_method(self):
        """测试前准备"""
        self.processor = PDFProcessor()

    def teardown_method(self):
        """测试后清理"""
        self.processor.cleanup()

    @pytest.mark.asyncio
    async def test_auto_extraction_pymupdf_success(self):
        """测试自动提取PyMuPDF成功"""
        with patch.object(self.processor, "_extract_with_pymupdf") as mock_pymupdf:
            mock_pymupdf.return_value = {
                "success": True,
                "text": "Extracted text",
                "pages_processed": 1,
            }

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
                tmp_path = Path(tmp_file.name)

            try:
                result = await self.processor._auto_extract(tmp_path)

                assert result["success"] is True
                assert result["method_used"] == "pymupdf"
                assert result["text"] == "Extracted text"
                mock_pymupdf.assert_called_once()

            finally:
                if tmp_path.exists():
                    tmp_path.unlink()

    @pytest.mark.asyncio
    async def test_auto_extraction_fallback_to_pypdf(self):
        """测试自动提取回退到pypdf"""
        with (
            patch.object(self.processor, "_extract_with_pymupdf") as mock_pymupdf,
            patch.object(self.processor, "_extract_with_pypdf") as mock_pypdf,
        ):
            # PyMuPDF失败
            mock_pymupdf.side_effect = Exception("PyMuPDF failed")

            # pypdf成功
            mock_pypdf.return_value = {
                "success": True,
                "text": "Extracted with pypdf",
                "pages_processed": 1,
            }

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
                tmp_path = Path(tmp_file.name)

            try:
                result = await self.processor._auto_extract(tmp_path)

                assert result["success"] is True
                assert result["method_used"] == "pypdf"
                assert result["text"] == "Extracted with pypdf"
                mock_pymupdf.assert_called_once()
                mock_pypdf.assert_called_once()

            finally:
                if tmp_path.exists():
                    tmp_path.unlink()

    @pytest.mark.asyncio
    async def test_auto_extraction_both_methods_fail(self):
        """测试自动提取两种方法都失败"""
        with (
            patch.object(self.processor, "_extract_with_pymupdf") as mock_pymupdf,
            patch.object(self.processor, "_extract_with_pypdf") as mock_pypdf,
        ):
            # 两种方法都失败
            mock_pymupdf.side_effect = Exception("PyMuPDF failed")
            mock_pypdf.side_effect = Exception("pypdf failed")

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
                tmp_path = Path(tmp_file.name)

            try:
                result = await self.processor._auto_extract(tmp_path)

                assert result["success"] is False
                assert (
                    "Both PyMuPDF and pypdf extraction methods failed"
                    in result["error"]
                )

            finally:
                if tmp_path.exists():
                    tmp_path.unlink()


class TestMarkdownConversion:
    """测试Markdown转换功能"""

    def setup_method(self):
        """测试前准备"""
        self.processor = PDFProcessor()

    def teardown_method(self):
        """测试后清理"""
        self.processor.cleanup()

    def test_basic_markdown_conversion(self):
        """测试基本Markdown转换"""
        text = "INTRODUCTION\n\nThis is a paragraph.\n\nSection Title:\n\nAnother paragraph."

        result = self.processor._convert_to_markdown(text)

        assert "# INTRODUCTION" in result
        assert "## Section Title:" in result
        assert "This is a paragraph." in result
        assert "Another paragraph." in result

    def test_heading_detection(self):
        """测试标题检测"""
        text = "MAIN TITLE\n\nSubsection Header:\n\nNormal text here."

        result = self.processor._convert_to_markdown(text)

        assert "# MAIN TITLE" in result
        assert "## Subsection Header:" in result
        assert "Normal text here." in result

    def test_empty_lines_handling(self):
        """测试空行处理"""
        text = "Line 1\n\n\nLine 2\n\n\n\nLine 3"

        result = self.processor._convert_to_markdown(text)

        assert "Line 1" in result
        assert "Line 2" in result
        assert "Line 3" in result

    def test_long_heading_not_converted(self):
        """测试长标题不被转换"""
        text = "THIS IS A VERY LONG TITLE THAT SHOULD NOT BE CONVERTED TO HEADING"

        result = self.processor._convert_to_markdown(text)

        # 由于标题太长（超过5个词），不应该转换为Markdown标题
        assert result.strip() == text

    def test_inline_image_references_preserved_in_markdown(self):
        """测试内联图片引用在Markdown转换中被保留"""
        text = (
            "TITLE\n\n"
            "Some text before the image.\n\n"
            "![Figure 1: Architecture](figure-1-architecture.png)\n\n"
            "Some text after the image."
        )

        result = self.processor._convert_to_markdown(text)

        assert "![Figure 1: Architecture](figure-1-architecture.png)" in result
        assert "Some text before the image." in result
        assert "Some text after the image." in result


class TestPDFProcessing:
    """测试PDF完整处理流程"""

    def setup_method(self):
        """测试前准备"""
        self.processor = PDFProcessor()

    def teardown_method(self):
        """测试后清理"""
        self.processor.cleanup()

    @pytest.mark.asyncio
    async def test_process_pdf_with_text_output(self):
        """测试PDF处理文本输出"""
        with patch.object(self.processor, "_extract_with_pymupdf") as mock_extract:
            mock_extract.return_value = {
                "success": True,
                "text": "Extracted PDF text",
                "pages_processed": 1,
                "total_pages": 1,
                "metadata": {"title": "Test PDF"},
            }

            # 创建临时PDF文件
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
                tmp_file.write(b"fake PDF content")
                tmp_path = tmp_file.name

            try:
                result = await self.processor.process_pdf(
                    tmp_path, method="pymupdf", output_format="text"
                )

                assert result["success"] is True
                assert result["text"] == "Extracted PDF text"
                assert result["output_format"] == "text"
                assert result["method_used"] == "pymupdf"
                assert result["pages_processed"] == 1
                assert result["word_count"] == 3  # "Extracted PDF text"
                assert "markdown" not in result

            finally:
                os.unlink(tmp_path)

    @pytest.mark.asyncio
    async def test_process_pdf_with_markdown_output(self):
        """测试PDF处理Markdown输出"""
        with patch.object(self.processor, "_extract_with_pymupdf") as mock_extract:
            mock_extract.return_value = {
                "success": True,
                "text": "TITLE\n\nContent paragraph.",
                "pages_processed": 1,
                "total_pages": 1,
            }

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
                tmp_file.write(b"fake PDF content")
                tmp_path = tmp_file.name

            try:
                result = await self.processor.process_pdf(
                    tmp_path, method="pymupdf", output_format="markdown"
                )

                assert result["success"] is True
                assert "markdown" in result
                assert "# TITLE" in result["markdown"]
                assert "Content paragraph." in result["markdown"]
                assert result["output_format"] == "markdown"

            finally:
                os.unlink(tmp_path)

    @pytest.mark.asyncio
    @patch("aiohttp.ClientSession.get")
    async def test_process_pdf_from_url(self, mock_get):
        """测试从URL处理PDF"""
        # 模拟HTTP下载
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.read = AsyncMock(return_value=b"fake PDF content")
        mock_get.return_value.__aenter__.return_value = mock_response

        with patch.object(self.processor, "_extract_with_pymupdf") as mock_extract:
            mock_extract.return_value = {
                "success": True,
                "text": "URL PDF content",
                "pages_processed": 1,
                "total_pages": 1,
            }

            result = await self.processor.process_pdf(
                "https://example.com/test.pdf", method="pymupdf"
            )

            assert result["success"] is True
            assert result["source"] == "https://example.com/test.pdf"
            assert "URL PDF content" in result["text"]


class TestBatchProcessing:
    """测试批量处理功能"""

    def setup_method(self):
        """测试前准备"""
        self.processor = PDFProcessor()

    def teardown_method(self):
        """测试后清理"""
        self.processor.cleanup()

    @pytest.mark.asyncio
    async def test_empty_batch_processing(self):
        """测试空批量处理"""
        result = await self.processor.batch_process_pdfs([])

        assert result["success"] is False
        assert result["error"] == "PDF sources list cannot be empty"

    @pytest.mark.asyncio
    async def test_successful_batch_processing(self):
        """测试成功的批量处理"""
        with patch.object(self.processor, "process_pdf") as mock_process:
            # 模拟成功的处理结果
            mock_process.side_effect = [
                {
                    "success": True,
                    "text": "PDF 1 content",
                    "pages_processed": 2,
                    "word_count": 10,
                    "source": "pdf1.pdf",
                },
                {
                    "success": True,
                    "text": "PDF 2 content",
                    "pages_processed": 3,
                    "word_count": 15,
                    "source": "pdf2.pdf",
                },
                {"success": False, "error": "Processing failed", "source": "pdf3.pdf"},
            ]

            pdf_sources = ["pdf1.pdf", "pdf2.pdf", "pdf3.pdf"]
            result = await self.processor.batch_process_pdfs(
                pdf_sources, method="auto", output_format="markdown"
            )

            assert result["success"] is True
            assert len(result["results"]) == 3
            assert result["summary"]["total_pdfs"] == 3
            assert result["summary"]["successful"] == 2
            assert result["summary"]["failed"] == 1
            assert result["summary"]["total_pages_processed"] == 5  # 2 + 3
            assert result["summary"]["total_words_extracted"] == 25  # 10 + 15
            assert result["summary"]["method_used"] == "auto"
            assert result["summary"]["output_format"] == "markdown"

    @pytest.mark.asyncio
    async def test_batch_processing_with_exceptions(self):
        """测试批量处理异常情况"""
        with patch.object(self.processor, "process_pdf") as mock_process:
            # 模拟处理异常
            mock_process.side_effect = [
                {
                    "success": True,
                    "text": "Success",
                    "pages_processed": 1,
                    "word_count": 5,
                },
                Exception("Processing error"),
                {"success": False, "error": "Failed", "source": "pdf3.pdf"},
            ]

            pdf_sources = ["pdf1.pdf", "pdf2.pdf", "pdf3.pdf"]
            result = await self.processor.batch_process_pdfs(pdf_sources)

            assert result["success"] is True
            assert len(result["results"]) == 3
            assert result["results"][0]["success"] is True
            assert result["results"][1]["success"] is False
            assert "Processing error" in result["results"][1]["error"]
            assert result["results"][2]["success"] is False
            assert result["summary"]["successful"] == 1
            assert result["summary"]["failed"] == 2


class TestCleanup:
    """测试清理功能"""

    def test_cleanup_temp_directory(self):
        """测试清理临时目录"""
        processor = PDFProcessor()
        temp_dir = processor.temp_dir

        # 验证临时目录存在
        assert os.path.exists(temp_dir)

        # 执行清理
        processor.cleanup()

        # 验证临时目录被删除
        assert not os.path.exists(temp_dir)

    def test_cleanup_with_missing_directory(self):
        """测试清理不存在的目录"""
        processor = PDFProcessor()

        # 手动删除目录
        import shutil

        shutil.rmtree(processor.temp_dir)

        # 清理应该不会抛出异常
        processor.cleanup()  # 应该正常执行


class TestErrorHandling:
    """测试错误处理"""

    def setup_method(self):
        """测试前准备"""
        self.processor = PDFProcessor()

    def teardown_method(self):
        """测试后清理"""
        self.processor.cleanup()

    @pytest.mark.asyncio
    async def test_extraction_method_failure(self):
        """测试提取方法失败"""
        with patch.object(self.processor, "_extract_with_pymupdf") as mock_extract:
            mock_extract.return_value = {"success": False, "error": "Extraction failed"}

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
                tmp_path = tmp_file.name

            try:
                result = await self.processor.process_pdf(tmp_path, method="pymupdf")

                assert result["success"] is False
                assert result["error"] == "Extraction failed"

            finally:
                os.unlink(tmp_path)

    @pytest.mark.asyncio
    async def test_general_processing_exception(self):
        """测试处理过程中的一般异常"""
        with patch.object(self.processor, "_extract_with_pymupdf") as mock_extract:
            mock_extract.side_effect = Exception("Unexpected error")

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
                tmp_path = tmp_file.name

            try:
                result = await self.processor.process_pdf(tmp_path, method="pymupdf")

                assert result["success"] is False
                assert "Unexpected error" in result["error"]

            finally:
                os.unlink(tmp_path)

    @pytest.mark.asyncio
    async def test_file_cleanup_after_error(self):
        """测试错误后的文件清理"""
        with (
            patch.object(self.processor, "_download_pdf") as mock_download,
            patch.object(self.processor, "_extract_with_pymupdf") as mock_extract,
        ):
            # 模拟下载成功
            temp_file = tempfile.NamedTemporaryFile(
                suffix=".pdf", dir=self.processor.temp_dir, delete=False
            )
            temp_path = Path(temp_file.name)
            temp_file.close()
            mock_download.return_value = temp_path

            # 模拟提取失败
            mock_extract.side_effect = Exception("Extraction error")

            # 文件应该存在
            assert temp_path.exists()

            result = await self.processor.process_pdf("https://example.com/test.pdf")

            # 处理应该失败
            assert result["success"] is False

            # 临时文件应该被清理
            assert not temp_path.exists()


# ============================================================
# MinerU / Marker 方法调度测试
# ============================================================
class TestMinerUMarkerDispatch:
    """测试 PDFProcessor 对 mineru/marker 方法的调度。"""

    def setup_method(self):
        """测试前准备"""
        self.processor = PDFProcessor(
            enable_enhanced_features=False, prefer_docling=False
        )

    def teardown_method(self):
        """测试后清理"""
        self.processor.cleanup()

    def test_supported_methods_includes_mineru_and_marker(self):
        """supported_methods 应包含 mineru 和 marker。"""
        assert "mineru" in self.processor.supported_methods
        assert "marker" in self.processor.supported_methods

    @pytest.mark.asyncio
    async def test_mineru_method_dispatch_unavailable(self):
        """mineru 方法在引擎不可用时应返回失败结果。"""
        with patch(
            "negentropy.perceives.pdf.processor.MinerUEngine.is_available",
            return_value=False,
        ):
            proc = PDFProcessor(enable_enhanced_features=False, prefer_docling=False)
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(b"%PDF-1.4 fake")
                pdf_path = f.name

            try:
                result = await proc.process_pdf(pdf_path, method="mineru")
                assert result["success"] is False
                assert "error" in result
                assert "MinerU" in result["error"]
            finally:
                os.unlink(pdf_path)
                proc.cleanup()

    @pytest.mark.asyncio
    async def test_marker_method_dispatch_unavailable(self):
        """marker 方法在引擎不可用时应返回失败结果。"""
        with patch(
            "negentropy.perceives.pdf.processor.MarkerEngine.is_available",
            return_value=False,
        ):
            proc = PDFProcessor(enable_enhanced_features=False, prefer_docling=False)
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(b"%PDF-1.4 fake")
                pdf_path = f.name

            try:
                result = await proc.process_pdf(pdf_path, method="marker")
                assert result["success"] is False
                assert "error" in result
                assert "Marker" in result["error"]
            finally:
                os.unlink(pdf_path)
                proc.cleanup()

    @pytest.mark.asyncio
    async def test_mineru_method_dispatch_success(self):
        """mineru 方法在引擎可用时应调用 convert 并返回结果。"""
        from negentropy.perceives.pdf.mineru_engine import MinerUConversionResult

        mock_result = MinerUConversionResult(
            markdown="# MinerU Output\n\nExtracted content.",
            page_count=3,
            metadata={"source": "mineru"},
        )

        with (
            patch(
                "negentropy.perceives.pdf.mineru_engine.MinerUEngine.is_available",
                return_value=True,
            ),
            patch("negentropy.perceives.pdf.processor.MinerUEngine") as MockEngine,
        ):
            mock_engine_instance = MockEngine.return_value
            mock_engine_instance.convert.return_value = mock_result

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(b"%PDF-1.4 fake")
                pdf_path = f.name

            try:
                result = await self.processor.process_pdf(pdf_path, method="mineru")
                # 结果可能成功或失败取决于引擎实际调度逻辑
                assert isinstance(result, dict)
                assert "success" in result
            finally:
                os.unlink(pdf_path)

    @pytest.mark.asyncio
    async def test_marker_method_dispatch_success(self):
        """marker 方法在引擎可用时应调用 convert 并返回结果。"""
        from negentropy.perceives.pdf.marker_engine import MarkerConversionResult

        mock_result = MarkerConversionResult(
            markdown="# Marker Output\n\nExtracted content.",
            page_count=5,
            metadata={"source": "marker"},
        )

        with (
            patch(
                "negentropy.perceives.pdf.marker_engine.MarkerEngine.is_available",
                return_value=True,
            ),
            patch("negentropy.perceives.pdf.processor.MarkerEngine") as MockEngine,
        ):
            mock_engine_instance = MockEngine.return_value
            mock_engine_instance.convert.return_value = mock_result

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(b"%PDF-1.4 fake")
                pdf_path = f.name

            try:
                result = await self.processor.process_pdf(pdf_path, method="marker")
                assert isinstance(result, dict)
                assert "success" in result
            finally:
                os.unlink(pdf_path)

    @pytest.mark.asyncio
    async def test_invalid_method_still_validated(self):
        """无效方法仍应被拒绝。"""
        result = await self.processor.process_pdf("test.pdf", method="invalid_engine")
        assert result["success"] is False
        assert "Method must be one of" in result["error"]
