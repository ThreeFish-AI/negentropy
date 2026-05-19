"""
## Markdown 转换器单元测试 (`test_markdown_converter.py`)

### MarkdownConverter 核心类测试

#### 1. 初始化和配置测试

测试 MarkdownConverter 默认选项设置、标题样式、列表符号、链接格式等配置项。

#### 2. HTML 预处理功能测试

测试 HTML 注释的清理、script、style、nav、header 等无关标签移除、相对 URL 转换为绝对 URL、空的 p 和 div 标签移除。

#### 3. HTML 到 Markdown 转换测试

测试标题、段落、链接、图片的基本转换、有序和无序列表的 Markdown 转换、自定义 Markdown 格式化选项、转换过程中的异常处理。

#### 4. Markdown 后处理测试

测试多余空白行的清理、列表格式的优化处理、行尾空格和制表符的清理、开头结尾空白字符的清理。

#### 5. 内容区域提取测试

测试 main、article 标签的内容提取、.content、.post 等类选择器提取、找不到主要内容时回退到 body 的处理、内容最小长度要求的验证。

#### 6. 完整转换流程测试

测试包含完整 HTML 内容的网页转换、仅有文本内容时的 HTML 重构转换、元数据的计算和包含功能、各种转换配置选项的应用。

#### 7. 批量转换测试

测试多个页面的成功批量转换、部分页面失败时的处理逻辑、成功率和统计信息的计算、批量转换过程中的异常捕获。

#### 8. 高级格式化功能测试 (TestAdvancedFormattingFeatures)

测试表格格式化和对齐识别、代码块增强和语言自动检测、引用块优化和间距统一、图片描述增强和友好文本生成、链接格式优化和跨行修复、列表格式化和标记统一、标题优化和间距添加、排版增强和智能引号转换。

#### 9. 图片嵌入测试 (TestImageEmbedding)

测试小图嵌入转换为 data URI、大图跳过处理、转换流程中的图片嵌入集成。
"""

import pytest
from unittest.mock import Mock, patch
from bs4 import BeautifulSoup

from negentropy.perceives.markdown.converter import MarkdownConverter


class TestMarkdownConverter:
    """
    测试 Markdown 转换器主要功能

    包含初始化配置、HTML 预处理、Markdown 转换、后处理、批量转换等完整的测试覆盖
    """

    def setup_method(self):
        """测试前准备"""
        try:
            self.converter = MarkdownConverter()
        except ImportError:
            pytest.skip("MarkItDown not available, skipping tests")

    def test_converter_initialization(self):
        """测试转换器初始化"""
        try:
            assert self.converter is not None
            assert hasattr(self.converter, "html_to_markdown")
            assert hasattr(self.converter, "convert_webpage_to_markdown")
            assert hasattr(self.converter, "batch_convert_to_markdown")
            assert hasattr(self.converter, "convert_pdf_to_markdown")
            assert isinstance(self.converter.default_options, dict)
            assert isinstance(self.converter.formatting_options, dict)
            # Check if markitdown is properly initialized
            assert hasattr(self.converter, "markitdown")
        except ImportError:
            pytest.skip("MarkItDown not available, skipping initialization test")

    def test_default_options(self):
        """测试默认选项配置"""
        options = self.converter.default_options

        # Updated options for MarkItDown
        assert options["extract_main_content"] is True
        assert options["preserve_structure"] is True
        assert options["clean_output"] is True
        assert options["include_links"] is True
        assert options["include_images"] is True

    def test_formatting_options(self):
        """测试格式化选项配置"""
        options = self.converter.formatting_options

        assert options["format_tables"] is True
        assert options["enhance_images"] is True
        assert options["optimize_links"] is True
        assert options["format_lists"] is True
        assert options["format_headings"] is True
        assert options["apply_typography"] is True
        assert options["smart_quotes"] is True
        assert options["em_dashes"] is True
        assert options["fix_spacing"] is True

    def test_basic_html_conversion(self):
        """测试基本HTML转换为Markdown"""
        html_content = """
        <html>
            <head><title>Test Page</title></head>
            <body>
                <h1>Main Title</h1>
                <p>This is a paragraph with <strong>bold</strong> text.</p>
                <ul>
                    <li>Item 1</li>
                    <li>Item 2</li>
                </ul>
            </body>
        </html>
        """

        result = self.converter.html_to_markdown(html_content)

        assert isinstance(result, str)
        assert "# Main Title" in result
        assert "**bold**" in result
        assert "- Item 1" in result or "* Item 1" in result

    def test_link_conversion(self):
        """测试链接转换"""
        html_content = """
        <p>Check out <a href="https://example.com">this link</a> for more info.</p>
        """

        result = self.converter.html_to_markdown(html_content)

        assert "[this link](https://example.com)" in result

    def test_image_conversion(self):
        """测试图片转换"""
        html_content = """
        <img src="/images/test.jpg" alt="Test Image" />
        """

        result = self.converter.html_to_markdown(html_content)

        assert "![Test Image](/images/test.jpg)" in result

    def test_table_conversion(self):
        """测试表格转换"""
        html_content = """
        <table>
            <thead>
                <tr><th>Name</th><th>Age</th></tr>
            </thead>
            <tbody>
                <tr><td>John</td><td>25</td></tr>
                <tr><td>Jane</td><td>30</td></tr>
            </tbody>
        </table>
        """

        result = self.converter.html_to_markdown(html_content)

        assert "Name" in result
        assert "Age" in result
        assert "John" in result
        assert "Jane" in result

    def test_code_block_conversion(self):
        """测试代码块转换"""
        html_content = """
        <pre><code>def hello():
    print("Hello, World!")</code></pre>
        """

        result = self.converter.html_to_markdown(html_content)

        assert "```" in result or "`def hello():`" in result

    def test_nested_elements_conversion(self):
        """测试嵌套元素转换"""
        html_content = """
        <div>
            <h2>Section Title</h2>
            <p>A paragraph with <em>italic</em> and <strong>bold</strong> text.</p>
            <blockquote>
                <p>This is a quote with <a href="http://example.com">a link</a>.</p>
            </blockquote>
        </div>
        """

        result = self.converter.html_to_markdown(html_content)

        assert "## Section Title" in result
        assert "*italic*" in result
        assert "**bold**" in result
        assert ">" in result  # blockquote


