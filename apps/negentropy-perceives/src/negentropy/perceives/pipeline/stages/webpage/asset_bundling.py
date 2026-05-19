"""S12: 资源打包与元数据聚合 — 构建最终输出。

聚合所有 Stage 的处理结果，构建最终输出包：
- 可选的图片 base64 嵌入（复用 ``image_embedder.py``）
- 元数据聚合（字数、字符数、域名、链接数等）
- 富元素统计摘要
"""

from __future__ import annotations

import logging
from typing import Any, Dict
from urllib.parse import urlparse

from ...base import StageResult
from ...models import StageContext
from ...registry import register_tool
from .._base import WebToolBase

logger = logging.getLogger(__name__)


@register_tool("builtin_bundler")
class BuiltinBundlerTool(WebToolBase):
    """内置资源打包工具。

    聚合所有 Stage 产出，执行可选的图片嵌入，
    并构建最终元数据摘要。
    """

    tool_name = "builtin_bundler"

    def is_available(self) -> bool:
        return True  # 纯内部实现，始终可用

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """打包并聚合最终结果。"""
        markdown = ctx.markdown
        if not markdown:
            return StageResult(
                success=False,
                error="无 Markdown 内容可打包",
                engine_used=self.tool_name,
            )

        try:
            # ── 可选：图片 base64 嵌入 ──────────────────────────────
            embed_stats = None
            if ctx.config.get("embed_images", False):
                embed_stats = await self._embed_images(ctx)

            # ── 元数据聚合 ──────────────────────────────────────────
            metadata = self._build_metadata(ctx)
            if embed_stats:
                metadata["image_embedding"] = embed_stats

            # 将聚合元数据写入 ctx
            ctx.metadata.update(metadata)

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata=metadata,
            )
        except Exception as e:
            logger.warning("资源打包失败: %s", e)
            return StageResult(
                success=False,
                error=f"资源打包失败: {e}",
                engine_used=self.tool_name,
            )

    async def _embed_images(self, ctx: StageContext) -> Dict[str, Any]:
        """执行图片 base64 嵌入。"""
        from ....markdown.image_embedder import embed_images_in_markdown

        embed_options = ctx.config.get("embed_options", {})

        result = embed_images_in_markdown(
            ctx.markdown,
            max_images=int(embed_options.get("max_images", 50)),
            max_bytes_per_image=int(
                embed_options.get("max_bytes_per_image", 2_000_000)
            ),
            timeout_seconds=int(embed_options.get("timeout_seconds", 10)),
        )

        ctx.markdown = result.get("markdown", ctx.markdown)
        return result.get("stats", {})

    def _build_metadata(self, ctx: StageContext) -> Dict[str, Any]:
        """构建聚合元数据。"""
        markdown = ctx.markdown

        # 基本文本统计
        word_count = len(markdown.split())
        char_count = len(markdown)

        # 域名提取
        domain = ""
        if ctx.url:
            try:
                domain = urlparse(ctx.url).netloc
            except Exception:
                logger.debug("URL 域名解析失败: %s", ctx.url, exc_info=True)

        # 链接数统计（从 Markdown 中匹配）
        import re

        link_pattern = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
        links = link_pattern.findall(markdown)
        link_count = len(links)

        # 图片引用统计（从 Markdown 中匹配）
        image_pattern = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
        image_refs = image_pattern.findall(markdown)
        image_ref_count = len(image_refs)

        metadata: Dict[str, Any] = {
            "title": ctx.title,
            "url": ctx.url,
            "domain": domain,
            "word_count": word_count,
            "character_count": char_count,
            "link_count": link_count,
            "image_ref_count": image_ref_count,
            # 富元素统计
            "rich_elements": {
                "math_formulas": len(ctx.formulas),
                "code_blocks": len(ctx.code_blocks),
                "tables": len(ctx.tables),
                "images": len(ctx.images),
            },
            # 错误收集
            "errors": ctx.errors if ctx.errors else None,
        }

        return metadata


# Stage 本地工具映射
TOOLS: Dict[str, type] = {
    "builtin_bundler": BuiltinBundlerTool,
}

STAGE_ID = "asset_bundling"
STAGE_NAME = "资源打包与元数据聚合"
