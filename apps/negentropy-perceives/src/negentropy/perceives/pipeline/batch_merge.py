"""PDF 大文档分批合并模块（auto_batch 路径）。

适用场景：``parse_pdf_to_markdown`` 在 ``auto_batch=True`` 且 PDF 总页数超阈值时，
按 ``page_range`` 把原 PDF 切成 N 个切片串行调用 ``run_pdf_pipeline``。每切片自身
走完整 9-stage Pipeline 并产出独立 ``PipelineResult``。本模块负责将多个切片
合并为单一虚拟结果，供 ops 层组装 ``PDFResponse``。

合并五步法：
    1. **资产去重**：按 ``(filename, sha256)`` 双键合并 ``image_assets``。同名同
       内容跳过；同名不同内容时后者重命名为 ``b{slice}_{filename}`` 并同步
       重写 markdown 引用。
    2. **markdown 拼接 + boundary marker**：切片之间注入 HTML 注释
       ``<!-- batch boundary: pages {s+1}-{e} -->``，便于失真定位回溯切片。
    3. **边界 Figure caption 救援**：检测前切片尾段是否为 ``Figure N:`` caption
       而后切片首段为独立 ``<img>`` 段（或反向），合并跨切片图文。
    4. **元数据合并**：保留首切片 PDF metadata，``total_pages`` 用原 PDF 真实值
       覆盖（避免切片级 ``page_range`` 漂移）。
    5. **计数累加**：``images_count`` / ``tables_count`` / ``formulas_count`` /
       ``code_blocks_count`` 跨切片求和；``engines_used`` 去重保留出现顺序。

设计准则：本模块**仅做纯函数合并**，不重试 / 不调度 / 不触 IO（除资产
SHA-256 读盘）；重试 + 降级由 ``ops/pdf.py`` 调度层负责。
"""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

from .models import ImageAsset, PipelineResult

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 合并产物
# ---------------------------------------------------------------------------


@dataclass
class MergedBatchResult:
    """跨切片合并后的虚拟 PipelineResult-like 结构。

    与 :class:`PipelineResult` 字段保持兼容；不复用前者以保留切片级 partial
    failures 等扩展字段的独立语义，且避免污染主 Pipeline 数据契约。
    """

    markdown: str
    word_count: int
    image_assets: List[ImageAsset]
    images_count: int
    tables_count: int
    formulas_count: int
    code_blocks_count: int
    engines_used: List[str]
    stage_results: dict
    metadata: dict
    page_count: int
    success: bool = True
    error: Optional[str] = None
    partial_failures: List[Tuple[int, int, str]] = field(default_factory=list)
    """切片级失败列表 ``[(start, end, error_str), ...]``。

    所有切片成功时为空列表；部分切片失败时记录在此但 ``success`` 仍可为
    ``True``（已合并已成功的切片）；全部失败才使 ``success=False``。
    """


# ---------------------------------------------------------------------------
# 切片范围生成
# ---------------------------------------------------------------------------


def split_page_ranges(total_pages: int, batch_size: int) -> List[Tuple[int, int]]:
    """把 ``[0, total_pages)`` 切成若干 ``[start, end)`` 切片（左闭右开）。

    Args:
        total_pages: PDF 总页数，必须 > 0。
        batch_size: 单切片最大页数，必须 > 0。

    Returns:
        ``[(start, end), ...]`` 列表。例：

        - ``split_page_ranges(100, 40) == [(0, 40), (40, 80), (80, 100)]``
        - ``split_page_ranges(40, 40) == [(0, 40)]``
        - ``split_page_ranges(1, 40) == [(0, 1)]``

    Raises:
        ValueError: 当任一参数 <= 0。
    """
    if total_pages <= 0:
        raise ValueError(f"total_pages must be > 0, got {total_pages}")
    if batch_size <= 0:
        raise ValueError(f"batch_size must be > 0, got {batch_size}")
    ranges: List[Tuple[int, int]] = []
    start = 0
    while start < total_pages:
        end = min(start + batch_size, total_pages)
        ranges.append((start, end))
        start = end
    return ranges