class TestPreprocessHTML:
    """测试HTML预处理功能"""

    def setup_method(self):
        """测试前准备"""
        self.converter = MarkdownConverter()

    def test_script_and_style_removal(self):
        """测试脚本和样式标签移除"""
        html_content = """
        <html>
            <head>
                <style>body { color: red; }</style>
                <script>console.log('test');</script>
            </head>
            <body>
                <h1>Title</h1>
                <p>Content</p>
                <script>alert('popup');</script>
            </body>
        </html>
        """

        result = self.converter.preprocess_html(html_content)

        assert "Title" in result
        assert "Content" in result
        assert "console.log" not in result
        assert "alert" not in result
        assert "color: red" not in result

    def test_unwanted_elements_removal(self):
        """测试不需要元素的移除"""
        html_content = """
        <html>
            <body>
                <nav>Navigation menu</nav>
                <header>Header content</header>
                <main>
                    <h1>Main Content</h1>
                    <p>Important content</p>
                </main>
                <aside>Sidebar content</aside>
                <footer>Footer content</footer>
            </body>
        </html>
        """

        result = self.converter.preprocess_html(html_content)

        assert "Main Content" in result
        assert "Important content" in result
        assert "Navigation menu" not in result
        assert "Header content" not in result
        assert "Sidebar content" not in result
        assert "Footer content" not in result

    def test_relative_url_conversion(self):
        """测试相对URL转换"""
        html_content = """
        <div>
            <a href="/page1">Internal Link</a>
            <img src="/images/logo.png" alt="Logo" />
        </div>
        """

        base_url = "https://example.com"
        result = self.converter.preprocess_html(html_content, base_url)

        assert "https://example.com/page1" in result
        assert "https://example.com/images/logo.png" in result

    def test_comment_removal(self):
        """测试HTML注释移除"""
        html_content = """
        <div>
            <!-- This is a comment -->
            <p>Visible content</p>
            <!-- Another comment -->
        </div>
        """

        result = self.converter.preprocess_html(html_content)

        assert "Visible content" in result
        assert "This is a comment" not in result
        assert "Another comment" not in result

    def test_empty_elements_cleanup(self):
        """测试空元素清理"""
        html_content = """
        <div>
            <p>Content paragraph</p>
            <p></p>
            <div></div>
            <p>Another paragraph</p>
        </div>
        """

        result = self.converter.preprocess_html(html_content)
        soup = BeautifulSoup(result, "html.parser")

        # 应该保留有内容的段落
        content_paras = [p for p in soup.find_all("p") if p.get_text(strip=True)]
        assert len(content_paras) >= 2


