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


def _build_img_html(
    img: "ImageMeta", image_dir: str, alt_override: Optional[str] = None
) -> str:
    """把图片元数据构造为 ``<img>`` 标签（与 assembly._image_to_markdown 形态一致）。

    占位符替换 / 孤儿图追加原本输出裸 ``![alt](./images/filename)``，与正文
    ``<img src width height>`` 形态不一致。此处统一为 ``<img>``：尽力从原图
    （``local_path`` 或 ``base64_data``）读像素尺寸，宽 >800 等比缩放（引擎常以
    2x/3x 渲染 figure，原生像素直接做显示宽度会放大数倍）；读不到则输出无显式
    尺寸的响应式 ``<img>``。保证所有图片同为 ``<img>`` 形态、带尺寸（尽最大努力）。

    ``alt_override`` 非空时优先用作 alt（如 ref 规范化路径保留原 markdown ``![alt]``
    的 alt 文本），否则回退到 image.caption / filename。
    """
    import html as _html
    import os as _os

    filename = img.filename or "image"
    alt = alt_override or img.caption or filename
    src = f"{image_dir}/{filename}"
    w: Optional[int] = None
    h: Optional[int] = None
    # 优先用图片对象自带的栅格尺寸（引擎报告的 width/height 字段）
    _iw = getattr(img, "width", None)
    _ih = getattr(img, "height", None)
    if _iw:
        w = int(_iw)
    if _ih:
        h = int(_ih)
    try:
        import base64 as _b64
        import io as _io

        from PIL import Image as _PILImage

        _src = None
        _lp = getattr(img, "local_path", None)
        if _lp and _os.path.exists(_lp):
            _src = _PILImage.open(_lp)
        else:
            _b64d = getattr(img, "base64_data", None)
            if _b64d:
                _src = _PILImage.open(_io.BytesIO(_b64.b64decode(_b64d)))
        if _src is not None:
            nw, nh = _src.size
            _src.close()
            if nw > 0 and nh > 0:
                _maxw = 800
                if nw > _maxw:
                    w = _maxw
                    h = int(round(nh * _maxw / nw))
                else:
                    w, h = nw, nh
    except Exception:  # nosec B110 - PIL 尺寸解析失败回退默认尺寸（best-effort，无安全影响）
        pass
    # 统一封顶：无论尺寸来源（字段 / PIL），宽 >800 等比缩放，避免 2x/3x 渲染图过大
    if w and w > 800 and h and h > 0:
        h = int(round(h * 800 / w))
        w = 800
    parts = [
        f'<img src="{_html.escape(src, quote=True)}"',
        f'alt="{_html.escape(alt, quote=True)}"',
    ]
    if w:
        parts.append(f'width="{w}"')
    if h:
        parts.append(f'height="{h}"')
    parts.append('style="max-width:100%;height:auto;" />')
    return " ".join(parts)


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

    redundant_basenames = _redundant_orphan_basenames(
        markdown, images, referenced_basenames
    ) | _adjacent_fragment_orphans(images, referenced_basenames)

    orphans = [
        img
        for img in images
        if img.filename
        and img.filename not in referenced_basenames
        and img.filename not in redundant_basenames
    ]
    if not orphans:
        return markdown

    # 优先内联放置：orphan 若与唯一张已引用图同页（如多面板 figure 的右面板
    # 被左面板引用而自身 orphan），插入到该兄弟 <img> 之后，避免被甩到文末
    # 破坏阅读流。要求"唯一同页兄弟"以消除多图页的归属歧义（非回归安全）。
    ref_page: dict[str, int] = {}
    _basename_to_caption: dict[str, Optional[str]] = {}
    for _img in images:
        _fn = getattr(_img, "filename", None)
        _pg = getattr(_img, "page_number", None)
        if _fn and _fn in referenced_basenames and _pg is not None:
            ref_page[_fn] = _pg
        if _fn:
            _basename_to_caption[_fn] = getattr(_img, "caption", None)

    placed_inline: set[str] = set()
    for orphan in orphans:
        _ofn = orphan.filename
        if not _ofn:
            continue
        _opg = getattr(orphan, "page_number", None)
        if _opg is None:
            continue
        _sib_bns = [fn for fn, pg in ref_page.items() if pg == _opg]
        if len(_sib_bns) != 1:
            continue  # 无兄弟或多兄弟（歧义）→ 回退文末追加
        _sib_bn = _sib_bns[0]
        # 仅当兄弟图无 caption（多面板 figure 的 panel，其 caption 由单独文本块
        # 承载）时内联；兄弟有 caption（完整独立 figure）时 orphan 是另一独立
        # figure → 回退文末追加，避免把独立图错并入兄弟图后。
        _sib_caption = _basename_to_caption.get(_sib_bn)
        if _sib_caption:
            continue
        _orphan_html = _build_img_html(orphan, image_dir)

        def _repl(m: "re.Match[str]", oh: str = _orphan_html) -> str:
            return m.group(0) + "\n" + oh

        _sib_pat = re.compile(
            r"(<img\b[^>]*\bsrc\s*=\s*[\"'][^\"']*"
            + re.escape(_sib_bn)
            + r"[^\"']*[\"'][^>]*>)",
            re.IGNORECASE,
        )
        _new_md, _n = _sib_pat.subn(_repl, markdown, count=1)
        if _n > 0:
            markdown = _new_md
            placed_inline.add(_ofn)

    remaining = [img for img in orphans if img.filename not in placed_inline]
    if not remaining:
        return markdown

    appended_lines = ["", "<!-- orphan images appended by image_ref_normalizer -->"]
    for img in remaining:
        appended_lines.append("")
        appended_lines.append(_build_img_html(img, image_dir))
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