# ---------------------------------------------------------------------------
# PDF 页数探测（轻量，不加载整 PDF）
# ---------------------------------------------------------------------------


def detect_pdf_total_pages(pdf_source: str) -> Optional[int]:
    """轻量探测 PDF 总页数。

    优先用 PyMuPDF（``fitz.open + page_count``）。仅本地路径生效；URL 源
    返回 ``None``，由上游 preprocessing 处理（自动走单次路径）。

    Args:
        pdf_source: PDF 本地路径或 URL。

    Returns:
        总页数；失败或不支持时返回 ``None`` → 调用方应回退到单次路径。
    """
    if not pdf_source:
        return None
    if pdf_source.startswith(("http://", "https://")):
        return None

    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.debug("PyMuPDF 不可用，跳过 total_pages 探测")
        return None

    try:
        with fitz.open(pdf_source) as doc:
            return int(doc.page_count)
    except Exception as exc:  # noqa: BLE001
        logger.warning("detect_pdf_total_pages 失败 source=%s err=%s", pdf_source, exc)
        return None


# ---------------------------------------------------------------------------
# 资产去重
# ---------------------------------------------------------------------------


_FILE_HASH_CACHE: dict[str, str] = {}


def _file_sha256(path: str) -> Optional[str]:
    """计算文件 SHA-256 摘要，带进程内缓存。

    失败（文件不存在 / 读取异常）返回 ``None``，调用方按 ``None != None``
    fail-open 判定（不视为同图，按各自保留处理）。
    """
    if not path:
        return None
    if path in _FILE_HASH_CACHE:
        return _FILE_HASH_CACHE[path]
    try:
        h = hashlib.sha256()
        with open(path, "rb") as fh:
            while True:
                chunk = fh.read(65536)
                if not chunk:
                    break
                h.update(chunk)
        digest = h.hexdigest()
        _FILE_HASH_CACHE[path] = digest
        return digest
    except OSError as exc:
        logger.warning("file_sha256 失败 path=%s err=%s", path, exc)
        return None


def dedupe_image_assets(
    slices_assets: Sequence[Sequence[ImageAsset]],
) -> Tuple[List[ImageAsset], dict]:
    """跨切片资产去重 + 同名冲突重命名。

    规则：
        1. 同 ``filename`` 同 ``sha256`` → 视为同图，仅保留首张。
        2. 同 ``filename`` 不同 ``sha256`` → 后者重命名为 ``b{slice}_{原名}`` 并
           物理移动文件；建立 rename_map 供后续 markdown rewrite。
        3. 不同 ``filename`` → 各自保留。
        4. SHA-256 失败（任一方）→ 走原名保留（fail-open，避免误删图）。

    Args:
        slices_assets: 按切片索引顺序的 asset 列表序列。

    Returns:
        ``(merged_assets, rename_map)``：
            - ``merged_assets``：合并去重后的 ImageAsset 列表（落盘文件已就位）。
            - ``rename_map``：``{(slice_idx, 原 filename): 新 filename}``，供
              :func:`rewrite_image_refs_in_markdown` 按切片回写引用。
    """
    seen: dict[str, Tuple[Optional[str], ImageAsset]] = {}
    out: List[ImageAsset] = []
    rename_map: dict = {}

    for slice_idx, assets in enumerate(slices_assets):
        for asset in assets:
            sha = _file_sha256(asset.image_path) if asset.image_path else None
            fname = asset.filename
            if fname in seen:
                existing_sha, _ = seen[fname]
                if sha is not None and existing_sha == sha:
                    # 同图，跳过
                    continue
                # 撞名不同图 → 重命名后者
                new_name = f"b{slice_idx}_{fname}"
                renamed = _rename_asset_on_disk(asset, new_name)
                out.append(renamed)
                rename_map[(slice_idx, fname)] = new_name
                seen[new_name] = (sha, renamed)
            else:
                seen[fname] = (sha, asset)
                out.append(asset)

    return out, rename_map


