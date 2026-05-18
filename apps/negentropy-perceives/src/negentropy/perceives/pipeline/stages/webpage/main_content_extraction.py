"""S4: 主内容区域识别 — 从完整 HTML 中提取文章正文区域（竞争模式）。

三个工具互为竞争：
1. ``trafilatura`` — 调用 ``trafilatura.extract()``（可选依赖）
2. ``readability`` — 调用 ``readability.Document().summary()``（可选依赖）
3. ``beautifulsoup_heuristic`` — 使用现有 ``html_preprocessor.extract_content_area()``

从 ``ctx.raw_html`` 中提取主内容区域，设置 ``ctx.metadata["main_content_html"]``。
"""

from __future__ import annotations

import logging
import re
from typing import Dict

from ...base import StageResult
from ...models import StageContext
from ...registry import register_tool
from .._base import WebToolBase

logger = logging.getLogger(__name__)


_IMG_TAG_RE = re.compile(r"<img\b", re.IGNORECASE)

# 触发“图片丢失”兜底的阈值：原始 HTML 至少有这么多 <img>，
# 但主内容区的 <img> 为 0 时，视为 trafilatura 提取失败。
_MIN_RAW_IMAGES_FOR_LOSS_GUARD = 3


def _rehydrate_trafilatura_graphics(html: str) -> str:
    """将 trafilatura 输出的 ``<graphic>`` (TEI) 还原为标准 ``<img>``。

    trafilatura 以 ``output_format='html'`` 输出时，图片会被降级为 TEI 的
    ``<graphic>``，导致下游的 MarkItDown / html2text / Next.js 代理 URL
    解析全部失效。这里用 BS4 将其标签名改回 ``img``，保留全部属性。
    """
    if not html or "<graphic" not in html:
        return html
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        for g in soup.find_all("graphic"):
            g.name = "img"
        return str(soup)
    except Exception:
        return html


@register_tool("trafilatura")
class TrafilaturaTool(WebToolBase):
    """基于 trafilatura 的主内容提取工具。

    trafilatura 是一个专门用于网页正文提取的库，在学术网页和新闻站点
    上具备优异的提取精度。
    """

    tool_name = "trafilatura"

    def is_available(self) -> bool:
        try:
            import trafilatura  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """使用 trafilatura 提取主内容。"""
        try:
            import trafilatura
        except ImportError:
            return StageResult(
                success=False,
                error="trafilatura 未安装",
                engine_used=self.tool_name,
            )

        raw_html = ctx.raw_html
        if not raw_html:
            return StageResult(
                success=False,
                error="raw_html 为空，无法提取主内容",
                engine_used=self.tool_name,
            )

        try:
            # trafilatura 支持直接返回 HTML 格式的主内容
            main_html = trafilatura.extract(
                raw_html,
                output_format="html",
                include_tables=True,
                include_images=True,
                include_links=True,
                include_formatting=True,
                url=ctx.url,
            )

            if not main_html:
                return StageResult(
                    success=False,
                    error="trafilatura 未能提取到主内容",
                    engine_used=self.tool_name,
                )

            # trafilatura HTML 输出会将 <img> 降级为 TEI <graphic>，
            # 在此还原为标准 <img>，让下游 S5/S9/S10 能正常识别图片。
            main_html = _rehydrate_trafilatura_graphics(main_html)

            # 图片丢失兜底：若原始 HTML 中存在多张图片但 trafilatura
            # 输出为 0，说明本页结构使 trafilatura 整体丢弃了图片
            # （常见于 Next.js 图像代理 / 复杂 figure 嵌套）。此时主动
            # 标记失败，交由 S4 竞争模式降级到 readability 或启发式兜底。
            raw_img_count = len(_IMG_TAG_RE.findall(raw_html))
            main_img_count = len(_IMG_TAG_RE.findall(main_html))
            if raw_img_count >= _MIN_RAW_IMAGES_FOR_LOSS_GUARD and main_img_count == 0:
                logger.warning(
                    "trafilatura 丢弃了全部图片 (raw=%d, main=0)，触发图片丢失兜底",
                    raw_img_count,
                )
                return StageResult(
                    success=False,
                    error=(
                        f"trafilatura 丢弃了全部图片 (raw_html 含 {raw_img_count} "
                        "张)，触发兜底以让其他工具接管"
                    ),
                    engine_used=self.tool_name,
                )

            ctx.metadata["main_content_html"] = main_html

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={
                    "content_length": len(main_html),
                    "img_count": main_img_count,
                    "raw_img_count": raw_img_count,
                },
            )
        except Exception as e:
            logger.warning("trafilatura 提取失败: %s", e)
            return StageResult(
                success=False,
                error=f"trafilatura 提取失败: {e}",
                engine_used=self.tool_name,
            )