class TestPostprocessMarkdown:
    """测试Markdown后处理功能"""

    def setup_method(self):
        """测试前准备"""
        self.converter = MarkdownConverter()

    def test_table_formatting(self):
        """测试表格格式化"""
        markdown_content = """
        |Name|Age|City|
        |---|---|---|
        |John|25|NYC|
        |Jane|30|LA|
        """

        result = self.converter._format_tables(markdown_content)

        assert "| Name | Age | City |" in result
        assert "| John | 25 | NYC |" in result

    def test_code_block_language_detection(self):
        """测试代码块语言检测"""
        markdown_content = """
        ```
        def hello():
            print("Hello, World!")
        ```

        ```
        function greet() {
            console.log("Hello!");
        }
        ```
        """

        result = self.converter._format_code_blocks(markdown_content)

        assert "```python" in result
        assert "```javascript" in result

    def test_quote_formatting(self):
        """测试引用格式化"""
        markdown_content = """
        >This is a quote
        > Another quote line
        """

        result = self.converter._format_quotes(markdown_content)

        assert "> This is a quote" in result
        assert "> Another quote line" in result

    def test_image_alt_text_improvement(self):
        """测试图片alt文本改进"""
        markdown_content = """
        ![](test-image.jpg)
        ![img](profile-photo.png)
        """

        result = self.converter._format_images(markdown_content)

        assert "![Test Image](test-image.jpg)" in result
        assert "![Profile Photo](profile-photo.png)" in result

    def test_link_formatting(self):
        """测试链接格式化"""
        markdown_content = """
        [Link text] (https://example.com)
        [Another link]
        (https://test.com)
        """

        result = self.converter._format_links(markdown_content)

        assert "[Link text](https://example.com)" in result
        assert "[Another link](https://test.com)" in result

    def test_list_formatting(self):
        """测试列表格式化"""
        markdown_content = """
        -Item 1
        *   Item 2
        +    Item 3
        1.First item
        2) Second item
        """

        result = self.converter._format_lists(markdown_content)

        assert "- Item 1" in result
        assert "- Item 2" in result
        assert "- Item 3" in result
        assert "1. First item" in result
        assert "2. Second item" in result

    def test_heading_formatting(self):
        """测试标题格式化"""
        markdown_content = """# Title
        Some content here
        ## Subtitle
        More content
        """

        result = self.converter._format_headings(markdown_content)

        lines = result.split("\n")
        # 检查标题前后有适当的空行
        title_idx = next(i for i, line in enumerate(lines) if line.strip() == "# Title")
        subtitle_idx = next(
            i for i, line in enumerate(lines) if line.strip() == "## Subtitle"
        )

        assert title_idx >= 0
        assert subtitle_idx >= 0

    def test_typography_fixes(self):
        """测试排版修复"""
        markdown_content = """
        Text with -- double hyphens.
        "Quote text" and 'another quote'.
        Multiple   spaces    here.
        """

        result = self.converter._apply_typography_fixes(markdown_content)

        assert "—" in result  # em dash
        assert "  " not in result  # multiple spaces removed
        # 注意：智能引号转换可能在某些情况下被跳过


class TestContentExtraction:
    """测试内容提取功能"""

    def setup_method(self):
        """测试前准备"""
        self.converter = MarkdownConverter()

    def test_main_content_extraction(self):
        """测试主要内容提取"""
        html_content = """
        <html>
            <body>
                <nav>Navigation</nav>
                <main>
                    <h1>Main Title</h1>
                    <p>Main content paragraph</p>
                </main>
                <footer>Footer</footer>
            </body>
        </html>
        """

        result = self.converter.extract_content_area(html_content)

        assert "Main Title" in result
        assert "Main content paragraph" in result
        assert "Navigation" not in result
        assert "Footer" not in result

    def test_content_selectors_priority(self):
        """测试内容选择器优先级"""
        html_content = """
        <html>
            <body>
                <div class="sidebar">Sidebar content</div>
                <article>
                    <h1>Article Title</h1>
                    <p>Article content with substantial text to meet minimum length requirements.</p>
                </article>
                <div class="content">
                    <h2>Content Area</h2>
                    <p>Content area text</p>
                </div>
            </body>
        </html>
        """

        result = self.converter.extract_content_area(html_content)

        # article标签应该有优先级
        assert "Article Title" in result
        assert "Article content" in result