# 跨页 figure 过度分割碎片抑制：当某张图（完整 figure）已被正文 <img> 引用，
# 其同页或相邻页(±1)的未引用 orphan 若像素面积 ≤ 该已放置图的 1/_FRAGMENT_RATIO，
# 判为 docling 对同一 figure 的冗余局部裁切，抑制不追加到文末。
# 取 0.5（即已放置图面积 ≥ orphan 2×）以仅捕获真正的子区域碎片，避免误伤
# 同/邻页独立的小 figure（独立 figure 通常自带 caption 被正文引用，不会是 orphan）。
_FRAGMENT_RATIO = 0.5


def _adjacent_fragment_orphans(
    images: Sequence[ImageMeta],
    referenced_basenames: set[str],
) -> set[str]:
    """识别跨页/同页 figure 过度分割产出的 orphan 碎片。

    场景：docling 将一张（常为跨页或结构复杂的）figure 同时输出为一张完整图
    （被正文 ``<img>`` 引用）与若干局部裁切（无法匹配文本引用 → orphan）。
    这些 orphan 追加到文末会与已内联的完整图视觉重复。

    判定：orphan 与某张已引用图在同页或相邻页（|Δpage| ≤ 1），且已引用图像素
    面积 ≥ orphan × ``1/_FRAGMENT_RATIO`` → orphan 判为冗余碎片，抑制。

    安全性：需 width/height（像素）/page_number 均可用，否则 no-op（保留既有
    loss-averse orphan 行为）；仅在确有同/邻页大图已放置且面积达碎片 N 倍时抑制，
    不误伤多图正文页的合法孤立小图。
    """
    meta: dict[str, tuple[int, int, int]] = {}
    for img in images:
        fn = getattr(img, "filename", None)
        if not fn:
            continue
        w = getattr(img, "width", None)
        h = getattr(img, "height", None)
        pg = getattr(img, "page_number", None)
        if w and h and pg is not None:
            meta[fn] = (int(w), int(h), int(pg))
    if not meta:
        return set()

    placed = [(fn, m) for fn, m in meta.items() if fn in referenced_basenames]
    if not placed:
        return set()

    redundant: set[str] = set()
    for fn, (ow, oh, opg) in meta.items():
        if fn in referenced_basenames or fn in redundant:
            continue
        orphan_area = ow * oh
        for _pfn, (pw, ph, ppg) in placed:
            if abs(ppg - opg) <= 1 and pw * ph >= orphan_area / _FRAGMENT_RATIO:
                redundant.add(fn)
                break
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
            parts.append(_build_img_html(img, image_dir))
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
    basename_to_img = {img.filename: img for img in images if img.filename}
    if not basename_to_img:
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
        if basename in basename_to_img:
            return _build_img_html(
                basename_to_img[basename], image_dir, alt_override=alt or None
            )

        return match.group(0)

    return _IMAGE_REF_RE.sub(_replacer, markdown)