@register_tool("readability")
class ReadabilityTool(WebToolBase):
    """基于 readability-lxml 的主内容提取工具。

    readability-lxml 是 Mozilla Readability 算法的 Python 实现，
    适用于标准文章类页面。
    """

    tool_name = "readability"

    def is_available(self) -> bool:
        try:
            from readability import Document  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """使用 readability-lxml 提取主内容。"""
        try:
            from readability import Document
        except ImportError:
            return StageResult(
                success=False,
                error="readability-lxml 未安装",
                engine_used=self.tool_name,
            )

        raw_html = ctx.raw_html
        if not raw_html:
            return StageResult(
                success=False,
                error="raw_html 为空，无法提取主内容",
                engine_used=self.tool_name,
            )

        try:
            doc = Document(raw_html, url=ctx.url)
            main_html = doc.summary()
            short_title = doc.short_title()

            if not main_html:
                return StageResult(
                    success=False,
                    error="readability 未能提取到主内容",
                    engine_used=self.tool_name,
                )

            ctx.metadata["main_content_html"] = main_html
            # readability 的标题提取通常更精确
            if short_title and not ctx.title:
                ctx.title = short_title

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"content_length": len(main_html)},
            )
        except Exception as e:
            logger.warning("readability 提取失败: %s", e)
            return StageResult(
                success=False,
                error=f"readability 提取失败: {e}",
                engine_used=self.tool_name,
            )


@register_tool("beautifulsoup_heuristic")
class BeautifulSoupHeuristicTool(WebToolBase):
    """基于 BeautifulSoup 启发式规则的主内容提取工具。

    委托给现有 ``html_preprocessor.extract_content_area()``。
    """

    tool_name = "beautifulsoup_heuristic"

    def is_available(self) -> bool:
        try:
            from bs4 import BeautifulSoup  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """使用 BeautifulSoup 启发式规则提取主内容区域。"""
        from ....markdown.html_preprocessor import extract_content_area

        raw_html = ctx.raw_html
        if not raw_html:
            return StageResult(
                success=False,
                error="raw_html 为空，无法提取主内容",
                engine_used=self.tool_name,
            )

        try:
            main_html = extract_content_area(raw_html)

            if not main_html or len(main_html.strip()) < 50:
                return StageResult(
                    success=False,
                    error="BeautifulSoup 启发式未提取到有效主内容",
                    engine_used=self.tool_name,
                )

            ctx.metadata["main_content_html"] = main_html

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"content_length": len(main_html)},
            )
        except Exception as e:
            logger.warning("BeautifulSoup 启发式提取失败: %s", e)
            return StageResult(
                success=False,
                error=f"BeautifulSoup 启发式提取失败: {e}",
                engine_used=self.tool_name,
            )


# Stage 本地工具映射
TOOLS: Dict[str, type] = {
    "trafilatura": TrafilaturaTool,
    "readability": ReadabilityTool,
    "beautifulsoup_heuristic": BeautifulSoupHeuristicTool,
}

STAGE_ID = "main_content_extraction"
STAGE_NAME = "主内容区域识别"