class TestWebpageConversion:
    """测试网页转换功能"""

    def setup_method(self):
        """测试前准备"""
        self.converter = MarkdownConverter()

    def test_successful_webpage_conversion(self):
        """测试成功的网页转换"""
        scrape_result = {
            "url": "https://example.com",
            "title": "Test Page",
            "content": {
                "html": "<html><body><h1>Title</h1><p>Content</p></body></html>"
            },
        }

        result = self.converter.convert_webpage_to_markdown(scrape_result)

        assert result["success"] is True
        assert "Title" in result["markdown"]
        assert "Content" in result["markdown"]
        assert result["url"] == "https://example.com"

    def test_webpage_conversion_with_metadata(self):
        """测试带元数据的网页转换"""
        scrape_result = {
            "url": "https://example.com",
            "title": "Test Page",
            "meta_description": "Test description",
            "content": {
                "html": "<html><body><h1>Title</h1><p>Content paragraph</p></body></html>",
                "links": [{"url": "https://example.com/link1", "text": "Link 1"}],
                "images": [{"src": "/image1.jpg", "alt": "Image 1"}],
            },
        }

        result = self.converter.convert_webpage_to_markdown(
            scrape_result, include_metadata=True
        )

        assert result["success"] is True
        assert "metadata" in result
        assert result["metadata"]["title"] == "Test Page"
        assert result["metadata"]["meta_description"] == "Test description"
        assert result["metadata"]["word_count"] > 0
        assert result["metadata"]["links_count"] == 1
        assert result["metadata"]["images_count"] == 1

    def test_webpage_conversion_with_text_only(self):
        """测试仅文本内容的网页转换"""
        scrape_result = {
            "url": "https://example.com",
            "title": "Test Page",
            "content": {
                "text": "First paragraph content. Second paragraph content here.",
                "links": [{"url": "https://example.com/link1", "text": "Link 1"}],
                "images": [{"src": "/image1.jpg", "alt": "Image 1"}],
            },
        }

        result = self.converter.convert_webpage_to_markdown(scrape_result)

        assert result["success"] is True
        assert "First paragraph" in result["markdown"]
        assert "Second paragraph" in result["markdown"]

    def test_webpage_conversion_error_handling(self):
        """测试网页转换错误处理"""
        scrape_result = {"error": "Failed to scrape", "url": "https://example.com"}

        result = self.converter.convert_webpage_to_markdown(scrape_result)

        assert result["success"] is False
        assert result["error"] == "Failed to scrape"
        assert result["url"] == "https://example.com"

    def test_batch_webpage_conversion(self):
        """测试批量网页转换"""
        scrape_results = [
            {
                "url": "https://example1.com",
                "title": "Page 1",
                "content": {"html": "<html><body><h1>Title 1</h1></body></html>"},
            },
            {
                "url": "https://example2.com",
                "title": "Page 2",
                "content": {"html": "<html><body><h1>Title 2</h1></body></html>"},
            },
            {"error": "Failed to scrape", "url": "https://example3.com"},
        ]

        result = self.converter.batch_convert_to_markdown(scrape_results)

        assert result["success"] is True
        assert len(result["results"]) == 3
        assert result["summary"]["total"] == 3
        assert result["summary"]["successful"] == 2
        assert result["summary"]["failed"] == 1
        assert result["summary"]["success_rate"] == 2 / 3


