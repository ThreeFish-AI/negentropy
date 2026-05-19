"""S5: HTML 清洗与预处理 — 清理残余脚本/样式，保护数学和代码元素。

委托给现有 ``markdown.html_preprocessor.preprocess_html()``，对
S4 产出的 ``main_content_html`` 进行深度清理，输出写入 ``ctx.cleaned_html``。

清洗内容包括：
- 移除 ``<script>``/``<style>``/``<nav>`` 等非内容标签
- 保护数学公式元素（MathJax/KaTeX/MathML → LaTeX 文本）
- 解析相对 URL 为绝对路径
- 在块级元素间插入换行保证段落边界
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


@register_tool("beautifulsoup")
class BeautifulSoupSanitizeTool(WebToolBase):
    """基于 BeautifulSoup 的 HTML 清洗工具。

    委托给 ``markdown.html_preprocessor.preprocess_html()``。
    """

    tool_name = "beautifulsoup"

    def is_available(self) -> bool:
        try:
            from bs4 import BeautifulSoup  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """清洗 HTML 内容。"""
        from ....markdown.html_preprocessor import preprocess_html

        # 优先使用 S4 产出的主内容 HTML，否则回退到 raw_html
        input_html = get_best_html(ctx)
        if not input_html:
            return StageResult(
                success=False,
                error="无可用 HTML 内容进行清洗",
                engine_used=self.tool_name,
            )

        try:
            cleaned = preprocess_html(input_html, base_url=ctx.url)

            if not cleaned or len(cleaned.strip()) < 10:
                return StageResult(
                    success=False,
                    error="HTML 清洗后内容为空",
                    engine_used=self.tool_name,
                )

            ctx.cleaned_html = cleaned

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={
                    "input_length": len(input_html),
                    "output_length": len(cleaned),
                    "reduction_ratio": round(
                        1 - len(cleaned) / max(len(input_html), 1), 3
                    ),
                },
            )
        except Exception as e:
            logger.warning("HTML 清洗失败: %s", e)
            return StageResult(
                success=False,
                error=f"HTML 清洗失败: {e}",
                engine_used=self.tool_name,
            )


# Stage 本地工具映射
TOOLS: Dict[str, type] = {
    "beautifulsoup": BeautifulSoupSanitizeTool,
}

STAGE_ID = "html_sanitization"
STAGE_NAME = "HTML 清洗与预处理"
