"""S7: 代码块识别（``<pre><code>`` -> CodeBlock）。"""

from __future__ import annotations

import logging
from typing import List, Optional

from bs4 import BeautifulSoup, Tag

from ....base import StageResult
from ....models import CodeBlock, StageContext
from ....registry import register_tool
from ..._base import WebToolBase
from ..._helpers import get_source_html

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 内部辅助函数
# ---------------------------------------------------------------------------


def _detect_language_from_class(element: Tag) -> Optional[str]:
    """从 HTML class 属性中检测编程语言。

    常见模式：``language-python``, ``lang-js``, ``highlight-java``
    """
    classes = element.get("class", [])  # type: ignore[arg-type]
    for cls in classes:  # type: ignore[union-attr]
        if not isinstance(cls, str):
            continue
        # language-xxx / lang-xxx
        for prefix in ("language-", "lang-", "highlight-"):
            if cls.startswith(prefix):
                return cls[len(prefix) :]
        # 直接匹配常见语言名
        lower = cls.lower()
        if lower in (
            "python",
            "javascript",
            "typescript",
            "java",
            "c",
            "cpp",
            "csharp",
            "go",
            "rust",
            "ruby",
            "php",
            "swift",
            "kotlin",
            "scala",
            "html",
            "css",
            "sql",
            "bash",
            "shell",
            "json",
            "yaml",
            "xml",
            "markdown",
        ):
            return lower
    return None


# ---------------------------------------------------------------------------
# S7: 代码块识别
# ---------------------------------------------------------------------------


async def _extract_code_blocks(ctx: StageContext) -> List[CodeBlock]:
    """从 HTML 中提取代码块。

    检测 ``<pre><code>`` 和独立的 ``<pre>`` 标签。
    """
    html = get_source_html(ctx)
    if not html:
        return []

    blocks: List[CodeBlock] = []

    try:
        soup = BeautifulSoup(html, "html.parser")

        for pre in soup.find_all("pre"):
            code_tag = pre.find("code")
            if code_tag:
                code_text = code_tag.get_text()
                language = _detect_language_from_class(code_tag)
            else:
                code_text = pre.get_text()
                language = None

            code_text = code_text.strip()
            if not code_text:
                continue

            blocks.append(
                CodeBlock(
                    code=code_text,
                    language=language,
                    original_html=str(pre)[:1000],
                )
            )

    except Exception as e:
        logger.warning("代码块提取失败: %s", e)

    return blocks


# ---------------------------------------------------------------------------
# 注册工具
# ---------------------------------------------------------------------------


@register_tool("beautifulsoup_code")
class CodeBlockTool(WebToolBase):
    """S7: 代码块识别工具。"""

    tool_name = "beautifulsoup_code"

    def is_available(self) -> bool:
        try:
            from bs4 import BeautifulSoup  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult:
        """识别代码块。"""
        try:
            blocks = await _extract_code_blocks(ctx)
            ctx.code_blocks = blocks
            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"code_block_count": len(blocks)},
            )
        except Exception as e:
            ctx.errors.append(f"代码块识别失败: {e}")
            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"code_block_count": 0, "error": str(e)},
            )