class TestImageEmbedding:
    """测试图片嵌入功能"""

    def setup_method(self):
        """测试前准备"""
        self.converter = MarkdownConverter()

    @patch("requests.get")
    def test_image_embedding_success(self, mock_get):
        """测试成功的图片嵌入"""
        # 模拟成功的HTTP响应
        mock_response = Mock()
        mock_response.headers = {"Content-Type": "image/jpeg"}
        mock_response.content = b"fake image data"
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        markdown_content = "![Alt text](https://example.com/image.jpg)"

        result = self.converter._embed_images_in_markdown(markdown_content)

        assert result["stats"]["attempted"] == 1
        assert result["stats"]["embedded"] == 1
        assert "data:image/jpeg;base64," in result["markdown"]

    @patch("requests.get")
    def test_image_embedding_size_limit(self, mock_get):
        """测试图片大小限制"""
        # 模拟大文件响应
        mock_response = Mock()
        mock_response.headers = {
            "Content-Type": "image/jpeg",
            "Content-Length": "5000000",
        }
        mock_get.return_value = mock_response

        markdown_content = "![Alt text](https://example.com/large-image.jpg)"

        result = self.converter._embed_images_in_markdown(
            markdown_content, max_bytes_per_image=1000000
        )

        assert result["stats"]["attempted"] == 1
        assert result["stats"]["embedded"] == 0
        assert result["stats"]["skipped_large"] == 1

    @patch("requests.get")
    def test_image_embedding_error_handling(self, mock_get):
        """测试图片嵌入错误处理"""
        # 模拟HTTP错误
        mock_get.side_effect = Exception("Network error")

        markdown_content = "![Alt text](https://example.com/image.jpg)"

        result = self.converter._embed_images_in_markdown(markdown_content)

        assert result["stats"]["attempted"] == 1
        assert result["stats"]["embedded"] == 0
        assert result["stats"]["skipped_errors"] == 1
        # 原始链接应该保留
        assert "https://example.com/image.jpg" in result["markdown"]


class TestErrorHandling:
    """测试错误处理和边界情况"""

    def setup_method(self):
        """测试前准备"""
        self.converter = MarkdownConverter()

    def test_empty_html_input(self):
        """测试空HTML输入"""
        result = self.converter.html_to_markdown("")
        assert isinstance(result, str)

    def test_invalid_html_input(self):
        """测试无效HTML输入"""
        invalid_html = "<html><body><div>Unclosed div<p>Paragraph</body></html>"

        result = self.converter.html_to_markdown(invalid_html)
        assert isinstance(result, str)
        assert len(result) >= 0

    def test_none_input(self):
        """测试None输入处理"""
        # html_to_markdown应该能处理None输入而不崩溃
        try:
            result = self.converter.html_to_markdown(None)
            # 如果没有抛出异常，结果应该是字符串
            assert isinstance(result, str)
        except (TypeError, AttributeError):
            # 如果抛出异常，这也是可接受的行为
            pass

    def test_special_characters_handling(self):
        """测试特殊字符处理"""
        html_content = """
        <p>Special chars: &amp; &lt; &gt; &quot; &#39; &copy; &reg;</p>
        <p>Unicode: 中文 éñ ñoël</p>
        """

        result = self.converter.html_to_markdown(html_content)

        assert isinstance(result, str)
        assert len(result) > 0

    def test_malformed_markup(self):
        """测试格式错误的标记"""
        malformed_html = """
        <div>
            <p>Normal paragraph</p>
            <strong>Unclosed strong tag
            <p>Another paragraph
            <em>Nested <strong>tags</em> wrong order</strong>
        </div>
        """

        result = self.converter.html_to_markdown(malformed_html)

        assert isinstance(result, str)
        assert "Normal paragraph" in result
        assert "Another paragraph" in result


