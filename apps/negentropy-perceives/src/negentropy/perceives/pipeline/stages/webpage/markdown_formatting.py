"""S11: Markdown 排版与格式化 — 增强 Markdown 输出的可读性和规范性。

委托给现有 ``markdown.formatter.MarkdownFormatter``，对 S10 产出的
``ctx.markdown`` 进行排版优化，包括：

- 段落间距归一化
- 表格对齐
- 标题格式化
- 代码块语言检测
- 排版符号优化
"""

from __future__ import annotations

import logging
from typing import Dict

from ...base import StageResult
from ...models import StageContext
from ...registry import register_tool
from .._base import WebToolBase

logger = logging.getLogger(__name__)


@register_tool("builtin_formatter")
class BuiltinFormatterTool(WebToolBase):
    """内置 Markdown 排版工具。

    委托给 ``markdown.formatter.MarkdownFormatter``。
    """

    tool_name = "builtin_formatter"

    def is_available(self) -> bool:
        return True  # 纯内部实现，始终可用

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """格式化 Markdown 内容。"""
        from ....markdown.formatter import MarkdownFormatter

        markdown = ctx.markdown
        if not markdown:
            return StageResult(
                success=False,
                error="无 Markdown 内容可格式化",
                engine_used=self.tool_name,
            )

        try:
            # 从上下文配置中获取格式化选项
            formatting_options = ctx.config.get("formatting_options", None)
            formatter = MarkdownFormatter(formatting_options)

            formatted = formatter.format(markdown)

            if not formatted:
                # 格式化失败，保留原始内容
                logger.warning("Markdown 格式化结果为空，保留原始内容")
                return StageResult(
                    success=True,
                    output=ctx,
                    engine_used=self.tool_name,
                    metadata={"formatted": False, "reason": "格式化结果为空"},
                )

            ctx.markdown = formatted

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={
                    "formatted": True,
                    "input_length": len(markdown),
                    "output_length": len(formatted),
                },
            )
        except Exception as e:
            # 格式化失败是非致命的，保留原始 Markdown
            logger.warning("Markdown 格式化失败，保留原始内容: %s", e)
            ctx.errors.append(f"Markdown 格式化失败: {e}")
            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"formatted": False, "error": str(e)},
            )


# Stage 本地工具映射
TOOLS: Dict[str, type] = {
    "builtin_formatter": BuiltinFormatterTool,
}

STAGE_ID = "markdown_formatting"
STAGE_NAME = "Markdown 排版与格式化"