def _rename_asset_on_disk(asset: ImageAsset, new_name: str) -> ImageAsset:
    """把 asset 在磁盘上重命名为 ``new_name``，返回新 ImageAsset。

    若源文件不存在或重命名失败，仍返回带新 filename 的虚拟 asset（image_path
    指向原路径），避免阻塞合并流程。
    """
    try:
        if not asset.image_path:
            return ImageAsset(
                filename=new_name,
                mime_type=asset.mime_type,
                image_path="",
                resource_uri=None,
                width=asset.width,
                height=asset.height,
                caption=asset.caption,
                page_number=asset.page_number,
            )
        src = Path(asset.image_path)
        dest = src.parent / new_name
        if src.exists():
            if dest.exists() and dest.resolve() != src.resolve():
                # 目标已存在不同文件 → 不覆盖，保留源文件用 dest 名引用
                logger.warning(
                    "重命名目标已存在 src=%s dest=%s，跳过物理 rename", src, dest
                )
            else:
                src.rename(dest)
        return ImageAsset(
            filename=new_name,
            mime_type=asset.mime_type,
            image_path=str(dest.resolve()) if dest.exists() else asset.image_path,
            resource_uri=None,
            width=asset.width,
            height=asset.height,
            caption=asset.caption,
            page_number=asset.page_number,
        )
    except OSError as exc:
        logger.warning("asset 重命名失败 %s -> %s: %s", asset.filename, new_name, exc)
        return ImageAsset(
            filename=new_name,
            mime_type=asset.mime_type,
            image_path=asset.image_path,
            resource_uri=None,
            width=asset.width,
            height=asset.height,
            caption=asset.caption,
            page_number=asset.page_number,
        )


# ---------------------------------------------------------------------------
# Markdown 图片引用 rewrite
# ---------------------------------------------------------------------------


def rewrite_image_refs_in_markdown(markdown: str, rename_map: dict) -> str:
    """按 rename_map 把 markdown 中的图片文件名替换为新名。

    Args:
        markdown: 原 markdown 文本。
        rename_map: ``{原 filename: 新 filename}``，单切片内的映射子集。

    Returns:
        替换后的 markdown。覆盖 ``![alt](filename)``、``<img src="filename">``
        以及相对路径形式 ``./images/filename``。使用单词边界（非 ``[\\w.-]``）保护
        避免误伤同名子串。
    """
    if not rename_map or not markdown:
        return markdown
    out = markdown
    for old, new in rename_map.items():
        if not old or not new or old == new:
            continue
        pattern = re.escape(old)
        # 负向 lookbehind 仅排除 [\w.-]（文件名内部字符）：
        # 路径分隔符 `/`、`\` 不在其中 → 允许 `./images/img.png` 命中；
        # 同时 `img.png.bak` 因后置 `.` 被负向 lookahead 屏蔽不变。
        out = re.sub(rf"(?<![\w.\-]){pattern}(?![\w.\-])", new, out)
    return out


# ---------------------------------------------------------------------------
# 边界 Figure caption 救援
# ---------------------------------------------------------------------------

_FIGURE_CAPTION_HEAD = re.compile(
    r"^\s*(?:Figure|Fig\.?|Table|Tab\.?)\s+\d+",
    re.IGNORECASE,
)
"""Figure caption 起手识别（与 assembly._FIGURE_TABLE_CAPTION_RE 语义一致）。"""

_IMG_BLOCK = re.compile(
    r"^\s*(?:!\[[^\]]*\]\([^)]+\)|<img\s[^>]*/?>(?:</img>)?|<figure[\s>].*?</figure>)\s*$",
    re.IGNORECASE | re.DOTALL,
)
"""Markdown 独立图片段识别（不含正文文字）。"""


def _paragraph_is_caption(text: str) -> bool:
    """段落是否以 Figure/Table caption 起手且非纯图片块。"""
    s = text.strip()
    if not s:
        return False
    if _IMG_BLOCK.fullmatch(s):
        return False
    return bool(_FIGURE_CAPTION_HEAD.match(s))


