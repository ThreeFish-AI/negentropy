"""Pipeline Stage 工具共享辅助函数。"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..models import StageContext


def get_best_html(ctx: StageContext) -> str:
    """从 StageContext 中获取最优 HTML 源。

    优先级：cleaned_html > main_content_html > raw_html
    """
    return (
        ctx.cleaned_html
        or ctx.metadata.get("main_content_html", "")
        or ctx.raw_html
        or ""
    )


def get_source_html(ctx: StageContext) -> str:
    """从 StageContext 中获取原始 HTML 源（优先 raw_html）。

    用于富元素提取，因为 raw_html 保留了原始数学/代码元素。
    """
    return ctx.raw_html or ctx.cleaned_html or ""
