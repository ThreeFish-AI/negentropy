"""S9: 图片提取（``<img>`` -> ImageInfo）。"""

from __future__ import annotations

import logging
from typing import Any, List, Optional

from bs4 import BeautifulSoup

from ....base import StageResult
from ....models import ImageInfo, StageContext
from ....registry import register_tool
from ..._base import WebToolBase
from ..._helpers import get_best_html

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 内部辅助函数
# ---------------------------------------------------------------------------


def _parse_int(value: Any) -> Optional[int]:
    """安全地将属性值转换为整数。"""
    if value is None:
        return None
    try:
        return int(str(value).replace("px", "").strip())
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# S9: 图片提取
# ---------------------------------------------------------------------------


async def _extract_images(ctx: StageContext) -> List[ImageInfo]:
    """从 HTML 中提取图片信息。"""
    html = get_best_html(ctx)
    if not html:
        return []

    images: List[ImageInfo] = []

    try:
        from urllib.parse import urljoin

        soup = BeautifulSoup(html, "html.parser")

        for img_tag in soup.find_all("img"):
            src = img_tag.get("src", "")
            if not src:
                continue

            # 解析相对路径
            if ctx.url and not src.startswith(("http://", "https://", "data:")):  # type: ignore[union-attr]
                src = urljoin(ctx.url, src)  # type: ignore[type-var, assignment]

            alt = img_tag.get("alt", "")
            title = img_tag.get("title", "")

            # 尝试获取尺寸
            width = _parse_int(img_tag.get("width"))
            height = _parse_int(img_tag.get("height"))

            images.append(
                ImageInfo(
                    src=src,  # type: ignore[arg-type]
                    alt=alt,  # type: ignore[arg-type]
                    title=title,  # type: ignore[arg-type]
                    width=width,
                    height=height,
                )
            )

    except Exception as e:
        logger.warning("图片提取失败: %s", e)

    return images


# ---------------------------------------------------------------------------
# 注册工具
# ---------------------------------------------------------------------------


@register_tool("beautifulsoup_image")
class ImageTool(WebToolBase):
    """S9: 图片提取工具。"""

    tool_name = "beautifulsoup_image"

    def is_available(self) -> bool:
        try:
            from bs4 import BeautifulSoup  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult:
        """提取图片信息。"""
        try:
            images = await _extract_images(ctx)
            ctx.images = images
            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"image_count": len(images)},
            )
        except Exception as e:
            ctx.errors.append(f"图片提取失败: {e}")
            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"image_count": 0, "error": str(e)},
            )
