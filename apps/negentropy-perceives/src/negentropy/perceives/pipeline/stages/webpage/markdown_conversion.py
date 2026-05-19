"""S10: Markdown 转换 — 将清洗后的 HTML 转换为 Markdown（竞争模式）。

两个工具互为竞争：
1. ``markitdown`` — 使用现有 ``MarkdownConverter.html_to_markdown()``
2. ``html2text`` — 调用 ``html2text.HTML2Text()``（可选依赖）

从 ``ctx.cleaned_html`` 转换为 Markdown，设置 ``ctx.markdown``。
"""

from __future__ import annotations

import logging
from typing import Dict

from ...base import StageResult
from ...models import StageContext
from ...registry import register_tool
from .._base import WebToolBase
from .._helpers import get_best_html

logger = logging.getLogger(__name__)


@register_tool("markitdown")
class MarkItDownTool(WebToolBase):
    """基于 MarkItDown 的 Markdown 转换工具。

    委托给现有 ``markdown.converter.MarkdownConverter.html_to_markdown()``。
    """

    tool_name = "markitdown"

    def is_available(self) -> bool:
        try:
            from markitdown import MarkItDown  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """使用 MarkItDown 将 HTML 转换为 Markdown。"""
        from ....markdown.converter import MarkdownConverter

        input_html = get_best_html(ctx)
        if not input_html:
            return StageResult(
                success=False,
                error="无可用 HTML 内容进行 Markdown 转换",
                engine_used=self.tool_name,
            )

        try:
            converter = MarkdownConverter()
            markdown = converter.html_to_markdown(input_html, base_url=ctx.url)

            if not markdown or len(markdown.strip()) < 10:
                return StageResult(
                    success=False,
                    error="MarkItDown 转换结果为空",
                    engine_used=self.tool_name,
                )

            ctx.markdown = markdown

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={
                    "input_length": len(input_html),
                    "output_length": len(markdown),
                },
            )
        except Exception as e:
            logger.warning("MarkItDown 转换失败: %s", e)
            return StageResult(
                success=False,
                error=f"MarkItDown 转换失败: {e}",
                engine_used=self.tool_name,
            )


@register_tool("html2text")
class Html2TextTool(WebToolBase):
    """基于 html2text 的 Markdown 转换工具。

    html2text 是一个将 HTML 转换为 Markdown 的轻量级库，
    对简单页面有良好的输出质量。
    """

    tool_name = "html2text"

    def is_available(self) -> bool:
        try:
            import html2text  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """使用 html2text 将 HTML 转换为 Markdown。"""
        try:
            import html2text
        except ImportError:
            return StageResult(
                success=False,
                error="html2text 未安装",
                engine_used=self.tool_name,
            )

        input_html = get_best_html(ctx)
        if not input_html:
            return StageResult(
                success=False,
                error="无可用 HTML 内容进行 Markdown 转换",
                engine_used=self.tool_name,
            )

        try:
            h = html2text.HTML2Text()
            h.body_width = 0  # 不自动折行
            h.unicode_snob = True  # 使用 Unicode 字符
            h.images_to_alt = False  # 保留图片标记
            h.wrap_links = False  # 不折行链接
            h.skip_internal_links = False
            if ctx.url:
                h.baseurl = ctx.url

            markdown = h.handle(input_html)

            if not markdown or len(markdown.strip()) < 10:
                return StageResult(
                    success=False,
                    error="html2text 转换结果为空",
                    engine_used=self.tool_name,
                )

            ctx.markdown = markdown

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={
                    "input_length": len(input_html),
                    "output_length": len(markdown),
                },
            )
        except Exception as e:
            logger.warning("html2text 转换失败: %s", e)
            return StageResult(
                success=False,
                error=f"html2text 转换失败: {e}",
                engine_used=self.tool_name,
            )


# Stage 本地工具映射
TOOLS: Dict[str, type] = {
    "markitdown": MarkItDownTool,
    "html2text": Html2TextTool,
}

STAGE_ID = "markdown_conversion"
STAGE_NAME = "Markdown 转换"