def _paragraph_is_image(text: str) -> bool:
    """段落是否为独立图片块（含 figure 容器）。"""
    s = text.strip()
    if not s:
        return False
    return bool(_IMG_BLOCK.fullmatch(s))


def boundary_figure_caption_rescue(
    slice_a_markdown: str, slice_b_markdown: str
) -> Tuple[str, str]:
    """跨切片 Figure caption 救援。

    检测两种典型断裂模式并修复：

    - **case 1**: ``slice_a`` 尾段是 ``Figure N: ...`` caption，``slice_b`` 首段
      是独立 ``<img>``。修复：把 caption 移到 ``slice_b`` 图片之后。
    - **case 2**: ``slice_a`` 尾段是独立 ``<img>``，``slice_b`` 首段是
      ``Figure N: ...`` caption。修复：把 caption 移到 ``slice_a`` 图片之后。

    其它情况原样返回，绝不破坏既有结构。

    Returns:
        ``(rescued_a, rescued_b)``。
    """
    if not slice_a_markdown or not slice_b_markdown:
        return slice_a_markdown, slice_b_markdown

    a_paragraphs = [p for p in slice_a_markdown.split("\n\n") if p.strip()]
    b_paragraphs = [p for p in slice_b_markdown.split("\n\n") if p.strip()]
    if not a_paragraphs or not b_paragraphs:
        return slice_a_markdown, slice_b_markdown

    a_tail = a_paragraphs[-1]
    b_head = b_paragraphs[0]

    if _paragraph_is_caption(a_tail) and _paragraph_is_image(b_head):
        new_a = "\n\n".join(a_paragraphs[:-1])
        new_b = "\n\n".join([b_head, a_tail.strip(), *b_paragraphs[1:]])
        logger.info("boundary caption rescue: 移动 a_tail caption 到 b 图后 (case1)")
        return new_a, new_b

    if _paragraph_is_image(a_tail) and _paragraph_is_caption(b_head):
        new_a = "\n\n".join([*a_paragraphs, b_head.strip()])
        new_b = "\n\n".join(b_paragraphs[1:])
        logger.info("boundary caption rescue: 移动 b_head caption 到 a 图后 (case2)")
        return new_a, new_b

    return slice_a_markdown, slice_b_markdown


# ---------------------------------------------------------------------------
# Markdown 切片拼接
# ---------------------------------------------------------------------------


def merge_slice_markdowns(
    slice_markdowns: Sequence[str],
    slice_ranges: Sequence[Tuple[int, int]],
    *,
    boundary_marker: bool = True,
) -> str:
    """跨切片合并 markdown，先做 caption 救援再注入 boundary marker。

    Args:
        slice_markdowns: 各切片 markdown 文本（同序）。
        slice_ranges: 各切片 ``[start, end)`` 范围（与 markdown 同长度，同序）。
        boundary_marker: 是否在切片间注入 ``<!-- batch boundary -->`` HTML 注释。

    Returns:
        合并后的单一 markdown。空切片自动跳过。
    """
    if not slice_markdowns:
        return ""
    if len(slice_markdowns) != len(slice_ranges):
        raise ValueError(
            f"slice_markdowns 长度 ({len(slice_markdowns)}) 与 slice_ranges "
            f"({len(slice_ranges)}) 不匹配"
        )

    rescued: List[str] = list(slice_markdowns)
    for i in range(len(rescued) - 1):
        a, b = boundary_figure_caption_rescue(rescued[i], rescued[i + 1])
        rescued[i], rescued[i + 1] = a, b

    parts: List[str] = []
    for i, md in enumerate(rescued):
        if md and md.strip():
            parts.append(md.rstrip())
        if boundary_marker and i < len(rescued) - 1:
            s, e = slice_ranges[i + 1]
            parts.append(f"<!-- batch boundary: pages {s + 1}-{e} -->")

    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# 顶层合并入口
# ---------------------------------------------------------------------------