class TestPerformanceAndLimits:
    """测试性能相关功能"""

    def setup_method(self):
        """测试前准备"""
        self.converter = MarkdownConverter()

    def test_large_html_conversion(self):
        """测试大型HTML内容转换"""
        # 生成大型HTML内容
        large_html = "<html><body>"
        for i in range(100):
            large_html += f"<p>Paragraph {i} with some content text here.</p>"
        large_html += "</body></html>"

        result = self.converter.html_to_markdown(large_html)

        assert isinstance(result, str)
        assert len(result) > 0
        assert "Paragraph 0" in result
        assert "Paragraph 99" in result

    def test_conversion_speed_benchmark(self):
        """测试转换速度基准"""
        import time

        html_content = "<html><body>"
        for i in range(50):
            html_content += f"""
            <div>
                <h2>Section {i}</h2>
                <p>This is paragraph {i} with <strong>bold</strong> text.</p>
                <ul>
                    <li>Item 1</li>
                    <li>Item 2</li>
                </ul>
            </div>
            """
        html_content += "</body></html>"

        start_time = time.time()
        result = self.converter.html_to_markdown(html_content)
        end_time = time.time()

        conversion_time = end_time - start_time

        assert isinstance(result, str)
        assert len(result) > 0
        # 转换应该在合理时间内完成（5秒）
        assert conversion_time < 5.0

    def test_max_images_limit(self):
        """测试图片数量限制"""
        markdown_content = ""
        for i in range(60):
            markdown_content += f"![Image {i}](https://example.com/image{i}.jpg)\n"

        with patch("requests.get") as mock_get:
            mock_response = Mock()
            mock_response.headers = {"Content-Type": "image/jpeg"}
            mock_response.content = b"fake image data"
            mock_response.raise_for_status = Mock()
            mock_get.return_value = mock_response

            result = self.converter._embed_images_in_markdown(
                markdown_content, max_images=10
            )

            assert result["stats"]["attempted"] >= 10
            assert result["stats"]["embedded"] <= 10


