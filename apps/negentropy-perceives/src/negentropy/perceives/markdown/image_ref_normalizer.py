"""图片引用规范化模块：统一 Markdown 中的图片引用为 ``./images/filename`` 格式。

处理两类问题：

1. Docling 降级模式产出的 ``<!-- image -->`` 占位符 → 替换为标准 ``![alt](./images/filename)``
2. 各引擎产出的非标准路径（绝对路径、裸文件名等）→ 规范化为 ``./images/basename``
"""

import logging
import re
from pathlib import PurePosixPath
from typing import Optional, Protocol, Sequence, runtime_checkable

logger = logging.getLogger(__name__)

# <!-- image --> 占位符（Docling PLACEHOLDER 模式产出）
_IMAGE_PLACEHOLDER_RE = re.compile(r"<!--\s*image\s*-->")

# 标准 Markdown 图片引用 ![alt](path)
_IMAGE_REF_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")


@runtime_checkable
class ImageMeta(Protocol):
    """图片元数据协议，``DoclingImage`` 与 ``ExtractedImage`` 均满足。"""

    @property
    def filename(self) -> Optional[str]: ...

    @property
    def caption(self) -> Optional[str]: ...


def normalize_image_references(
    markdown: str,
    images: Sequence[ImageMeta],
    *,
    image_dir: str = "./images",
    append_orphans: bool = True,
) -> str:
    """将 Markdown 中的图片引用规范化为统一的相对路径格式。

    三阶段处理：

    1. 按文档顺序将 ``<!-- image -->`` 占位符替换为 ``![caption](./images/filename)``
    2. 将已有 ``![alt](path)`` 中的路径规范化为 ``./images/basename``
    3. 追加孤儿图引用：已落盘但 Markdown 无引用的图按列表顺序补在末尾，
       避免学术 PDF 中矢量图被 caption/IoU 去重误删后丢图

    跳过 ``data:`` URI（base64 内联模式）与路径已规范化的引用。

    Args:
        markdown: 原始 Markdown 文本。
        images: 有序图片元数据列表（按文档顺序）。
        image_dir: 图片相对目录前缀，默认 ``./images``。
        append_orphans: 是否启用 Phase 3 孤儿图追加（默认 ``True``）。

    Returns:
        规范化后的 Markdown 文本。
    """
    if not markdown:
        return markdown

    # Phase 1: 替换 <!-- image --> 占位符
    markdown = _replace_image_placeholders(markdown, images, image_dir)

    # Phase 2: 规范化已有 ![alt](path) 引用
    markdown = _normalize_existing_refs(markdown, images, image_dir)

    # Phase 3: 追加孤儿图（在 markdown 中未被引用的图）
    if append_orphans:
        markdown = _append_orphan_images(markdown, images, image_dir)

    return markdown


def _append_orphan_images(
    markdown: str,
    images: Sequence[ImageMeta],
    image_dir: str,
) -> str:
    """把 markdown 中未引用的图按列表顺序追加到末尾。

    Markdown 中通过 basename 判定是否已引用，避免被 caption/IoU 去重误删的
    图在最终文档中"消失"。每张图占独立段落，带 caption 作为 alt。
    """
    if not images:
        return markdown

    referenced_basenames: set[str] = set()
    for match in _IMAGE_REF_RE.finditer(markdown):
        path = match.group(2)
        if path.startswith("data:"):
            continue
        basename = PurePosixPath(path).name
        if basename:
            referenced_basenames.add(basename)

    orphans = [
        img
        for img in images
        if img.filename and img.filename not in referenced_basenames
    ]
    if not orphans:
        return markdown

    appended_lines = ["", "<!-- orphan images appended by image_ref_normalizer -->"]
    for img in orphans:
        alt = img.caption or img.filename or "image"
        appended_lines.append("")
        appended_lines.append(f"![{alt}]({image_dir}/{img.filename})")
    return markdown.rstrip() + "\n".join(appended_lines) + "\n"


def _replace_image_placeholders(
    markdown: str,
    images: Sequence[ImageMeta],
    image_dir: str,
) -> str:
    """按文档顺序将 ``<!-- image -->`` 占位符替换为标准图片引用。"""
    placeholders = list(_IMAGE_PLACEHOLDER_RE.finditer(markdown))
    if not placeholders:
        return markdown

    # 仅保留有 filename 的图片（按序对应占位符）
    available = [img for img in images if img.filename]

    parts: list[str] = []
    last_end = 0

    for idx, match in enumerate(placeholders):
        parts.append(markdown[last_end : match.start()])

        if idx < len(available):
            img = available[idx]
            alt = img.caption or img.filename or "image"
            parts.append(f"![{alt}]({image_dir}/{img.filename})")
        else:
            logger.warning(
                "<!-- image --> 占位符数量 (%d) 超出可用图片 (%d)，保留第 %d 个占位符",
                len(placeholders),
                len(available),
                idx + 1,
            )
            parts.append(match.group(0))

        last_end = match.end()

    parts.append(markdown[last_end:])
    return "".join(parts)


def _normalize_existing_refs(
    markdown: str,
    images: Sequence[ImageMeta],
    image_dir: str,
) -> str:
    """规范化已有的 ``![alt](path)`` 引用路径。"""
    filename_set = {img.filename for img in images if img.filename}
    if not filename_set:
        return markdown

    def _replacer(match: re.Match) -> str:
        alt = match.group(1)
        path = match.group(2)

        # 跳过 base64 data URI
        if path.startswith("data:"):
            return match.group(0)

        # 已规范化的路径跳过
        if path.startswith(f"{image_dir}/"):
            return match.group(0)

        # 提取 basename 并校验是否为已知图片
        basename = PurePosixPath(path).name
        if basename in filename_set:
            return f"![{alt}]({image_dir}/{basename})"

        return match.group(0)

    return _IMAGE_REF_RE.sub(_replacer, markdown)