def merge_pipeline_results(
    results: Sequence[PipelineResult],
    slice_ranges: Sequence[Tuple[int, int]],
    *,
    total_pages: int,
    partial_failures: Optional[Sequence[Tuple[int, int, str]]] = None,
) -> MergedBatchResult:
    """合并多个切片的 ``PipelineResult`` 为单一 ``MergedBatchResult``。

    Args:
        results: 各切片 PipelineResult（仅含成功切片）。
        slice_ranges: 与 ``results`` 同序同长的 ``[start, end)`` 范围。
        total_pages: 原 PDF 真实总页数，用于覆盖 metadata 中的 page_count。
        partial_failures: 可选的失败切片列表 ``[(start, end, err), ...]``。

    Returns:
        合并后的 :class:`MergedBatchResult`。``results`` 为空但 partial_failures
        非空时 ``success=False``；两者均空时返回空合并结果。
    """
    if len(results) != len(slice_ranges):
        raise ValueError(
            f"results 长度 ({len(results)}) 与 slice_ranges "
            f"({len(slice_ranges)}) 不匹配"
        )

    partials: List[Tuple[int, int, str]] = list(partial_failures or [])

    if not results:
        return MergedBatchResult(
            markdown="",
            word_count=0,
            image_assets=[],
            images_count=0,
            tables_count=0,
            formulas_count=0,
            code_blocks_count=0,
            engines_used=[],
            stage_results={},
            metadata={
                "total_pages": total_pages,
                "batched": {"slices": 0, "ranges": []},
            },
            page_count=total_pages,
            success=False if partials else True,
            error="所有切片均失败" if partials else None,
            partial_failures=partials,
        )

    # 1. 资产去重
    slices_assets = [list(r.image_assets or []) for r in results]
    merged_assets, rename_map = dedupe_image_assets(slices_assets)

    # 2. 按切片 rewrite markdown 图片引用
    rewritten: List[str] = []
    for i, r in enumerate(results):
        slice_renames = {
            old: new for (slice_idx, old), new in rename_map.items() if slice_idx == i
        }
        md = r.markdown or ""
        if slice_renames:
            md = rewrite_image_refs_in_markdown(md, slice_renames)
        rewritten.append(md)

    # 3. markdown 拼接 + caption 救援 + boundary marker
    merged_markdown = merge_slice_markdowns(rewritten, slice_ranges)

    # 4. metadata 合并
    base_metadata = dict(results[0].metadata or {})
    base_metadata["total_pages"] = total_pages
    base_metadata["batched"] = {
        "slices": len(results),
        "ranges": [list(rg) for rg in slice_ranges],
    }
    if partials:
        base_metadata["partial_failures"] = [
            {"start": s, "end": e, "error": err} for s, e, err in partials
        ]

    # 5. 计数累加
    word_count = sum((r.word_count or 0) for r in results)
    tables_count = sum((r.tables_count or 0) for r in results)
    formulas_count = sum((r.formulas_count or 0) for r in results)
    code_blocks_count = sum((r.code_blocks_count or 0) for r in results)

    seen_engines: set = set()
    engines_used: List[str] = []
    for r in results:
        for eng in r.engines_used or []:
            if eng and eng not in seen_engines:
                engines_used.append(eng)
                seen_engines.add(eng)

    stage_results: dict = {}
    for r, (page_start, page_end) in zip(results, slice_ranges):
        for stage_name, stage_data in (r.stage_results or {}).items():
            stage_results[f"pages_{page_start}-{page_end}.{stage_name}"] = stage_data

    return MergedBatchResult(
        markdown=merged_markdown,
        word_count=word_count,
        image_assets=merged_assets,
        images_count=len(merged_assets),
        tables_count=tables_count,
        formulas_count=formulas_count,
        code_blocks_count=code_blocks_count,
        engines_used=engines_used,
        stage_results=stage_results,
        metadata=base_metadata,
        page_count=total_pages,
        success=True,
        error=None,
        partial_failures=partials,
    )
