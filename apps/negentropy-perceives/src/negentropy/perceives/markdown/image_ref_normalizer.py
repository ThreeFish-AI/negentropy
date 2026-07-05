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

# HTML 内嵌 <img src="..."> 标签（带宽高的 assembly._image_to_markdown 输出形式）
# 用于孤儿图判定：assembly 阶段图片是 HTML img 形式（保留 width/height），
# 仅识别 markdown ``![alt](path)`` 会把所有 HTML 已引用的图当成孤儿，
# 在文档末尾整段重复追加 56 张图（实测 Context Engineering 2.0 论文）。
_HTML_IMG_SRC_RE = re.compile(
    r"""<img\s+[^>]*?\bsrc\s*=\s*["']([^"']+)["']""",
    re.IGNORECASE,
)


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
    # HTML <img src="..."> 也算引用：assembly 阶段会把图渲染为
    # ``<img src="./images/xxx.png" width="..." height="..." />`` 以承载
    # PDF 原始显示尺寸，仅扫描 ``![alt](path)`` 会把这些 HTML 引用全部
    # 视为孤儿，在末尾重复追加（实测 Context Engineering 2.0 论文末尾
    # 重复出现 56 张图，与正文已渲染的 HTML img 1:1 重叠）。
    for match in _HTML_IMG_SRC_RE.finditer(markdown):
        src = match.group(1)
        if src.startswith("data:"):
            continue
        basename = PurePosixPath(src).name
        if basename:
            referenced_basenames.add(basename)

    orphans = [
        img
        for img in images
        if img.filename
        and img.filename not in referenced_basenames
        and img.filename
        not in _redundant_orphan_basenames(markdown, images, referenced_basenames)
    ]
    if not orphans:
        return markdown

    appended_lines = ["", "<!-- orphan images appended by image_ref_normalizer -->"]
    for img in orphans:
        alt = img.caption or img.filename or "image"
        appended_lines.append("")
        appended_lines.append(f"![{alt}]({image_dir}/{img.filename})")
    return markdown.rstrip() + "\n".join(appended_lines) + "\n"


# 近全页图的最小显示面积阈值（CSS px²）。assembly._image_to_markdown 以 bbox(pt)×4/3
# 计算显示尺寸：近全页图约 680×950 ≈ 646k px²；正文 figure 通常 <300k（如 457×365≈167k）。
# 取 500k 仅捕获真正的 page-dominant 图，避免误伤多图正文页的合法 figure。
_PAGE_DOMINANT_MIN_AREA = 500_000


def _img_tag_dims(markdown: str) -> dict[str, tuple[int, int]]:
    """从 markdown 内嵌 ``<img src width height>`` 解析每张已引用图的显示尺寸。

    assembly 阶段把图渲染为 HTML img 并携带 width/height（PDF bbox 派生，最准），
    栅格 width/height 仅在 bbox 缺失时回退。属性顺序不固定，故逐标签提取。
    """
    dims: dict[str, tuple[int, int]] = {}
    for tag in re.finditer(r"<img\b[^>]*>", markdown, re.IGNORECASE):
        attrs = tag.group(0)
        src_m = re.search(r'\bsrc\s*=\s*["\']([^"\']+)["\']', attrs)
        w_m = re.search(r'\bwidth\s*=\s*["\'](\d+)["\']', attrs)
        h_m = re.search(r'\bheight\s*=\s*["\'](\d+)["\']', attrs)
        if not (src_m and w_m and h_m):
            continue
        src = src_m.group(1)
        if src.startswith("data:"):
            continue
        bn = PurePosixPath(src).name
        if bn:
            dims[bn] = (int(w_m.group(1)), int(h_m.group(1)))
    return dims


def _redundant_orphan_basenames(
    markdown: str,
    images: Sequence[ImageMeta],
    referenced_basenames: set[str],
) -> set[str]:
    """识别应抑制的冗余 orphan：与某张 page-dominant 已引用图同页的 orphan 碎片。

    场景：封面/整页插图页，全页大图已被正文 ``<img>`` 引用（已含全部视觉内容），
    同页其余未引用的嵌入图对象（logo/条码/图层碎片）作为 orphan 追加会与全页图
    视觉重复。判定：已引用图显示面积 ≥ ``_PAGE_DOMINANT_MIN_AREA`` → page-dominant；
    其所在页的其余 orphan 判为冗余碎片，抑制不追加。

    安全性：仅当确有 page-dominant 已引用图且 page_number 可用时才抑制同页 orphan；
    否则返回空集（no-op，保留既有 loss-averse orphan 行为），不误删多图正文页合法孤立图。
    """
    ref_dims = _img_tag_dims(markdown)
    if not ref_dims:
        return set()

    basename_to_page: dict[str, int] = {}
    for img in images:
        fn = getattr(img, "filename", None)
        pg = getattr(img, "page_number", None)
        if fn and pg is not None:
            basename_to_page[fn] = pg
    if not basename_to_page:
        return set()  # 无 page_number 维度，无法安全按页抑制

    dominant_pages: set[int] = set()
    for bn, (w, h) in ref_dims.items():
        if w * h >= _PAGE_DOMINANT_MIN_AREA:
            pg = basename_to_page.get(bn)
            if pg is not None:
                dominant_pages.add(pg)
    if not dominant_pages:
        return set()

    redundant: set[str] = set()
    for img in images:
        fn = getattr(img, "filename", None)
        if not fn or fn in referenced_basenames:
            continue
        if basename_to_page.get(fn) in dominant_pages:
            redundant.add(fn)
    return redundant


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