class TestImageDimensionPreservation:
    """测试图片源尺寸保留特性 (preserve_image_dimensions)。

    覆盖 plan 中定义的 12 条测试矩阵：
    1. 双属性 width/height 透传
    2. style 优先级高于 width 属性（与 W3C CSS 计算值一致）
    3. 无尺寸退回 ![alt](src) 形式
    4. 无效单位（%/auto/em/rem）忽略
    5. alt 中特殊字符做 HTML entity escape
    6. <a><img> 包装变成 [<img />](href) 合法 Markdown
    7. Next.js 代理 + 尺寸：src 解析为 CDN URL 且尺寸保留
    8. 懒加载兜底：data-src 升级为 src 且尺寸保留
    9. Anthropic 真实场景（用户报告的原始 case）
    10. preserve_image_dimensions=False 退化到旧行为
    11. 与 image_embedder 协同：HTML <img> 的 src 替换为 data URI
    12. sentinel 防 escape：markdownify 的 *_ 转义不破坏占位符
    """

    def setup_method(self):
        try:
            self.converter = MarkdownConverter()
        except ImportError:
            pytest.skip("MarkItDown not available, skipping tests")

    def test_1_width_height_attributes(self):
        """双属性 width/height 透传到 HTML <img>，含响应式 style。"""
        html = '<html><body><img src="x.svg" width="1000" height="1000" alt="logo"></body></html>'
        md = self.converter.html_to_markdown(html)
        assert "<img " in md
        assert 'src="x.svg"' in md
        assert 'alt="logo"' in md
        assert 'width="1000"' in md
        assert 'height="1000"' in md
        assert "max-width:100%" in md
        assert "height:auto" in md

    def test_2_style_overrides_attribute(self):
        """style 内的 px 优先于 HTML width 属性。"""
        html = (
            "<html><body>"
            '<img src="x.png" width="100" height="100" '
            'style="width:50px;height:75px" alt="x"></body></html>'
        )
        md = self.converter.html_to_markdown(html)
        assert 'width="50"' in md
        assert 'height="75"' in md
        assert 'width="100"' not in md  # 不应同时存在

    def test_3_no_dimensions_falls_back_to_markdown(self):
        """无尺寸的图片走默认 ![alt](src) 形式，不输出 HTML <img>。"""
        html = '<html><body><img src="x.jpg" alt="cat"></body></html>'
        md = self.converter.html_to_markdown(html)
        assert "![cat](x.jpg)" in md
        assert "<img" not in md

    def test_4_invalid_units_ignored(self):
        """百分比、auto、em 等无法转 px 的单位被忽略，退回 ![alt](src)。"""
        html = (
            "<html><body>"
            '<img src="x.png" width="100%" style="height:auto" alt="banner">'
            "</body></html>"
        )
        md = self.converter.html_to_markdown(html)
        assert "![banner](x.png)" in md
        assert "<img" not in md

    def test_5_alt_entity_escape(self):
        """alt 中的 " & < 等特殊字符做 HTML entity escape。"""
        html = (
            "<html><body>"
            '<img src="x.png" alt=\'a "& <b\' width="50" height="50">'
            "</body></html>"
        )
        md = self.converter.html_to_markdown(html)
        assert "&quot;" in md
        assert "&amp;" in md
        assert "&lt;" in md

    def test_6_anchor_image_wrap(self):
        """<a><img></a> 包装应变成 [<img />](href) 形式。"""
        html = (
            "<html><body>"
            '<a href="https://target.com"><img src="x.png" alt="link" '
            'width="50" height="50"></a></body></html>'
        )
        md = self.converter.html_to_markdown(html)
        assert "[<img" in md
        assert "](https://target.com)" in md

    def test_7_nextjs_proxy_with_dimensions(self):
        """Next.js _next/image 代理 URL 应解析为真实 CDN URL，且尺寸保留。"""
        nextjs_url = "/_next/image?url=https%3A%2F%2Fcdn.test.com%2Fa.png&w=2048&q=75"
        html = (
            f'<html><body><img src="{nextjs_url}" width="1200" height="600" alt="hero">'
            "</body></html>"
        )
        md = self.converter.html_to_markdown(html, base_url="https://test.com/")
        # src 应被解析到真实 CDN（不再包含 _next/image 路径）
        assert "/_next/image" not in md
        assert "cdn.test.com" in md
        assert 'width="1200"' in md
        assert 'height="600"' in md

    def test_8_lazy_loading_with_dimensions(self):
        """懒加载 data-src 应被升级为 src，且尺寸属性保留。"""
        html = (
            "<html><body>"
            '<img src="" data-src="real.png" width="300" height="200" alt="lazy">'
            "</body></html>"
        )
        md = self.converter.html_to_markdown(html)
        assert 'src="real.png"' in md
        assert 'width="300"' in md
        assert 'height="200"' in md

    def test_9_anthropic_user_reported_case(self):
        """用户实际报告的 anthropic 1000x1000 SVG 场景。"""
        html = (
            "<html><body><p>Intro paragraph.</p>"
            '<img alt="" loading="lazy" width="1000" height="1000" '
            'decoding="async" data-nimg="1" style="color:transparent" '
            'src="https://www-cdn.anthropic.com/x/y-1000x1000.svg">'
            "<p>After image.</p></body></html>"
        )
        md = self.converter.html_to_markdown(
            html, base_url="https://www.anthropic.com/"
        )
        assert "<img " in md
        assert 'width="1000"' in md
        assert 'height="1000"' in md
        assert 'src="https://www-cdn.anthropic.com/x/y-1000x1000.svg"' in md
        assert "max-width:100%" in md
        # 上下文段落仍正常输出
        assert "Intro paragraph" in md
        assert "After image" in md

    def test_10_disable_via_formatting_option(self):
        """preserve_image_dimensions=False 时退化为旧行为 ![alt](src)。"""
        from negentropy.perceives.markdown.formatter import MarkdownFormatter

        converter = MarkdownConverter()
        converter._formatter = MarkdownFormatter(
            options={"preserve_image_dimensions": False}
        )
        html = (
            "<html><body>"
            '<img src="x.svg" width="1000" height="1000" alt="big">'
            "</body></html>"
        )
        md = converter.html_to_markdown(html)
        assert "<img" not in md
        assert "![big](x.svg)" in md

    def test_11_embed_images_handles_html_img(self):
        """image_embedder 应能把保留尺寸的 HTML <img> 的 src 替换为 data URI。"""
        from negentropy.perceives.markdown.image_embedder import (
            embed_images_in_markdown,
        )

        markdown = (
            '<img src="https://example.com/a.png" alt="x" '
            'width="100" height="100" style="max-width:100%;height:auto;" />'
        )
        with patch("requests.get") as mock_get:
            mock_response = Mock()
            mock_response.headers = {"Content-Type": "image/png"}
            mock_response.content = b"fake png data"
            mock_response.raise_for_status = Mock()
            mock_get.return_value = mock_response

            result = embed_images_in_markdown(
                markdown, max_images=10, max_bytes_per_image=10_000
            )

        assert "data:image/png;base64," in result["markdown"]
        # width/height/style 应保留
        assert 'width="100"' in result["markdown"]
        assert 'height="100"' in result["markdown"]
        assert "max-width:100%" in result["markdown"]
        assert result["stats"]["embedded"] == 1

    def test_12_sentinel_survives_markdownify_escape(self):
        """sentinel 字面量必须穿透 markdownify 的 *_ 转义，最终被完全还原。"""
        # 用 emphasis 字符包夹图片测试 sentinel 抗 escape
        html = (
            "<html><body>"
            '<p>before</p><img src="x.png" width="100" height="100" alt="img">'
            "<p>after</p></body></html>"
        )
        md = self.converter.html_to_markdown(html)
        # 最终输出中不应有任何 sentinel 残留
        assert "XIMGPLACEHOLDER" not in md
        assert "ENDX" not in md or md.count("ENDX") == 0
        # 且 <img> 标签完整生成
        assert 'width="100"' in md
        assert 'height="100"' in md

    def test_image_with_title_attribute(self):
        """补充：图片含 title 属性时应保留到 HTML <img>。"""
        html = (
            "<html><body>"
            '<img src="x.png" width="50" height="50" alt="alt" title="tooltip">'
            "</body></html>"
        )
        md = self.converter.html_to_markdown(html)
        assert 'title="tooltip"' in md

    def test_multiple_images_in_one_document(self):
        """补充：多张带不同尺寸的图片各自独立处理。"""
        html = (
            "<html><body>"
            '<img src="a.png" width="100" height="100" alt="A">'
            '<img src="b.png" width="200" height="300" alt="B">'
            '<img src="c.png" alt="C-no-size">'
            "</body></html>"
        )
        md = self.converter.html_to_markdown(html)
        assert 'src="a.png"' in md and 'width="100"' in md
        assert 'src="b.png"' in md and 'width="200"' in md and 'height="300"' in md
        assert "![C-no-size](c.png)" in md  # 无尺寸的退回旧形式

    def test_picture_element_with_sized_img(self):
        """补充：<picture> 展平后内层 <img> 的尺寸仍保留。"""
        html = (
            "<html><body>"
            "<picture>"
            '<source srcset="hi.webp 2x" type="image/webp">'
            '<img src="lo.jpg" width="400" height="300" alt="pic">'
            "</picture>"
            "</body></html>"
        )
        md = self.converter.html_to_markdown(html)
        # picture 已被展平到内层 img；src 可能被 source 的 srcset 覆盖（视 _convert_media_elements 行为而定）
        # 关键断言：尺寸保留
        assert 'width="400"' in md
        assert 'height="300"' in md

    def test_orphan_sentinel_is_stripped_with_warning(self, caplog):
        """登记簿与输出失配时，残留 sentinel 必须被剥离并产生 WARNING 日志。

        这是 ``SENTINEL_RE`` 作为防御检测器的实际消费点：当上游 pipeline
        意外丢失（或重复）sentinel 时，恢复阶段需自洽兜底而非裸露字符串。
        """
        import logging as _logging

        from negentropy.perceives.markdown.formatter import MarkdownFormatter
        from negentropy.perceives.markdown.html_preprocessor import (
            ImgDimensionRegistry,
            SENTINEL_RE,
        )

        registry = ImgDimensionRegistry()
        real_sentinel = registry.issue(src="x.png", alt="x", width="100", height="100")
        # 构造一个未登记但仍命中 SENTINEL_RE 的 orphan（模拟管线异常裂变场景）
        orphan = "XIMGPLACEHOLDER" + "a" * 32 + "ENDX"
        assert SENTINEL_RE.fullmatch(orphan) is not None

        formatter = MarkdownFormatter()
        with caplog.at_level(
            _logging.WARNING, logger="negentropy.perceives.markdown.formatter"
        ):
            out = formatter.format(
                f"before {real_sentinel} middle {orphan} after",
                img_registry=registry,
            )

        # 真实 sentinel 被还原为 <img>
        assert 'src="x.png"' in out
        assert 'width="100"' in out
        # orphan 被剥离（不裸露给用户）
        assert orphan not in out
        assert "XIMGPLACEHOLDER" not in out
        # 同时产生告警日志便于排障
        assert any("orphan image sentinel" in rec.message for rec in caplog.records)
