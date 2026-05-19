"""图片嵌入模块：将 Markdown 中引用的远程图片转换为 data URI。

同时支持两种 Markdown 中的图片表达：
1. 标准 Markdown 语法 ``![alt](url)``
2. 内嵌 HTML ``<img src="url" ...>``（保留 width/height/style 等属性，
   由 ``preprocess_html`` 的图片尺寸保留特性产生）

两种形式复用同一份"下载 → 大小校验 → base64 编码"逻辑，让
``embed_images`` 与 ``preserve_image_dimensions`` 两个开关正交可组合。
"""

import base64
import logging
import mimetypes
import re
from typing import Any, Dict, Optional, Tuple

import requests

logger = logging.getLogger(__name__)


_MD_IMG_RE = re.compile(r"!\[(.*?)\]\((.*?)\)")
# 内嵌 HTML <img>：src 可用单/双引号；属性顺序不固定（src 可在任意位置）。
_HTML_IMG_RE = re.compile(
    r"<img\b([^>]*?)\bsrc=([\"\'])(.*?)\2([^>]*?)\s*/?>",
    re.IGNORECASE,
)


def _download_and_encode(
    image_url: str, *, max_bytes_per_image: int, timeout_seconds: int
) -> Tuple[Optional[str], str]:
    """下载图片并编码为 data URI。

    返回 ``(data_uri, status)``：
        - ``data_uri`` 为 None 时表示跳过（保留原 URL）
        - ``status`` ∈ ``{"ok", "non_image", "too_large", "error"}``
    """
    try:
        resp = requests.get(image_url, timeout=timeout_seconds, stream=True)
        resp.raise_for_status()

        content_type = resp.headers.get("Content-Type", "")
        if not content_type.startswith("image/"):
            guessed, _ = mimetypes.guess_type(image_url)
            if not (guessed and guessed.startswith("image/")):
                return None, "non_image"
            content_type = guessed

        # 优先使用 Content-Length 做预过滤，避免下载超大文件
        length_header = resp.headers.get("Content-Length")
        if length_header is not None:
            try:
                content_length = int(length_header)
                if content_length > max_bytes_per_image:
                    return None, "too_large"
            except (ValueError, TypeError):
                pass

        content = resp.content
        if len(content) > max_bytes_per_image:
            return None, "too_large"

        b64 = base64.b64encode(content).decode("ascii")
        data_uri = f"data:{content_type};base64,{b64}"
        return data_uri, "ok"
    except Exception:
        return None, "error"


def embed_images_in_markdown(
    markdown_content: str,
    *,
    max_images: int = 50,
    max_bytes_per_image: int = 2_000_000,
    timeout_seconds: int = 10,
) -> Dict[str, Any]:
    """Embed remote images referenced in Markdown as data URIs.

    同时处理 ``![alt](url)`` 与 ``<img src="url" ...>`` 两种形式。
    """
    try:
        embedded_count = 0
        attempted = 0
        skipped_large = 0
        skipped_errors = 0

        def _embed(url: str) -> Optional[str]:
            """下载并编码；副作用更新统计。返回 data URI 或 None。"""
            nonlocal embedded_count, attempted, skipped_large, skipped_errors
            attempted += 1
            data_uri, status = _download_and_encode(
                url,
                max_bytes_per_image=max_bytes_per_image,
                timeout_seconds=timeout_seconds,
            )
            if status == "ok" and data_uri is not None:
                embedded_count += 1
                return data_uri
            if status == "too_large":
                skipped_large += 1
            elif status in ("error", "non_image"):
                skipped_errors += 1
            return None

        def md_replacer(match: re.Match) -> str:
            if embedded_count >= max_images:
                return match.group(0)
            alt_text = match.group(1)
            image_url = match.group(2)
            data_uri = _embed(image_url)
            if data_uri is None:
                return match.group(0)
            return f"![{alt_text}]({data_uri})"

        def html_replacer(match: re.Match) -> str:
            if embedded_count >= max_images:
                return match.group(0)
            pre_attrs = match.group(1)
            quote = match.group(2)
            image_url = match.group(3)
            post_attrs = match.group(4)
            data_uri = _embed(image_url)
            if data_uri is None:
                return match.group(0)
            return f"<img{pre_attrs} src={quote}{data_uri}{quote}{post_attrs} />"

        new_md = _MD_IMG_RE.sub(md_replacer, markdown_content)
        new_md = _HTML_IMG_RE.sub(html_replacer, new_md)

        return {
            "markdown": new_md,
            "stats": {
                "attempted": attempted,
                "embedded": embedded_count,
                "skipped_large": skipped_large,
                "skipped_errors": skipped_errors,
                "max_images": max_images,
                "max_bytes_per_image": max_bytes_per_image,
            },
        }
    except Exception as e:
        logger.warning(f"Error embedding images: {str(e)}")
        return {
            "markdown": markdown_content,
            "stats": {
                "attempted": 0,
                "embedded": 0,
                "skipped_large": 0,
                "skipped_errors": 1,
            },
        }
