"""Integration test for image dimension preservation in HTML → Markdown pipeline.

覆盖完整 ``html_to_markdown`` 流程：preprocess_html 注入 sentinel →
MarkItDown 转换 → MarkdownFormatter 恢复为内嵌 HTML ``<img>``。

聚焦用户报告的 anthropic SVG 真实场景（width=1000 height=1000 被"放到最大"），
以及与 image_embedder 协同的端到端组合行为。

不依赖网络（HTML 串内嵌；image_embedder 协同测试用 mock）。
"""

import re
from unittest.mock import Mock, patch

import pytest

from negentropy.perceives.markdown.converter import MarkdownConverter
from negentropy.perceives.markdown.formatter import MarkdownFormatter
from negentropy.perceives.markdown.image_embedder import embed_images_in_markdown


ANTHROPIC_HTML = """<html>
<head><title>Effective Harnesses</title></head>
<body>
<article>
<h1>Effective Harnesses for Long-Running Agents</h1>
<p>This is the lead paragraph describing the post.</p>
<figure>
<img alt="" loading="lazy" width="1000" height="1000" decoding="async" data-nimg="1" style="color:transparent" src="https://www-cdn.anthropic.com/images/4zrzovbb/website/5dfb835ad3cbbf76b85824e969146eac20329e72-1000x1000.svg">
<figcaption>Figure 1: Agent harness overview.</figcaption>
</figure>
<p>Following paragraph discussing the figure.</p>
</article>
</body>
</html>"""


class TestImageDimensionsE2E:
    """完整管线的端到端验证。"""

    def setup_method(self):
        try:
            self.converter = MarkdownConverter()
        except ImportError:
            pytest.skip("MarkItDown not available")

    def test_anthropic_real_world_case(self):
        """用户报告的真实场景：anthropic 1000x1000 SVG 被"放到最大"。"""
        md = self.converter.html_to_markdown(
            ANTHROPIC_HTML, base_url="https://www.anthropic.com/"
        )

        # 关键断言：图片标签使用内嵌 HTML 并保留尺寸
        assert "<img " in md
        assert (
            'src="https://www-cdn.anthropic.com/images/4zrzovbb/website/5dfb835ad3cbbf76b85824e969146eac20329e72-1000x1000.svg"'
            in md
        )
        assert 'width="1000"' in md
        assert 'height="1000"' in md
        assert "max-width:100%" in md
        assert "height:auto" in md

        # 上下文段落与图注仍正常输出
        assert "Effective Harnesses for Long-Running Agents" in md
        assert "lead paragraph" in md
        assert "Following paragraph" in md
        assert "Figure 1" in md

        # 不应残留任何 sentinel
        assert "XIMGPLACEHOLDER" not in md
        assert "ENDX" not in md or md.count("ENDX") == 0

    def test_disable_preserves_legacy_behavior(self):
        """开关关闭后退化为旧行为：所有图片走 ![alt](src)。"""
        converter = MarkdownConverter()
        converter._formatter = MarkdownFormatter(
            options={"preserve_image_dimensions": False}
        )
        md = converter.html_to_markdown(
            ANTHROPIC_HTML, base_url="https://www.anthropic.com/"
        )

        # 没有内嵌 HTML <img>
        assert "<img" not in md
        # 标准 Markdown 图片语法存在
        assert re.search(r"!\[.*?\]\(https://www-cdn\.anthropic\.com/", md)

    def test_combined_with_image_embedding(self):
        """preserve_image_dimensions=True + embed_images=True：两特性正交可组合。"""
        md = self.converter.html_to_markdown(
            ANTHROPIC_HTML, base_url="https://www.anthropic.com/"
        )

        # 模拟下载 anthropic SVG
        with patch("requests.get") as mock_get:
            mock_response = Mock()
            mock_response.headers = {"Content-Type": "image/svg+xml"}
            mock_response.content = b'<svg xmlns="http://www.w3.org/2000/svg"></svg>'
            mock_response.raise_for_status = Mock()
            mock_get.return_value = mock_response

            embedded = embed_images_in_markdown(
                md, max_images=10, max_bytes_per_image=50_000
            )

        embedded_md = embedded["markdown"]
        # src 被替换为 data URI
        assert "data:image/svg+xml;base64," in embedded_md
        # 但 width/height/style 保留
        assert 'width="1000"' in embedded_md
        assert 'height="1000"' in embedded_md
        assert "max-width:100%" in embedded_md
        # 统计正确
        assert embedded["stats"]["embedded"] == 1

    def test_multiple_mixed_images(self):
        """混合场景：带尺寸/无尺寸/懒加载图片同时存在，各自走对应路径。"""
        html = """<html><body>
<img src="a.png" width="300" height="200" alt="sized">
<img src="b.jpg" alt="no-size">
<img src="" data-src="c.webp" width="500" height="500" alt="lazy">
</body></html>"""
        md = self.converter.html_to_markdown(html)

        # sized 图片：内嵌 HTML
        assert 'src="a.png"' in md
        assert 'width="300"' in md
        assert 'height="200"' in md
        # no-size 图片：标准 Markdown
        assert "![no-size](b.jpg)" in md
        # lazy 图片：被升级为 src，保留尺寸
        assert 'src="c.webp"' in md
        assert 'width="500"' in md
