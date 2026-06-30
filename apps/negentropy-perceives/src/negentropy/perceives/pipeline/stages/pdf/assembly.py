"""S8: Markdown 组装 Stage。

将各并行 Stage（文本、表格、公式、图片、代码）的输出合并为最终 Markdown 文档，
并执行格式化与图片引用规范化。

委托关系：
- ``markdown.formatter.MarkdownFormatter`` — Markdown 格式化管线
- ``markdown.image_ref_normalizer.normalize_image_references()`` — 图片引用规范化
"""

from __future__ import annotations

import html
import logging
import re
from typing import Dict, List, Optional, Tuple

from ...base import Stage, StageResult
from ...models import (
    AssemblyInput,
    AssemblyOutput,
    ExtractedCodeBlock,
    ExtractedFormula,
    ExtractedImage,
    ExtractedTable,
    TextBlock,
)
from ...registry import register_tool
from .._base import PDFToolBase

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 工具适配器
# ---------------------------------------------------------------------------


@register_tool("assembly.builtin_assembler")
class BuiltinAssembler(PDFToolBase):
    """内置 Markdown 组装器。

    将各 Stage 结果按阅读顺序合并为 Markdown 文档，
    并委托 ``MarkdownFormatter`` 和 ``normalize_image_references`` 做后处理。
    """

    tool_name = "builtin_assembler"

    def is_available(self) -> bool:
        return True

    async def _run(self, input_data: AssemblyInput) -> StageResult[AssemblyOutput]:
        """组装 Markdown 文档。"""
        try:
            from ....markdown.formatter import MarkdownFormatter
            from ....markdown.image_ref_normalizer import (
                normalize_image_references,
            )

            # 1. 收集所有内容元素
            elements: List[_ContentElement] = []
            # 无 bbox 公式（块级 + 行内）：通过文本块匹配回正文位置后升级为 LaTeX
            # （此前仅承接 ``formula_type == "block"`` 的孤儿，``inline`` 公式被静默丢弃，
            # 详见 issue.md ISSUE-094 R5）。inline 与 block 共池统一兜底，
            # ``_formula_to_markdown`` 内按 ``formula_type`` 决定 ``$...$`` 或 ``$$...$$`` 包裹。
            _orphan_formulas: List[ExtractedFormula] = []

            # 1a. 构建专用 Stage 的空间占用索引（page → bbox 列表），
            #     用于在添加文本块时进行反向去重：当文本块落入公式/表格/图片
            #     区域时，优先保留专用 Stage 的高保真输出，跳过文本块的冗余版本。
            #
            # 公式 bbox 膨胀：PyMuPDF 把公式视觉区域内的下标 / 上标 / 极限项
            # （如 ``\bigcup _ {e \in E_{rel}}``）按字符行拆为多个独立文本块，
            # 其 bbox 中心常落在 MinerU 报告的公式 bbox 之外 ~5-10pt，
            # 致使 ``_block_overlaps_special`` 的中心点包含 / IoU 双策略均判空。
            # 给公式 bbox 加 8pt 各向余量，使形如 ``C = [`` 这类碎片中心点
            # 进入扩展区域被识别为冗余而过滤，不影响 KaTeX 渲染主公式。
            _FORMULA_BBOX_MARGIN_PT = 8.0
            special_regions: Dict[int, List[Tuple[float, float, float, float]]] = {}
            for formula in input_data.formulas.formulas if input_data.formulas else []:
                if formula.bbox:
                    fx0, fy0, fx1, fy1 = formula.bbox
                    expanded = (
                        fx0 - _FORMULA_BBOX_MARGIN_PT,
                        fy0 - _FORMULA_BBOX_MARGIN_PT,
                        fx1 + _FORMULA_BBOX_MARGIN_PT,
                        fy1 + _FORMULA_BBOX_MARGIN_PT,
                    )
                    special_regions.setdefault(formula.page_number, []).append(expanded)
            for table in input_data.tables.tables if input_data.tables else []:
                if table.bbox:
                    special_regions.setdefault(table.page_number, []).append(table.bbox)
            for img in input_data.images.images if input_data.images else []:
                if img.bbox:
                    special_regions.setdefault(img.page_number, []).append(img.bbox)

            # layout_analysis 的 ``figure`` region 通常覆盖完整 figure 视觉框
            # （含位图 + 矢量标签 + 标题）。image_extraction 仅给出位图位图本身的
            # bbox，对"位图周围的矢量标签（如 Figure 1 的 'Context 1.0..4.0'、
            # 'Context Input / Intelligence Level' 行）" 无法覆盖，导致这些标签
            # 作为独立 text block 落到 figure 下方破坏阅读流（ISSUE-094 R6）。
            # 把 layout figure region 也纳入 special_regions，让上述矢量标签
            # 通过 ``_block_overlaps_special`` 自然抑制；Figure caption（``Figure
            # N:`` / ``Table N:`` 起手）由后续 _is_figure_or_table_caption 守卫
            # 保留为段落，不被此处抑制。
            _layout_figure_regions: Dict[
                int, List[Tuple[float, float, float, float]]
            ] = {}
            if input_data.layout and input_data.layout.regions:
                for layout_region in input_data.layout.regions:
                    if (
                        layout_region.region_type in ("figure", "picture")
                        and layout_region.bbox
                    ):
                        special_regions.setdefault(
                            layout_region.page_number, []
                        ).append(layout_region.bbox)
                        _layout_figure_regions.setdefault(
                            layout_region.page_number, []
                        ).append(layout_region.bbox)

            # 1b. 预扫描：收集 table_extraction 阶段的表格指纹与文本块公式指纹
            #     表格指纹用于反向去重：当文本块表格与 table_extraction 输出重复时，
            #     优先保留 table_extraction 的高保真版本，跳过文本块的原始版本。
            table_extraction_fingerprints: set[str] = set()
            text_formula_fingerprints: set[str] = set()
            # 公式字符级扁平签名（按页索引）：用于过滤 PyMuPDF 把 LaTeX 视觉
            # 渲染区抽成"字符流文本"产生的冗余文本块。例如长式
            # ``M _ { l } = f _ { l o n g } \\left( c \\in C : w _ { i m p o r t a n c e }
            # ( c ) > \\theta _ { l } \\wedge w _ { t e m p o r a l } ( c )
            # \\le \\theta _ { s } \\right)\\tag{6}`` 与 PyMuPDF 抽出的
            # ``M l = f long ( c ∈ C : w importance ( c ) > θ l ∧ w temporal
            # ( c ) ≤ θ s ) ( 6 )`` 经签名归一化后几乎完全相同，可由
            # ``_text_block_matches_formula`` 在文本块入栈前剔除冗余版本。
            # 仅当公式签名 ≥20 字符时启用，避免短公式（如 ``\\alpha = 0``）
            # 与正文段产生假阳性匹配。
            formula_text_signatures: Dict[int, List[str]] = {}
            if input_data.formulas:
                for formula in input_data.formulas.formulas:
                    if formula.latex and formula.page_number is not None:
                        sig = _formula_text_signature(formula.latex)
                        if len(sig) >= 20:
                            formula_text_signatures.setdefault(
                                formula.page_number, []
                            ).append(sig)
            if input_data.tables:
                for table in input_data.tables.tables:
                    md = table.markdown.strip() if table.markdown else ""
                    if md.startswith("|"):
                        fp = _extract_table_fingerprint(md)
                        if fp:
                            table_extraction_fingerprints.add(fp)
            if input_data.text and input_data.text.blocks:
                for block in input_data.text.blocks:
                    text = block.text.strip()
                    # 公式指纹：LaTeX 核心内容（去除空白）
                    if "$$" in text:
                        for m in re.finditer(r"\$\$(.*?)\$\$", text, re.DOTALL):
                            core = m.group(1).strip().replace(" ", "")
                            if len(core) > 10:
                                text_formula_fingerprints.add(core)

            # 文本块（反向去重：跳过落入专用 Stage 区域的文本块）
            if input_data.text and input_data.text.blocks:
                for block in input_data.text.blocks:
                    if _block_overlaps_special(
                        block, special_regions, iou_threshold=0.3
                    ):
                        # figure-region 抑制本意是滤除图周矢量标签（坐标轴刻度
                        # ``10 3 10 2 10 1``、面板标记 ``(a) (b)`` 等短碎片）。但
                        # layout figure region 常过大，会把紧随图表的真实内容——
                        # section 标题（``4 Corroborating Claims...``）、导言段落——
                        # 一并吞没，致结构性内容丢失。改为按内容实质性区分而非
                        # ``全抑制``：
                        #   1. ``Figure N:`` / ``Table N:`` caption 恒保留；
                        #   2. 实质文本块（含 ≥2 个 ≥3 字母英文词，涵盖标题与
                        #      段落）放行至下方通用处理（含 byline / table-caption /
                        #      metadata 降级守卫）；
                        #   3. 仅抑制缺乏实质英文词的低内容碎片（轴刻度 / 面板标签）。
                        if _is_figure_or_table_caption_text(block.text):
                            elements.append(
                                _ContentElement(
                                    reading_order=block.reading_order,
                                    page_number=block.page_number,
                                    element_type="text",
                                    content=_text_block_to_markdown(block),
                                    block=block,
                                )
                            )
                            continue
                        if _is_low_content_figure_label(block.text):
                            continue
                    # 字符级签名兜底：剔除 PyMuPDF 把公式视觉渲染区抽成
                    # "字符流文本"产生的冗余文本块（典型如长式 ``M_l = f_long(...)``
                    # 的 PyMuPDF 字符序列与 MinerU LaTeX 经签名归一化后等价）
                    if _text_block_matches_formula(block, formula_text_signatures):
                        continue
                    # 跳过学术论文页眉/页脚残留文本
                    if _is_running_header_footer(block.text, block.page_number):
                        continue
                    # 跳过文本块中的表格：当 table_extraction 已提供高保真版本时，
                    # 不再使用文本块的原始表格（避免重复且质量更差）
                    if block.text.strip().startswith("|"):
                        fp = _extract_table_fingerprint(block.text.strip())
                        if fp and fp in table_extraction_fingerprints:
                            continue
                        # 跳过 TOC（目录）文本表：列对齐错乱、点 leader、
                        # 页码列，Markdown 无可靠的章节锚点
                        if _is_toc_table_text(block.text):
                            continue
                    # 作者署名行（含 ∗†‡ 或邮箱标记，或多作者 affiliation 模式）
                    # 误识为 heading 时降级为正文段落，保留信息但脱离标题层级
                    if _is_author_byline(block):
                        elements.append(
                            _ContentElement(
                                reading_order=block.reading_order,
                                page_number=block.page_number,
                                element_type="text",
                                content=_byline_to_paragraph(block),
                                block=block,
                            )
                        )
                        continue
                    # 跳过 CCS Concepts 元数据标题
                    if _is_paper_metadata_heading(block):
                        continue
                    # 表格 caption（``Table N:``）误识为 heading 时降级为段落
                    if _is_table_caption(block):
                        elements.append(
                            _ContentElement(
                                reading_order=block.reading_order,
                                page_number=block.page_number,
                                element_type="text",
                                content=_table_caption_to_paragraph(block),
                                block=block,
                            )
                        )
                        continue
                    elements.append(
                        _ContentElement(
                            reading_order=block.reading_order,
                            page_number=block.page_number,
                            element_type="text",
                            content=_text_block_to_markdown(block),
                            block=block,
                        )
                    )

            # 表格 — 直接插入 table_extraction 阶段的高保真输出
            # （重复的文本块表格已在上方文本块收集阶段被过滤）
            if input_data.tables:
                for table in input_data.tables.tables:
                    table_md = _table_to_markdown(table)
                    # 跳过 TOC（目录）表：列错乱 + 点 leader + 页码列
                    if _is_toc_table_text(table_md):
                        continue
                    elements.append(
                        _ContentElement(
                            reading_order=table.reading_order,
                            page_number=table.page_number,
                            element_type="table",
                            content=table_md,
                            table=table,
                        )
                    )

            # 公式（有 bbox 的正常插入；无 bbox 的通过文本匹配升级为 LaTeX）
            if input_data.formulas:
                for formula in input_data.formulas.formulas:
                    if formula.bbox:
                        latex_core = (
                            formula.latex.strip().replace(" ", "")
                            if formula.latex
                            else ""
                        )
                        if (
                            len(latex_core) > 10
                            and latex_core in text_formula_fingerprints
                        ):
                            continue
                        md = _formula_to_markdown(formula)
                        if not md:
                            continue
                        elements.append(
                            _ContentElement(
                                reading_order=formula.reading_order,
                                page_number=formula.page_number,
                                element_type="formula",
                                content=md,
                                formula=formula,
                            )
                        )
                    elif formula.latex:
                        # 无 bbox 公式：块级与行内统一兜底
                        # （MinerU 对短公式如 ``CE: ( C, T ) → f_context (3)`` 常分类为 inline，
                        # 此分支前曾仅承接 block，inline 公式被静默丢弃，参见 ISSUE-094 R5）
                        _orphan_formulas.append(formula)

            # 代码块（去重：对 Docling 提取的代码块，检查同页文本块中
            #   是否存在高度相似的内容，避免 Docling 和 text_extraction
            #   同时输出同一段 prompt 模板内容）
            if input_data.code:
                for code_block in input_data.code.code_blocks:
                    # algorithm_detector 的代码块保留（伪代码通常比
                    # 文本提取的版本质量更高，且已被 fenced block 包裹）
                    if getattr(code_block, "is_algorithm", False):
                        elements.append(
                            _ContentElement(
                                reading_order=code_block.reading_order,
                                page_number=code_block.page_number,
                                element_type="code",
                                content=_code_block_to_markdown(code_block),
                                code_block=code_block,
                            )
                        )
                        continue
                    # Docling 代码块：与同页文本块逐个比较
                    _skip = False
                    code_words = set(
                        re.findall(r"[a-zA-Z_]{3,}", code_block.code.lower())
                    )
                    if code_words:
                        for elem in elements:
                            if (
                                elem.element_type != "text"
                                or not elem.block
                                or elem.page_number != code_block.page_number
                            ):
                                continue
                            block_words = set(
                                re.findall(
                                    r"[a-zA-Z_]{3,}",
                                    elem.block.text.lower(),
                                )
                            )
                            if not block_words:
                                continue
                            overlap = len(code_words & block_words)
                            ratio = overlap / max(len(code_words), 1)
                            if ratio > 0.7 and overlap > 20:
                                _skip = True
                                break
                    if _skip:
                        continue
                    elements.append(
                        _ContentElement(
                            reading_order=code_block.reading_order,
                            page_number=code_block.page_number,
                            element_type="code",
                            content=_code_block_to_markdown(code_block),
                            code_block=code_block,
                        )
                    )

            # 图片：落入表格 bbox 的散落图片（如表格内 logo）应予跳过，
            # 因为表格的 Markdown 版本已包含完整文本内容。
            # 同一页内 bbox 高度重叠的图片视为重复（不同引擎提取同一图），
            # 保留有 caption 的版本。
            table_bboxes: Dict[int, List[Tuple[float, float, float, float]]] = {}
            if input_data.tables:
                for table in input_data.tables.tables:
                    if table.bbox:
                        table_bboxes.setdefault(table.page_number, []).append(
                            table.bbox
                        )
            if input_data.images and input_data.images.images:
                # 先收集所有候选图片（排除落入表格区域的）
                image_candidates: List[ExtractedImage] = []
                for image in input_data.images.images:
                    if image.bbox and image.page_number in table_bboxes:
                        img_cx = (image.bbox[0] + image.bbox[2]) / 2
                        img_cy = (image.bbox[1] + image.bbox[3]) / 2
                        skip = False
                        for tx0, ty0, tx1, ty1 in table_bboxes[image.page_number]:
                            if tx0 <= img_cx <= tx1 and ty0 <= img_cy <= ty1:
                                skip = True
                                break
                        if skip:
                            continue
                    image_candidates.append(image)

                # 空间重叠去重：同页 bbox 中心点包含或 IoU > 0.3 的图片
                # 保留有 caption 的版本（不同引擎提取同一图时 caption 质量不同）
                removed: set[int] = set()
                for i in range(len(image_candidates)):
                    if i in removed:
                        continue
                    img_a = image_candidates[i]
                    if not img_a.bbox:
                        continue
                    for j in range(i + 1, len(image_candidates)):
                        if j in removed:
                            continue
                        img_b = image_candidates[j]
                        if img_a.page_number != img_b.page_number or not img_b.bbox:
                            continue
                        # 中心点包含：A 的中心落在 B 内 或 B 的中心落在 A 内
                        ca_x = (img_a.bbox[0] + img_a.bbox[2]) / 2
                        ca_y = (img_a.bbox[1] + img_a.bbox[3]) / 2
                        cb_x = (img_b.bbox[0] + img_b.bbox[2]) / 2
                        cb_y = (img_b.bbox[1] + img_b.bbox[3]) / 2
                        overlap = (
                            (
                                img_b.bbox[0] <= ca_x <= img_b.bbox[2]
                                and img_b.bbox[1] <= ca_y <= img_b.bbox[3]
                            )
                            or (
                                img_a.bbox[0] <= cb_x <= img_a.bbox[2]
                                and img_a.bbox[1] <= cb_y <= img_a.bbox[3]
                            )
                            or _compute_iou(img_a.bbox, img_b.bbox) > 0.3
                        )
                        if overlap:
                            # 移除没有 caption 的版本，都没有则移除后出现的
                            if img_b.caption and not img_a.caption:
                                removed.add(i)
                                break  # i 已被移除，无需继续比较
                            else:
                                removed.add(j)

                kept_indices = set(range(len(image_candidates))) - removed

                for idx in sorted(kept_indices):
                    image = image_candidates[idx]
                    elements.append(
                        _ContentElement(
                            reading_order=image.reading_order,
                            page_number=image.page_number,
                            element_type="image",
                            content=_image_to_markdown(image),
                            image=image,
                        )
                    )

            # 2. 五级稳定排序：page → column → y0 → x0 → reading_order
            #    - page：0-based 页码，前序 Stage 已在边界归一化
            #    - column：双栏布局列序（0=左/全宽, 1=右），单栏页全部为 0
            #    - y0：bbox 顶部纵坐标（TopLeft 坐标系），缺失时退化到 reading_order * 100
            #    - x0：bbox 左侧横坐标，作为同列内的水平序兜底
            #    - reading_order：稳定序兜底，保证同坐标元素遵循 Stage 内部序
            #
            #    双栏检测：通过分析每页元素的 x 中心点分布，寻找最大间隙。
            #    若间隙显著（>25% x 范围且 >80pt），将元素分配到左/右列。
            #    全宽元素（跨栏标题/图表）根据 x 中心就近分配。
            #
            #    无 bbox 的孤立元素排在同页定位内容之后。

            # 2a. 双栏布局检测：收集每页元素的 x 中心，识别列分界
            from collections import defaultdict

            _page_items: Dict[int, List[Tuple[_ContentElement, Tuple]]] = defaultdict(
                list
            )
            for elem in elements:
                page = max(0, elem.page_number or 0)
                bbox = _get_elem_bbox(elem)
                if bbox:
                    _page_items[page].append((elem, bbox))

            _column_map: Dict[int, int] = {}  # id(elem) → column index
            for page_num, items in _page_items.items():
                if len(items) < 4:
                    for elem, _ in items:
                        _column_map[id(elem)] = 0
                    continue

                # 收集 x 中心点
                x_centers = sorted((b[0] + b[2]) / 2 for _, b in items)

                # 寻找最大间隙
                max_gap = 0.0
                split_x = 0.0
                for i in range(len(x_centers) - 1):
                    gap = x_centers[i + 1] - x_centers[i]
                    if gap > max_gap:
                        max_gap = gap
                        split_x = (x_centers[i] + x_centers[i + 1]) / 2

                x_range = x_centers[-1] - x_centers[0]
                is_two_col = max_gap > max(x_range * 0.25, 80)

                # 稳健性二次校验：避免「首页装饰性元素散布两侧」被误判双栏。
                #
                # 典型反例（论文首页 / 报告封面）：
                #   - 顶部双 logo 一左一右
                #   - 中部 affiliation 编号、badges、社交链接散落于中央偏右
                #   - 主体为单列 H1 / 作者 / 摘要 / 图表
                # 上一步几何 gap 检测会因右侧装饰元素的 x 中心抬高 max_gap 略过阈值，
                # 而真正的双栏正文（ACM/IEEE）每列必有数个宽度 ≥100pt 的实质性段落。
                #
                # 因此要求：每列均含 ≥3 个 "实质性元素"（宽度 ≥100pt 且非跨栏），
                # 才认定为真双栏；否则强制降级为单列以保证阅读顺序自然。
                if is_two_col:
                    _SUBSTANTIAL_W_PT = 100.0
                    _MIN_SUBSTANTIAL_PER_COL = 3
                    full_width_thr = x_range * 0.7
                    col0_substantial = 0
                    col1_substantial = 0
                    for _, bx in items:
                        w = bx[2] - bx[0]
                        if w < _SUBSTANTIAL_W_PT or w > full_width_thr:
                            continue
                        xc = (bx[0] + bx[2]) / 2
                        if xc < split_x:
                            col0_substantial += 1
                        else:
                            col1_substantial += 1
                    if (
                        col0_substantial < _MIN_SUBSTANTIAL_PER_COL
                        or col1_substantial < _MIN_SUBSTANTIAL_PER_COL
                    ):
                        is_two_col = False

                for elem, bbox in items:
                    if is_two_col:
                        elem_width = bbox[2] - bbox[0]
                        if elem_width > x_range * 0.7:
                            _column_map[id(elem)] = 0
                        else:
                            x_center = (bbox[0] + bbox[2]) / 2
                            _column_map[id(elem)] = 0 if x_center < split_x else 1
                    else:
                        _column_map[id(elem)] = 0

            def _sort_key(
                elem: _ContentElement,
            ) -> Tuple[int, int, float, float, int]:
                page = elem.page_number if elem.page_number is not None else 0
                page = max(0, page)
                col = _column_map.get(id(elem), 0)
                bbox = _get_elem_bbox(elem)
                if bbox is not None:
                    y_pos = float(bbox[1])
                    x_pos = float(bbox[0])
                else:
                    # 孤立元素排在同页定位内容之后（1e6 远大于任何合理的 y0）
                    y_pos = 1_000_000.0 + elem.reading_order
                    x_pos = 0.0
                return (page, col, y_pos, x_pos, elem.reading_order)

            elements.sort(key=_sort_key)

            # 2.1 标题层级规范化：
            #     情况 A：首个标题为 H1 → 论文标题，后续标题下移一级
            #     情况 B：首个标题为 H2（学术论文常见）→ 提升为 H1 作为论文标题，
            #             后续标题也下移一级（与情况 A 相同）
            _first_h1_seen = False
            for elem in elements:
                content = elem.content.strip()
                if not content.startswith("#"):
                    continue
                level = len(content) - len(content.lstrip("#"))
                if level == 1 and not _first_h1_seen:
                    _first_h1_seen = True
                    continue  # 论文标题保持 H1
                if level == 2 and not _first_h1_seen:
                    # 无 H1 时，首个 H2 提升为论文标题
                    elem.content = "#" + content[level:]
                    _first_h1_seen = True
                    continue
                if _first_h1_seen:
                    # 后续标题下移一级，最大到 H5
                    new_level = min(level + 1, 5)
                    new_content = "#" * new_level + content[level:]
                    elem.content = new_content

            # 2.1b 标题质量过滤：S3 text_extraction 常将双栏正文段落
            #     误判为 H3/H4 标题。识别特征：
            #     a) 超长（> 100 字符）且含句号/问号等段落标点
            #     b) 以小写字母开头（真正标题首字母大写）
            #     c) 以 bullet（•）开头（列表项而非标题）
            for elem in elements:
                if elem.element_type != "text" or not elem.block:
                    continue
                if elem.block.block_type != "heading":
                    continue
                content = elem.content.strip()
                if not content.startswith("#"):
                    continue
                level = len(content) - len(content.lstrip("#"))
                heading_text = content[level:].strip()
                is_bad = False
                # 超长 + 段落标点 → 误判段落
                if len(heading_text) > 100 and (
                    "." in heading_text or "?" in heading_text
                ):
                    is_bad = True
                # 小写字母开头 → 句子片段
                elif heading_text and heading_text[0].islower():
                    is_bad = True
                # bullet 开头 → 列表项
                elif heading_text.startswith("• ") or heading_text.startswith("- "):
                    is_bad = True
                if is_bad:
                    elem.element_type = "text"
                    elem.content = heading_text

            # 2.1.1 算法/伪代码检测与去重
            #   若 code_detection 阶段已检测到算法块（is_algorithm），移除重叠文本块；
            #   否则按页拼接文本块后扫描算法模式，避免 PyMuPDF 将 Algorithm 拆分为
            #   多个短块导致单独检测时评分不足。
            _algo_code_elems = [
                e
                for e in elements
                if e.element_type == "code"
                and e.code_block
                and getattr(e.code_block, "is_algorithm", False)
            ]
            _algo_remove: set[int] = set()

            if _algo_code_elems:
                # code_detection 阶段已输出算法块：去重同页文本块
                for algo in _algo_code_elems:
                    algo_words = set(re.findall(r"[a-zA-Z_]{3,}", algo.content.lower()))
                    if not algo_words:
                        continue
                    for idx, elem in enumerate(elements):
                        if (
                            elem.element_type != "text"
                            or not elem.block
                            or elem.page_number != algo.page_number
                            or idx in _algo_remove
                        ):
                            continue
                        block_words = set(
                            re.findall(
                                r"[a-zA-Z_]{3,}",
                                elem.block.text.lower(),
                            )
                        )
                        if not block_words:
                            continue
                        overlap = len(algo_words & block_words)
                        ratio = overlap / max(len(algo_words), 1)
                        if ratio > 0.5 and overlap > 15:
                            _algo_remove.add(idx)
            else:
                # 无外部算法块：按页拼接文本后扫描算法模式
                try:
                    from ....markdown.algorithm_detector import (
                        detect_algorithm_regions,
                    )

                    # 按页分组：page_number -> [(index, text)]
                    _page_texts: Dict[int, List[Tuple[int, str]]] = {}
                    for _eidx, _elem in enumerate(elements):
                        if _elem.element_type != "text" or not _elem.block:
                            continue
                        text = _elem.block.text.strip()
                        if not text:
                            continue
                        _page_texts.setdefault(_elem.page_number, []).append(
                            (_eidx, text)
                        )

                    for _pgnum, _pitems in _page_texts.items():
                        # 拼接同页文本块（双换行分隔，模拟段落边界）
                        page_text = "\n\n".join(t for _, t in _pitems)
                        for region in detect_algorithm_regions(page_text):
                            if region.confidence < 0.5:
                                continue
                            # 找到算法区域中的关键文本，匹配回原始文本块
                            algo_words = set(
                                re.findall(
                                    r"[a-zA-Z_]{3,}",
                                    region.content.lower(),
                                )
                            )
                            if not algo_words:
                                continue
                            _newly_removed = False
                            for _piidx, _pitxt in _pitems:
                                if _piidx in _algo_remove:
                                    continue
                                block_words = set(
                                    re.findall(r"[a-zA-Z_]{3,}", _pitxt.lower())
                                )
                                if not block_words:
                                    continue
                                overlap = len(algo_words & block_words)
                                ratio = overlap / max(len(algo_words), 1)
                                if ratio > 0.3 and overlap > 5:
                                    _algo_remove.add(_piidx)
                                    _newly_removed = True
                            if _newly_removed:
                                # 用首个被移除块的位置信息创建代码元素
                                first_removed = next(
                                    e
                                    for i, e in enumerate(elements)
                                    if i in _algo_remove and e.page_number == _pgnum
                                )
                                elements.append(
                                    _ContentElement(
                                        reading_order=first_removed.reading_order,
                                        page_number=_pgnum,
                                        element_type="code",
                                        content=f"```algorithm\n{region.content}\n```",
                                    )
                                )
                except ImportError:
                    pass

            if _algo_remove:
                elements = [e for i, e in enumerate(elements) if i not in _algo_remove]
                # 新增的算法代码块需要在排序后的位置插入，重新排序
                elements.sort(key=_sort_key)

            # 2.2 无 bbox 公式：通过公式编号或数学符号在文本块中定位并替换
            #    策略 1：通过公式编号（``\quad (N)`` / ``\tag{N}`` / LaTeX 末尾 ``(N)``）匹配
            #    策略 2：通过数学符号 + 公式特征匹配（兜底，block 形式专用）
            #    inline 公式（短公式如 ``CE: (C, T) → f_context (3)``）走策略 1 为主，
            #    匹配后整段文本被 ``$...$`` 包裹（``_formula_to_markdown`` 按
            #    ``formula_type`` 自动选择 ``$`` 或 ``$$`` 包裹）。
            if _orphan_formulas:
                _used_formula_indices: set[int] = set()
                for elem in elements:
                    if elem.element_type != "text" or not elem.block:
                        continue
                    text = elem.block.text.strip()
                    if not text or text.startswith("#") or len(text) < 10:
                        continue
                    for fi, formula in enumerate(_orphan_formulas):
                        if fi in _used_formula_indices or not formula.latex:
                            continue
                        matched = False
                        # 策略 1：公式编号匹配（最可靠）— 兼容 LaTeX 多种编号写法
                        eq_num = _extract_formula_eq_number(formula.latex)
                        if eq_num is not None:
                            # 编号模式："(N)" / "( N )" 都接受
                            if re.search(r"\(\s*" + re.escape(eq_num) + r"\s*\)", text):
                                matched = True
                        # 策略 2：数学符号 + LaTeX 关键词匹配（短公式或无编号场景）
                        #   - block 短公式 / 无编号块公式（数学符号 + 名称双条件）；
                        #   - inline 独立短块（整段文本即公式，≤ 40 字符）——仅当文本元素
                        #     本身为公式而非散文段落时整体替换，避免误吞 prose；inline
                        #     希腊变量（α/β/θ）无 block 数学符号，放宽为"名称匹配即可"。
                        #   LaTeX 名经希腊字母 / 运算符 unicode 映射桥接文本层字形
                        #   （``\alpha``↔``α``、``\theta``↔``θ``、``\approx``↔``≈``）。
                        is_block = formula.formula_type == "block"
                        is_inline_short = (
                            formula.formula_type == "inline" and len(text) <= 40
                        )
                        if not matched and (is_block or is_inline_short):
                            _math_symbols = [
                                "→",
                                "∑",
                                "∈",
                                "∪",
                                "⊆",
                                "θ",
                                "φ",
                                "≥",
                                "≤",
                                "∧",
                                "…",
                            ]
                            _has_math = any(s in text for s in _math_symbols)
                            latex_ids = re.findall(r"\\[a-zA-Z]+", formula.latex)
                            _latex_names = [
                                n.replace("\\", "")
                                for n in latex_ids
                                if n
                                not in (
                                    "\\quad",
                                    "\\colon",
                                    "\\to",
                                    "\\left",
                                    "\\right",
                                    "\\dots",
                                    "\\text",
                                    "\\tag",
                                    "\\mathrm",
                                )
                            ]
                            # LaTeX 命令名 → unicode 字形（greek 字母 / 运算符）
                            _LATEX_GLYPH = {
                                "alpha": "α",
                                "beta": "β",
                                "gamma": "γ",
                                "delta": "δ",
                                "theta": "θ",
                                "phi": "φ",
                                "varphi": "ϕ",
                                "psi": "ψ",
                                "omega": "ω",
                                "lambda": "λ",
                                "mu": "μ",
                                "sigma": "σ",
                                "epsilon": "ε",
                                "eta": "η",
                                "zeta": "ζ",
                                "nu": "ν",
                                "tau": "τ",
                                "rho": "ρ",
                                "kappa": "κ",
                                "chi": "χ",
                                "Phi": "Φ",
                                "Theta": "Θ",
                                "Omega": "Ω",
                                "Gamma": "Γ",
                                "Delta": "Δ",
                                "Lambda": "Λ",
                                "Sigma": "Σ",
                                "Psi": "Ψ",
                                "approx": "≈",
                                "times": "×",
                                "cdot": "·",
                                "le": "≤",
                                "ge": "≥",
                                "ne": "≠",
                                "sum": "∑",
                                "in": "∈",
                                "cup": "∪",
                                "cap": "∩",
                                "subseteq": "⊆",
                                "rightarrow": "→",
                            }

                            def _name_in_text(name: str) -> bool:
                                # 仅认 unicode 字形（α/θ/≈/×/≤ 等）——这些字形几乎不出现在
                                # 非数学散文。丢弃 ascii 名 substring 路径，避免 ``\in``→"in"
                                # 误匹配 "Introduction"/"training" 等通用子串致短段被整体替换。
                                if not name:
                                    return False
                                glyph = _LATEX_GLYPH.get(name) or _LATEX_GLYPH.get(
                                    name.lower()
                                )
                                return glyph is not None and glyph in text

                            _name_match = any(_name_in_text(n) for n in _latex_names)
                            if is_block:
                                if _has_math and _name_match:
                                    matched = True
                            else:  # inline 独立短块
                                if _name_match and _latex_names:
                                    matched = True
                        if matched:
                            formula_md = _formula_to_markdown(formula)
                            elem.content = formula_md
                            elem.element_type = "formula"
                            elem.formula = formula
                            elem.block = None
                            _used_formula_indices.add(fi)
                            break

            # 2.4 公式-文本去重：已被公式 Stage 或孤儿匹配覆盖的文本块需移除。
            #    比较策略：提取公式元素中的等式编号（如 "(5)"、"( 5 )"），
            #    如果文本元素含相同编号且包含数学符号，视为重复并移除。
            _formula_eq_nums: set[str] = set()
            for elem in elements:
                if elem.element_type != "formula":
                    continue
                content = elem.content.strip()
                # 块级 ``$$...$$`` 与 inline ``$...$`` 公式均纳入编号采集，
                # 兼容 ISSUE-094 R5 中 inline 公式（如 ``$CE: (C,T) \\to f_{context} (3)$``）
                # 与同页 PyMuPDF 字符流文本（``CE: ( C, T ) → f context (3)``）的去重。
                if not (content.startswith("$$") or content.startswith("$")):
                    continue
                # 匹配 LaTeX 中的编号：
                # - ``(N)`` / ``( N )``（纯 LaTeX 源 OR 部分引擎渲染）
                # - ``\\tag{N}``（MinerU / 学术论文标准形式）
                # 两种形式均落入 ``_formula_eq_nums``，配合下方"文本块含
                # ``(N)`` + 数学符号 + 短长度 → 视为公式字符流冗余"规则，
                # 兜底 ``_text_block_matches_formula`` 对短公式签名
                # （<20 字符）无法启用的场景。
                for m in re.finditer(r"\(\s*(\d+)\s*\)", content):
                    _formula_eq_nums.add(m.group(1))
                for m in re.finditer(r"\\tag\s*\{\s*(\d+)\s*\}", content):
                    _formula_eq_nums.add(m.group(1))

            # 2.4.5 借入相邻文本段的编号：当公式 LaTeX 缺失 ``\\tag{N}`` /
            # ``\\quad (N)``（典型如 docling 抽取学术论文公式时仅出公式主体，
            # 编号 ``(N)`` 留在下方紧邻的 PyMuPDF 字符流文本段），扫描每个公式
            # 元素其后一个文本元素：若该文本段以编号 ``(N)`` 收尾、含数学符号、
            # 且长度短小，则把编号 ``N`` 借入 ``_formula_eq_nums`` —— 让 2.4
            # 段的"公式-文本去重"规则能命中此文本段并剔除。同一缺陷既保留
            # LaTeX 公式渲染，又清空 OCR 错字版本的 PyMuPDF 字符流副本。
            _math_chars_borrow = set("∈∀∃∑∏∫→←↔≤≥≠≈θφψωαβγδ∧∨∪⊆")
            _BORROW_TRAILING_NUM_RE = re.compile(r"\(\s*(\d+)\s*\)\s*$")
            for i, elem in enumerate(elements):
                if elem.element_type != "formula":
                    continue
                fc = elem.content.strip()
                if not (fc.startswith("$$") or fc.startswith("$")):
                    continue
                # 已有编号则跳过
                if re.search(r"\(\s*\d+\s*\)", fc) or re.search(
                    r"\\tag\s*\{\s*\d+\s*\}", fc
                ):
                    continue
                # 公式后紧邻的文本元素
                if i + 1 >= len(elements):
                    continue
                nxt = elements[i + 1]
                if nxt.element_type != "text" or nxt.block is None:
                    continue
                nxt_text = nxt.content.strip()
                if not nxt_text or nxt_text.startswith("#") or len(nxt_text) >= 200:
                    continue
                borrow_match = _BORROW_TRAILING_NUM_RE.search(nxt_text)
                if not borrow_match:
                    continue
                if not any(c in nxt_text for c in _math_chars_borrow):
                    continue
                _formula_eq_nums.add(borrow_match.group(1))
            if _formula_eq_nums:
                _math_chars = set("∈∀∃∑∏∫→←↔≤≥≠≈θφψωαβγδ∧∨")
                elements = [
                    elem
                    for elem in elements
                    if not (
                        elem.element_type == "text"
                        and elem.block is not None
                        and re.search(
                            r"\(\s*("
                            + "|".join(re.escape(n) for n in _formula_eq_nums)
                            + r")\s*\)",
                            elem.content,
                        )
                        and any(c in elem.content for c in _math_chars)
                        and len(elem.content.strip()) < 200
                        and not elem.content.strip().startswith("#")
                    )
                ]

            # 2.5 inline 公式提升：当 mineru / docling 漏抽某些短公式（典型如
            # ``CE: (C, T) → f_context (3)``、``f_context(C) = F(\phi_1, ...)(C) (4)``）
            # 且文本元素整段即由数学符号 + 编号构成时，把整段包裹为 ``$...$``，
            # 让 UI 端 ``remark-math + rehype-katex`` 渲染为 KaTeX 公式。
            # 严苛守卫避免误吞普通段落：
            #   a) 段落起始 / 结尾各含 ≥ 1 个数学符号（``→ ∈ ⊆ ≤ ≥ ∧ ∨`` 等）；
            #   b) 段尾紧邻 ``(N)`` 形式编号（去除编号后剩余 < 100 字符）；
            #   c) 整段不含句号、问号、感叹号等"自然语言结束符"；
            #   d) 不以 markdown 元字符（``# > * - |``）起手。
            # 修复细节：把段尾 ``(N)`` 抽出作为 ``\\tag{N}`` 嵌入 LaTeX，公式正文
            # 保留 PyMuPDF 字符流形态（KaTeX 容忍小语法瑕疵；不改写主体避免引入
            # 二阶失真）。
            _INLINE_PROMOTE_END_RE = re.compile(r"\s*\(\s*(\d+)\s*\)\s*$")
            # 数学符号集：覆盖关系、量词、小写希腊字母（含小 phi 变体）、集合论符号
            # 拓展自第 2.4 段去重所用集合，增加 ``ϕ φ θ Φ Θ`` 多形态防止 PDF 字体
            # 渲染差异下漏判（``ϕ`` U+03D5 与 ``φ`` U+03C6 在不同 PDF 字体里都常见）。
            _math_chars_inline = set("∈∀∃∑∏∫→←↔≤≥≠≈θφϕψωαβγδ∧∨∪⊆ΦΘΨΩΓΔ")
            for elem in elements:
                if elem.element_type != "text" or elem.block is None:
                    continue
                content = elem.content.strip()
                if not content:
                    continue
                # 已经是公式 / 标题 / 代码块 / 引用 / 列表 / 表格 → 跳过
                if content.startswith(("#", ">", "*", "-", "|", "$", "```", "<")):
                    continue
                promote_match = _INLINE_PROMOTE_END_RE.search(content)
                if not promote_match:
                    continue
                eq_num = promote_match.group(1)
                core = content[: promote_match.start()].rstrip()
                # 去除编号后长度限制（避免吞下整段引用文献）
                if not (5 <= len(core) <= 120):
                    continue
                # 含至少一个数学符号
                if not any(c in core for c in _math_chars_inline):
                    continue
                # 不应含自然语言句尾标点（避免误吞带 (N) 引用的普通段落）。
                # PDF 提取常把省略号拆为 ``. . .`` 三个独立点带空格，省略号、小数、
                # 复合编号都不能命中。``。 ! ? ！ ？`` 直接拦截。
                if any(ch in core for ch in ("。", "?", "!", "！", "？")):
                    continue
                # 真正的句号特征：``.`` 后紧邻空白 + 大写字母（句首），或行尾。
                # 限定句首字母 ``[A-Z]`` 才视为句号，与省略号片段 ``. . `` / ``. ϕ`` 区分。
                if re.search(r"\.\s+[A-Z]", core) or core.rstrip().endswith("."):
                    continue
                # 公式 LaTeX 主体保留 PyMuPDF 字符流，编号以 ``\\quad (N)`` 紧附
                # （KaTeX 限制：``\\tag{}`` 仅支持 display equation，inline ``$...$``
                # 使用 ``\\tag`` 会触发 ParseError "tag works only in display equations"。
                # ``\\quad (N)`` 在 inline 与 display 模式都有效）。
                latex = f"{core} \\quad ({eq_num})"
                elem.content = f"${latex}$"
                elem.element_type = "formula"
                elem.block = None
                logger.debug(
                    "[assembly:promote_inline_formula] eq=%s core_len=%d core_preview=%r",
                    eq_num,
                    len(core),
                    core[:80],
                )

            # 2.5.5 公式残片清理：PyMuPDF 在公式视觉区抽取 text block 时，对长
            # 公式（含 ``\bigcup`` / ``\sum`` / 矩阵等多行结构）常仅抽出公式起手
            # 残片（典型如 ``C = [``、``M_l =``、``x = \{``），与公式 stage 的 LaTeX
            # 主体重复出现却互相不命中签名兜底（残片字符不足 20 触发 ``_formula_text_signature``
            # 的最小长度阈值）。清理判据：text element 内容 ≤ 15 字符 + 形如
            # ``<Identifier> = <Open-Bracket>`` 模式 + 紧邻下一个 element 是公式
            # → 视为公式残片剔除，避免视图中"残片 + 公式"并存（ISSUE-094 R8）。
            _FORMULA_FRAGMENT_RE = re.compile(r"^\s*[A-Za-z]\w*\s*=\s*[\[\(\{]\s*$")
            _fragment_remove: set[int] = set()
            for i, elem in enumerate(elements):
                if elem.element_type != "text" or elem.block is None:
                    continue
                content = elem.content.strip()
                if not content or len(content) > 15:
                    continue
                if not _FORMULA_FRAGMENT_RE.match(content):
                    continue
                # 必须紧邻下一个公式元素才视为残片（否则可能是合法的赋值起手）
                next_idx = i + 1
                while next_idx < len(elements):
                    nxt = elements[next_idx]
                    if nxt.element_type == "formula":
                        _fragment_remove.add(i)
                        break
                    # 遇到非空 text 即停止搜索（中间仅允许空白元素通过）
                    if nxt.element_type == "text" and (nxt.content or "").strip():
                        break
                    next_idx += 1
            if _fragment_remove:
                elements = [
                    e for i, e in enumerate(elements) if i not in _fragment_remove
                ]

            # 2.5.6 公式序号 gap-consistency 推断回填（ISSUE-094 R9 D-2/D-3/D-4）：
            # Docling ``iterate_items`` 路径下抽取的公式 LaTeX 主体常不带
            # ``\\tag{N}`` / ``\\quad (N)`` 编号，UI 视图等式编号缺失。
            # 利用学术论文连续编号习惯，按相邻有编号公式之间的 gap 是否
            # 与未编号公式数一致来保守填补（不一致则放弃，避免误编号）。
            _formula_block_elements: List[Tuple[int, _ContentElement]] = [
                (i, e)
                for i, e in enumerate(elements)
                if e.element_type == "formula"
                and e.formula is not None
                and e.content.strip().startswith("$$")
            ]
            if len(_formula_block_elements) >= 2:
                _ext_nums: List[Optional[int]] = []
                for _, fe in _formula_block_elements:
                    # 注：``_extract_formula_eq_number`` 已涵盖 ``\\tag{N}`` /
                    # ``\\quad (N)`` 与裸尾部 ``(N)\\s*$`` 三种形态（含 R9 D-5
                    # 剥离 ``&`` 后的 Eq (2) 形态），无需再叠加 tail 兜底正则。
                    eq_str = _extract_formula_eq_number(
                        (fe.formula.latex or "") if fe.formula else ""
                    )
                    _ext_nums.append(int(eq_str) if eq_str is not None else None)
                _inferred = _infer_missing_formula_numbers(_ext_nums)
                for idx_in_list, inferred_num in _inferred.items():
                    _, target_elem = _formula_block_elements[idx_in_list]
                    if target_elem.formula is None:
                        continue
                    old_latex = target_elem.formula.latex or ""
                    new_latex = f"{old_latex.rstrip()} \\quad ({inferred_num})"
                    target_elem.formula.latex = new_latex
                    target_elem.content = _formula_to_markdown(target_elem.formula)
                    logger.debug(
                        "[assembly:infer_formula_number] pos=%d inferred=%d "
                        "latex_preview=%r",
                        idx_in_list,
                        inferred_num,
                        old_latex[:80],
                    )

            # 2.5.7 图片 caption 邻接段注入（ISSUE-094 R9 D-6）：
            # 当 image_extraction 阶段未能从 PyMuPDF / Docling 关联到图片
            # caption（``image.caption`` 为空）、UI 显示 ``alt="<filename>"``
            # 退化为文件名，且文档顺序下一个 text element 是 ``Figure N:`` /
            # ``Fig. N:`` / ``Table N:`` 起手的 caption 段落时，把邻接段
            # 文本注入到 image，复用 2.6 段的 caption-vs-text 去重移除
            # 独立 caption 段落，恢复 PDF 中"图旁有 caption"视觉。
            for i, img_elem in enumerate(elements):
                if img_elem.element_type != "image" or img_elem.image is None:
                    continue
                existing_cap = (img_elem.image.caption or "").strip()
                # 搜索紧邻下一个非空 text element（跳过空白）
                next_text_content: Optional[str] = None
                for j in range(i + 1, len(elements)):
                    nxt = elements[j]
                    if nxt.element_type != "text" or nxt.block is None:
                        # 遇到非 text 元素（image / formula / table / code）→
                        # 邻接关系中断，不再继续搜索
                        break
                    candidate = (nxt.content or "").strip()
                    if not candidate:
                        continue
                    next_text_content = candidate
                    break
                injected = _figure_caption_to_inject(
                    image_has_caption=bool(existing_cap),
                    next_text_block_text=next_text_content,
                )
                if injected is None:
                    continue
                img_elem.image.caption = injected
                img_elem.content = _image_to_markdown(img_elem.image)
                logger.debug(
                    "[assembly:rescue_image_caption] image_id=%s injected=%r",
                    img_elem.image.image_id,
                    injected[:80],
                )

            # 2.6 图片 caption 与纯文本去重：
            #    当图片元素以 `![caption](path)` 形式输出后，
            #    若紧接着一个纯文本元素的内容与该 caption 高度相似
            #    （通常以 "Figure N:" 或 "Table N:" 开头），
            #    则移除该冗余纯文本元素。
            _img_captions: set[str] = set()
            for elem in elements:
                if elem.element_type == "image" and elem.image:
                    cap = (elem.image.caption or "").strip()
                    if cap:
                        _img_captions.add(_normalize_for_dedup(cap))
            if _img_captions:
                elements = [
                    elem
                    for elem in elements
                    if not (
                        elem.element_type == "text"
                        and elem.block is not None
                        and not elem.content.strip().startswith("#")
                        and len(elem.content.strip()) < 600
                        and any(
                            _is_caption_duplicate(
                                elem.content.strip(), ic, _img_captions
                            )
                            for ic in _img_captions
                            if len(ic) > 15
                        )
                    )
                ]

            # 2.7 去重：移除重复标题与重复 Figure/Table 注释
            #    标题去重：
            #    a) 两个相邻标题归一化后相同 → 移除前者（通常是 TOC 版本）
            #    b) 同一标题文本在不同页重复出现（如 "References"）→ 只保留首次
            #    注释去重：
            #    c) "Table N:" / "Figure N:" 开头的注释文本在不同元素中重复出现
            _seen: set[str] = set()
            _seen_caption: set[str] = set()
            _prev: str | None = None
            _dd: List[_ContentElement] = []
            for elem in elements:
                content = elem.content.strip()
                is_heading = content.startswith("#")
                if is_heading:
                    raw = content.lstrip("#").strip()
                    norm = re.sub(r"[.\s]+", " ", raw.lower())
                    # 场景 a: 紧邻重复标题（前一个也是标题）→ 移除前者
                    if _prev is not None and norm == _prev:
                        if _dd and _dd[-1].content.strip().startswith("#"):
                            _dd.pop()
                    # 场景 b: 非紧邻的重复标题（多页重复如 References）→ 跳过后续
                    elif norm in _seen:
                        _prev = norm
                        continue
                    _seen.add(norm)
                    _prev = norm
                else:
                    _prev = None
                    # 场景 c: 重复 Figure/Table 注释去重
                    # 仅提取 "Table/Figure N: ..." 注释文本部分进行指纹比较，
                    # 而非整个元素内容（表格元素包含完整 Markdown 表格）
                    # 对于图片元素，需要截断到图片标签语法结束符之前，
                    # 避免 path / 尺寸属性污染指纹。支持两种语法：
                    # 1) 标准 Markdown ``![alt](path)``
                    # 2) 内嵌 HTML ``<img src="..." alt="...">``（保留尺寸时）
                    cap_source = content
                    if elem.element_type == "image":
                        alt_md = re.match(r"!\[([^\]]*)\]\([^)]*\)", content)
                        if alt_md:
                            cap_source = alt_md.group(1)
                        else:
                            alt_html = re.search(
                                r'<img\b[^>]*\balt="([^"]*)"',
                                content,
                            )
                            if alt_html:
                                cap_source = html.unescape(alt_html.group(1))
                    cap_match = re.search(
                        r"((?:Table|Figure)\s+\d+[:.][^\n]+)",
                        cap_source,
                        re.IGNORECASE,
                    )
                    if cap_match:
                        cap_text = cap_match.group(1)
                        cap_norm = _normalize_for_dedup(cap_text)
                        if cap_norm in _seen_caption:
                            continue
                        _seen_caption.add(cap_norm)
                _dd.append(elem)
            elements = _dd

            # 3. 拼接 Markdown
            markdown_parts: List[str] = []
            for elem in elements:
                markdown_parts.append(elem.content)

            markdown = "\n\n".join(markdown_parts)

            # 4. 图片引用规范化
            images: List[ExtractedImage] = []
            if input_data.images:
                images = input_data.images.images

            # 构造 ImageMeta 兼容的适配对象
            class _ImageMetaAdapter:
                def __init__(self, img: ExtractedImage):
                    self._img = img

                @property
                def filename(self) -> Optional[str]:
                    return self._img.filename

                @property
                def caption(self) -> Optional[str]:
                    return self._img.caption

            adapted_images = [_ImageMetaAdapter(img) for img in images]
            markdown = normalize_image_references(markdown, adapted_images)

            # 5. Markdown 格式化
            formatter = MarkdownFormatter()
            markdown = formatter.format(markdown)

            word_count = len(markdown.split())

            output = AssemblyOutput(
                markdown=markdown,
                word_count=word_count,
                metadata={
                    "engine": "builtin_assembler",
                    "text_blocks": (
                        len(input_data.text.blocks) if input_data.text else 0
                    ),
                    "tables": (
                        input_data.tables.total_count if input_data.tables else 0
                    ),
                    "formulas": (
                        len(input_data.formulas.formulas) if input_data.formulas else 0
                    ),
                    "images": (
                        input_data.images.total_count if input_data.images else 0
                    ),
                    "code_blocks": (
                        input_data.code.total_count if input_data.code else 0
                    ),
                },
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.exception("Markdown 组装失败")
            return StageResult(success=False, error=f"Markdown 组装失败: {e}")


# ---------------------------------------------------------------------------
# 辅助数据结构
# ---------------------------------------------------------------------------


class _ContentElement:
    """内容元素包装，用于统一排序。"""

    __slots__ = (
        "reading_order",
        "page_number",
        "element_type",
        "content",
        "block",
        "table",
        "formula",
        "code_block",
        "image",
    )

    def __init__(
        self,
        reading_order: int,
        page_number: int,
        element_type: str,
        content: str,
        block: Optional[TextBlock] = None,
        table: Optional[ExtractedTable] = None,
        formula: Optional[ExtractedFormula] = None,
        code_block: Optional[ExtractedCodeBlock] = None,
        image: Optional[ExtractedImage] = None,
    ) -> None:
        self.reading_order = reading_order
        self.page_number = page_number
        self.element_type = element_type
        self.content = content
        self.block = block
        self.table = table
        self.formula = formula
        self.code_block = code_block
        self.image = image


# ---------------------------------------------------------------------------
# Markdown 转换辅助函数
# ---------------------------------------------------------------------------


def _extract_table_fingerprint(table_text: str) -> str:
    """提取 Markdown 表格的首行数据单元格指纹（用于去重比较）。

    跳过 separator 行（如 ``|---|---|``），取第一个含实际数据的行，
    去除管道符和空白后作为指纹。
    """
    for line in table_text.split("\n"):
        line = line.strip()
        if not line.startswith("|"):
            continue
        # 跳过 separator 行
        if set(line.replace("|", "").replace("-", "").replace(":", "").strip()) <= {
            " ",
        }:
            continue
        cells = [c.strip() for c in line.split("|") if c.strip()]
        if cells:
            return "|".join(cells)
    return ""


def _compute_iou(
    a: Tuple[float, float, float, float],
    b: Tuple[float, float, float, float],
) -> float:
    """计算两个 bbox 的交并比 (IoU)。"""
    x0 = max(a[0], b[0])
    y0 = max(a[1], b[1])
    x1 = min(a[2], b[2])
    y1 = min(a[3], b[3])
    inter = max(0.0, x1 - x0) * max(0.0, y1 - y0)
    if inter <= 0:
        return 0.0
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def _block_overlaps_special(
    block: TextBlock,
    special_regions: Dict[int, List[Tuple[float, float, float, float]]],
    iou_threshold: float = 0.3,
) -> bool:
    """判断文本块是否与专用 Stage 区域存在空间重叠。

    使用两种策略：
    1. 包含检测：文本块中心点落入特殊区域（文本块被大区域包裹）
    2. IoU 检测：文本块与特殊区域面积重叠超过阈值（尺寸接近的元素）
    """
    if not block.bbox:
        return False
    regions = special_regions.get(block.page_number)
    if not regions:
        return False
    bx0, by0, bx1, by1 = block.bbox
    for rx0, ry0, rx1, ry1 in regions:
        # 策略 1: 包含检测 — 文本块中心点落入特殊区域
        cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
        if rx0 <= cx <= rx1 and ry0 <= cy <= ry1:
            return True
        # 策略 2: IoU 检测 — 面积重叠
        if _compute_iou(block.bbox, (rx0, ry0, rx1, ry1)) >= iou_threshold:
            return True
    return False


def _formula_text_signature(s: str) -> str:
    """提取字符级扁平签名（仅保留字母数字，全部小写）。

    用于跨形式公式去重：
      - LaTeX 命令 ``\\xxx`` 全部剥除（``\\theta``、``\\in``、``\\wedge`` 等
        无文本字符等价，丢弃即可）；
      - ``\\begin{...}{...}`` / ``\\end{...}`` 排版结构（如 ``\\begin{array}{r}``
        的 ``array``/``r``/``l``/``c`` 列规格）整段剥除——这些是版式噪声而非
        公式语义字符，混入会膨胀 fsig 致碎片文本块的覆盖率失真；
      - 大括号 / 下标符号 / 标点 / 空白 / Unicode 数学符号 全部丢弃；
      - 仅保留 ASCII 字母数字。

    PyMuPDF 把 LaTeX 视觉渲染区抽成"字符流文本"时，对每个字形（含上下标）
    保留为独立字符，与 MinerU 提取的 LaTeX 字符序列（同样把 ``M _ { l }``
    拆为 ``M l`` 等）经归一化后几乎完全相同。该签名作为跨形式等价锚点。
    """
    # 先剥离开 \begin{...} / \end{...} 及其紧随的列规格 {...}（版式结构噪声）
    s = re.sub(r"\\(?:begin|end)\s*\{[^{}]*\}(?:\s*\{[^{}]*\})?", "", s)
    # 剥离 \xxx LaTeX 命令
    s = re.sub(r"\\[a-zA-Z]+\*?", "", s)
    # 仅保留 ASCII 字母数字
    return re.sub(r"[^a-zA-Z0-9]+", "", s).lower()


def _text_block_matches_formula(
    block: TextBlock,
    formula_signatures: Dict[int, List[str]],
) -> bool:
    """检测文本块是否为相邻公式 LaTeX 的字符级文本表示。

    ``_block_overlaps_special`` 的几何检测对"公式视觉区垂直之上 / 之下
    几十 pt 的字符流文本"覆盖不足；当 PyMuPDF 把公式视觉渲染区抽成
    独立文本字符串时，签名归一化后与公式 LaTeX 几乎完全一致，可由本
    函数作为语义层兜底拦截。

    匹配判据（两项同时满足时认为是冗余，过滤该文本块）：
      1. 前置条件：公式签名是文本块签名的子串（``fsig in text_sig``）；
      2. 长度比例：``len_ratio = len(fsig) / len(text_sig) ≥ 0.85``，
         即文本块签名几乎完全等于公式签名（典型 PyMuPDF 字符流抽取产物）。

    若仅满足前置条件但 ``len_ratio < 0.85``，认为公式只是被嵌入更长正文段，
    属于"公式埋在长正文段"假阳性，保守保留文本块不予过滤。

    仅在公式签名 ≥20 字符且文本块归一化后 ≥20 字符时启用，
    避免短公式 / 短文本互相假阳性。
    """
    page = block.page_number
    sigs = formula_signatures.get(page)
    if not sigs:
        return False
    text_sig = _formula_text_signature(block.text or "")
    if len(text_sig) < 20:
        return False
    for fsig in sigs:
        # 正向：完整公式签名是文本块签名的子串（PyMuPDF 把整个公式视觉区
        # 抽成一段字符流文本，签名与公式 LaTeX 几乎全等）。
        if fsig in text_sig:
            # 子串匹配 → 进一步判定长度比例，过滤"公式埋在长正文段"假阳性
            len_ratio = len(fsig) / max(len(text_sig), 1)
            if len_ratio >= 0.85:
                return True
        # 反向：文本块签名是公式签名的子串（PyMuPDF 把一个公式视觉区拆成
        # 多个碎片文本块，每块签名是完整公式签名的片段，正向 fsig-in-text_sig
        # 因 fsig 更长而失配）。要求文本块覆盖公式签名的较大比例(≥0.4)，
        # 避免短巧合子串误杀正文——公式签名为密集字母数字串、无词边界，
        # 正文连写词几乎不可能 ≥20 字符地落入其中，FP 风险极低。
        if text_sig in fsig:
            coverage = len(text_sig) / max(len(fsig), 1)
            if coverage >= 0.4:
                return True
    return False


def _get_elem_bbox(
    elem: _ContentElement,
) -> Optional[Tuple[float, float, float, float]]:
    """从内容元素中提取 bbox（优先级：image > block > table > formula > code）。"""
    if elem.image and elem.image.bbox:
        return elem.image.bbox
    if elem.block and elem.block.bbox:
        return elem.block.bbox
    if elem.table and elem.table.bbox:
        return elem.table.bbox
    if elem.formula and elem.formula.bbox:
        return elem.formula.bbox
    if elem.code_block and elem.code_block.bbox:
        return elem.code_block.bbox
    return None


# 页眉/页脚匹配模式（预编译，避免在循环中反复编译）
_RUNNING_HEADER_FOOTER_PATTERNS: List[re.Pattern] = [
    # ACM 会议论文页眉/页脚:含模板占位符 "Conference acronym" 的短文本
    # （函数已有 len>500 保护，误匹配正文风险极低）
    re.compile(r"\bConference\s+acronym\b", re.IGNORECASE),
    # DOI URL 行
    re.compile(r"^https?://(?:dx\.)?doi\.org/", re.IGNORECASE),
    # ACM 版权声明
    re.compile(r"^Permission\s+to\s+make\s+digital", re.IGNORECASE),
    # ACM Reference Format 行
    re.compile(r"^ACM\s+Reference\s+Format:", re.IGNORECASE),
    # ISSUE-094 R9 D-1b: 封面 GitHub 链接锚 ``§ Github`` / ``§ Code`` /
    # ``§ Project`` / ``§ Repository`` / ``§ Site`` / ``§ Demo`` / ``§ Website``
    # —— PDF 中 GitHub 图标下方的锚文本，``§`` 是装饰符而非章节号；
    # 限定第二段为单个英文单词（``§ 2.1`` 章节引用因含数字被排除）。
    re.compile(
        r"^\s*§\s+(?:Github|GitHub|Code|Project|Repository|Site|Demo|"
        r"Website|Page|Homepage|Source|Repo|Docs|Documentation)\s*$",
        re.IGNORECASE,
    ),
]


# 封面专属（page_number == 0）banner 模式 —— 仅在 PDF 封面页应用：
#
# ISSUE-094 R9 D-1b：论文封面常出现 ``<ACRONYM> <ProjectDescriptor>``
# 项目/机构 banner（典型如 ``SII Context``、``MIT Lab``、``SII GenAI``）；
# 限定首词为 2-5 ALL-CAPS 字母（``Federated``、``Quantum`` 等正常英文词
# 不会命中），第二词收紧为项目专用描述词白名单。
#
# R9 round 4 收紧（基于代码评审反馈）：从描述词白名单中**剔除**
# ``Research / Group / Center / Engineering / AI / ML / NLP`` 等过宽通用词，
# 避免正文短句 ``AI Research`` / ``ML Engineering`` / ``MIT Research``
# / ``LLM Research`` 在跨页内容中被静默吞掉；并通过 ``page_number == 0``
# 门控将该模式仅施加于封面页，body page 上 ``NLP Lab`` / ``GPT Lab``
# / ``ETH Institute`` 等合法段落不再受影响。
_COVER_BANNER_PATTERNS: List[re.Pattern] = [
    re.compile(
        r"^\s*[A-Z]{2,5}\s+"
        r"(?:Context|Lab|Project|Initiative|Institute|GenAI|Studio|Labs)\s*$"
    ),
]


def _normalize_for_dedup(text: str) -> str:
    """归一化文本用于去重比较：移除断字、智能引号、归一化破折号与空白。"""
    text = re.sub(r"(\w)-\s+(\w)", r"\1\2", text)
    text = text.replace("‘", "'").replace("’", "'")
    text = text.replace("“", '"').replace("”", '"')
    text = re.sub(r"[-–—*\s]+", " ", text)
    return text.lower().strip()


def _is_caption_duplicate(text: str, caption_norm: str, all_captions: set[str]) -> bool:
    """判断文本是否为图片 caption 的冗余副本。

    精确匹配归一化文本，或文本长度与 caption 接近（差异 < 30%）时的子串匹配。
    避免因子串包含而误删引用了 caption 的正文段落。
    """
    text_norm = _normalize_for_dedup(text)
    if text_norm == caption_norm:
        return True
    # 仅当文本长度与 caption 接近时才做子串检查，防止段落正文被误删
    if caption_norm in text_norm:
        ratio = len(caption_norm) / len(text_norm) if text_norm else 0
        if ratio > 0.7:
            return True
    return False


_FIGURE_TABLE_CAPTION_RE = re.compile(
    r"^\s*(Figure|Fig\.?|Table|Tab\.?)\s+\d+\s*[:.\-]",
    re.IGNORECASE,
)


def _is_figure_or_table_caption_text(text: str) -> bool:
    """判断文本块是否为 ``Figure N:`` / ``Table N:`` 起手的图表 caption。

    用作 ``_block_overlaps_special`` 命中后的例外保留判定：
    即使 caption 几何上落入 layout ``figure`` region，也必须保留为
    段落（它是图表的语义描述，正文阅读价值高）。模式兼容 ``Figure
    1:``、``Fig. 2:``、``Table 3.``、``Tab 4 -`` 等学术论文常见写法。
    """
    if not text:
        return False
    return bool(_FIGURE_TABLE_CAPTION_RE.match(text))


def _is_low_content_figure_label(text: str) -> bool:
    """判断落入 figure region 的文本块是否是缺乏实质内容的图周碎片。

    ``_block_overlaps_special`` 命中后，caption 已恒保留；本函数用于进一步区分
    "真实内容块"与"图周矢量标签碎片"，三信号判定：

    - 信号 A（缺实质英文词）：坐标轴刻度（``10 3 10 2 10 1``、``1 K 10 K``、
      ``10 −1``）、面板标记（``(a) (b)``）、单字轴标题（``Residual δ F``）——0~1 个
      ≥3 字母英文词。
    - 信号 C（2 词轴标题碎片）：``Training Step`` / ``Train Loss`` / ``Eval Loss`` /
      ``Training Step Δ`` 等——≤2 个 ≥3 字母英文词、且**无**章节编号前缀
      （``4.2 Behavioral Evidence`` / ``A Related Work`` 起首带编号 → 放行）、**无**
      句末标点。真实短标题多带章节编号或句末标点，且罕见落入 figure region。
    - 信号 B（刻度序列）：即便跟 2 词轴标题（``1 2 4 8 16 32 Feature index j``、
      ``10 20 30 Task index k``），出现 ≥3 个**相邻**纯数字 token（仅由空白/逗号/
      分号分隔）即为坐标轴刻度序列。要求"相邻 ≥3"以避免误伤正文里散落的章节引用
      （``Sec. 3 ... Sec. 3``、``sections 3, 4``）与型号 ``4M``/``210B``/``GPT-4``。

    真实 section 标题与导言段落（``4 Corroborating Claims...``、``We now verify
    the claims of Sec. 3 ... Following the structure of Sec. 3 ...``）三信号均不
    命中，予以保留。
    """
    if not text:
        return True
    t = text.strip()
    words = re.findall(r"[A-Za-z]{3,}", text)
    # 信号 A + C：短碎片（≤2 个 ≥3 字母英文词）且非"章节编号前缀 / 句末标点"形态
    if len(words) <= 2:
        # 章节编号前缀要求编号后跟 ≥2 字母英文词（'4.2 Behavioral Evidence'/'A Related Work'），
        # 避免把 '10 −1'（−1 非字母）、'1 B 300 M 20 M'（B/M 单字母）这类刻度/图例
        # 噪声误判为 section 编号。
        has_section_prefix = bool(
            re.match(r"^(?:\d+(?:\.\d+)*|[A-Z])\s+[A-Za-z]{2,}", t)
        )
        has_terminal_punct = bool(re.search(r"[.!?][\"')\]]*\s*$", t))
        if not has_section_prefix and not has_terminal_punct:
            return True
    # 信号 B：相邻纯数字序列（≥3 个）= 坐标轴刻度
    return bool(re.search(r"\d+(?:\.\d+)?(?:[\s,;]+\d+(?:\.\d+)?){2,}", text))


def _figure_caption_to_inject(
    image_has_caption: bool,
    next_text_block_text: Optional[str],
) -> Optional[str]:
    """判断 image 是否应从邻接文本接收 caption（ISSUE-094 R9 D-6）。

    image_extraction 偶尔未能从 PyMuPDF / Docling 正确关联图片下方的
    caption 文本，导致 Markdown ``<img alt="...">`` 退化为文件名（如
    ``alt="fig_p4_2.png"``），同时下方独立段落 ``Figure 3: ...`` 仍以
    纯文本形式存在。本函数判定是否应从 ``next_text_block_text`` 注入。

    返回应注入的 caption 文本（已 strip），若不应注入则返回 ``None``。

    Args:
        image_has_caption: image 是否已有非空 caption（image_extraction 阶段结果）。
        next_text_block_text: image 元素紧邻下一个 text element 的内容。

    决策：
    - image 已有 caption → 不覆盖（保持上游结果优先）；
    - next_text 为空 / None → 不注入；
    - next_text 不匹配 ``Figure N:`` / ``Fig. N:`` / ``Table N:`` /
      ``Tab N -`` 模式 → 不注入（避免误识别普通段落含 "Figure" 关键字）。
    """
    if image_has_caption:
        return None
    if not next_text_block_text:
        return None
    text = next_text_block_text.strip()
    if not text:
        return None
    if not _is_figure_or_table_caption_text(text):
        return None
    return text


def _is_running_header_footer(text: str, page_number: Optional[int] = None) -> bool:
    """判断文本是否为学术论文的页眉/页脚残留。

    检测常见的跨页重复模式：会议简称 + 日期 + 作者名列表、
    论文标题 + 会议简称、ACM 版权/DOI 行等。

    Args:
        text: 待判定的文本块内容。
        page_number: 该文本块所在的 0-indexed 页码。**仅当 ``page_number == 0``
            （封面页）时**才会额外匹配 ``_COVER_BANNER_PATTERNS``（项目/机构
            banner），避免正文页面短句被误判为残留 banner。``None`` 时跳过
            封面专属模式（向后兼容调用方）。
    """
    stripped = text.strip()
    if not stripped or len(stripped) > 500:
        return False
    for pattern in _RUNNING_HEADER_FOOTER_PATTERNS:
        if pattern.search(stripped):
            return True
    if page_number == 0:
        for pattern in _COVER_BANNER_PATTERNS:
            if pattern.search(stripped):
                return True
    return False


def _is_author_byline(block: TextBlock) -> bool:
    """判断文本块是否为作者署名行（被误识别为 heading 的作者名+标记）。"""
    if block.block_type != "heading" or not block.heading_level:
        return False
    text = block.text.strip()
    # 含邮箱地址（无论长度，author+email+affiliation 组合可能较长）
    if re.search(r"[\w.+-]+@[\w.-]+\.\w{2,}", text):
        return True
    # 多作者署名：``Name <digit>`` 之后必须紧跟 affiliation 数字串（``,2``、
    # ``,2,3``）或通讯作者标记（``,*``）才算署名。仅出现 ``Word <digit>``
    # （如 ``Theorem 1`` / ``Algorithm 2`` / ``GPT 4 Architecture`` / ``Llama 2``）
    # 属于学术常见的标题或模型名称，必须保留为标题，不可降级。
    multi_author_affiliation = re.compile(
        r"[A-Z][A-Za-z\-]+(?:\s+[A-Z][A-Za-z\-]+)*\s+\d+(?:(?:,\s*\d+)+|,\s*\*)"
    )
    if multi_author_affiliation.search(text):
        return True
    # 短文本含 unicode 作者标记符号
    if len(text) >= 80:
        return False
    author_markers = ["∗", "†", "‡", "§", "¶", "✉"]
    if any(m in text for m in author_markers):
        return True
    return False


def _is_table_caption(block: TextBlock) -> bool:
    """判断 heading 是否为 ``Table N:`` / ``Table S2:`` 等表格 caption。

    PDF 中表格标题常用大字号 / 加粗排版，被 PyMuPDF 误识别为 heading；
    Markdown 中应作为正文段落保留，避免污染目录与导航。
    """
    if block.block_type != "heading" or not block.heading_level:
        return False
    text = block.text.strip()
    # ``Table 2:`` / ``Table S2.`` / ``Table 10:``
    return bool(re.match(r"^Table\s+S?\d+\s*[:.]", text))


def _is_paper_metadata_heading(block: TextBlock) -> bool:
    """判断文本块是否为论文元数据标题（如 CCS Concepts、Keywords）。"""
    if block.block_type != "heading" or not block.heading_level:
        return False
    text = block.text.strip()
    metadata_headings = [
        r"^CCS\s+Concepts",
        r"^Categories\s+and\s+Subject\s+Descriptors",
        r"^Received\s+\d+.*(?:revised|accepted)",
    ]
    for pattern in metadata_headings:
        if re.match(pattern, text, re.IGNORECASE):
            return True
    return False


def _text_block_to_markdown(block: TextBlock) -> str:
    """将 TextBlock 转换为 Markdown 文本。"""
    if block.block_type == "heading" and block.heading_level:
        return f"{'#' * block.heading_level} {block.text}"
    # 非标题段落：转义行首 # 防止被误渲染为 Markdown 标题
    # （如 "# bdqnghi@gmail.com" 是 PDF footnote 标记而非标题）
    text = block.text
    if text.startswith("#"):
        text = "\\" + text
    return text


def _table_caption_to_paragraph(block: TextBlock) -> str:
    """把表格 caption 从 heading 降级为加粗段落。

    保留视觉强调（**bold**）但脱离标题层级，避免污染目录与导航。
    """
    text = block.text.strip()
    return f"**{text}**"


def _byline_to_paragraph(block: TextBlock) -> str:
    """把作者署名从 heading 降级为纯文本段落（保留信息，去掉 # 层级）。"""
    return block.text.strip()


def _is_toc_table_text(text: str) -> bool:
    """识别学术论文的目录（TOC）表格。

    docling/pymupdf 对 PDF 目录页常输出列对齐错乱的多列表格（包含章节号、
    点 leader (``....``) 与页码）。Markdown 中既不便阅读、也不能可靠跳转，
    应识别并降级抑制。

    判定标准（需同时满足）：
    1. 文本为 GFM 表格（≥3 个表格行）
    2. 数据行（非分隔符）中含点 leader ≥ 2 行（``\\.{3,}`` 模式）
       或 行首/中段含 ``\\d+\\.\\d+`` 章节编号 ≥ 3 行
    3. 至少一列形如纯数字页码（``\\| \\d+ \\|``）
    """
    if not text:
        return False
    # 带 "Table N:" / "Figure N:" / "表 N:" caption 的结果表绝非目录（TOC）。
    # 结果表常含数值列（如 P_drop=0.1 形似章节号、BLEU/params 整数形似页码），
    # 会误命中下方的 section_no_rows / page_no_rows 启发式而被当成 TOC 丢弃
    # （如 Attention 论文 Table 3 架构变体表）。caption 起手即排除。
    first_line = text.split("\n", 1)[0].strip()
    if re.match(r"^(?:Table|Figure|Tab\.|Fig\.|表|图)\s*\d", first_line, re.IGNORECASE):
        return False
    lines = [ln for ln in text.split("\n") if ln.strip().startswith("|")]
    if len(lines) < 3:
        return False
    # 排除分隔符行
    data_lines = [ln for ln in lines if not re.match(r"^\s*\|[\s\-:|]+\|\s*$", ln)]
    if len(data_lines) < 3:
        return False

    dot_leader_rows = sum(1 for ln in data_lines if re.search(r"\.{3,}", ln))
    section_no_rows = sum(
        1 for ln in data_lines if re.search(r"\|\s*\d+\.\d+(?:\.\d+)?\s*\|", ln)
    )
    page_no_rows = sum(1 for ln in data_lines if re.search(r"\|\s*\d+\s*\|\s*$", ln))

    has_toc_signature = dot_leader_rows >= 2 or section_no_rows >= 3
    return has_toc_signature and page_no_rows >= 2


def _table_to_markdown(table: ExtractedTable) -> str:
    """将表格转换为 Markdown（带可选标题）。

    当 table.markdown 已包含 caption 文本时，不再额外添加，
    避免 table 元素内部出现重复标题。
    """
    md = table.markdown
    if table.caption and table.caption.strip():
        cap_stripped = table.caption.strip()
        # 检查 markdown 首行是否已包含 caption 文本
        first_line = md.split("\n", 1)[0].strip() if md else ""
        if first_line != cap_stripped:
            return f"**{cap_stripped}**\n\n{md}"
    return md


def _sanitize_latex(latex: str) -> str:
    """清洗 LaTeX 内容：截断重复模式、移除明显损坏的碎片。

    常见损坏模式：
    - ``\\quad \\text{in} \\quad \\text{in} ...`` 无限重复（Docling/Granite 幻觉）
    - ``\\quad`` 连续出现超过 4 次
    - LaTeX 中嵌入大量重复的 ``\\text{...}`` 碎片
    """
    if not latex:
        return latex

    original_len = len(latex)

    # 策略 1: 检测 \\text{X} \\quad 重复模式并截断
    # 匹配形如 \text{word}\quad\text{word}\quad 的重复序列
    repeat_pattern = re.compile(r"(\\text\{[^}]*\}\s*\\quad\s*){3,}")
    match = repeat_pattern.search(latex)
    if match:
        latex = latex[: match.start()].rstrip()
        if latex and not latex.endswith((",", ";", ".", "\\]")):
            latex = latex.rstrip(",; ")
        logger.debug(
            "公式 LaTeX 重复模式截断: %d → %d 字符",
            original_len,
            len(latex),
        )

    # 策略 2: 连续 \\quad 超过 4 个时截断（含大括号形式 {\quad} 和 & 分隔符）
    quad_run = re.compile(r"(\{?\\quad\}?[\s&]*){4,}")
    match = quad_run.search(latex)
    if match:
        latex = latex[: match.start()].rstrip()
        logger.debug(
            "公式 LaTeX \\quad 溢出截断: %d → %d 字符",
            original_len,
            len(latex),
        )

    # 策略 3: 单个 token 重复超过 20 次视为损坏
    token_repeat = re.compile(r"(\\[a-zA-Z]+\s*)\1{19,}")
    match = token_repeat.search(latex)
    if match:
        latex = latex[: match.start()].rstrip()
        logger.debug(
            "公式 LaTeX token 重复截断: %d → %d 字符",
            original_len,
            len(latex),
        )

    # 策略 4: 非对齐环境裸 ``&`` 分隔符剥离（ISSUE-094 R9 D-5）
    # Docling / MinerU 在抽取 PDF 公式时偶尔把右对齐编号或竖排分列保留为
    # 裸 ``&``，但未包裹在 ``\begin{align}``/``aligned``/``array``/``matrix``/
    # ``cases``/``pmatrix``/``bmatrix`` 等对齐环境内。KaTeX 在普通 ``$$...$$``
    # 块见到此类裸 ``&`` 会直接 ``ParseError: Misplaced &``，整公式拒渲染。
    # 本策略只剥离对齐环境**外**的裸 ``&``（``\&`` 转义符与环境内对齐符不动）。
    # 实现思路：分段扫描，遇到 ``\begin{ENV}`` 标记进入保留区，``\end{ENV}``
    # 出区；区外字符若是不带反斜杠的 ``&``，替换为单空格（保留 token 间距）。
    if "&" in latex:
        _ALIGN_ENVS = (
            "align",
            "align*",
            "aligned",
            "alignat",
            "alignat*",
            "array",
            "matrix",
            "pmatrix",
            "bmatrix",
            "Bmatrix",
            "vmatrix",
            "Vmatrix",
            "smallmatrix",
            "cases",
            "split",
            "gather",
            "gather*",
            "gathered",
            "eqnarray",
            "eqnarray*",
            "subarray",
        )
        _begin_re = re.compile(r"\\begin\{([A-Za-z*]+)\}")
        _end_re = re.compile(r"\\end\{([A-Za-z*]+)\}")
        out_chars: List[str] = []
        i = 0
        env_stack: List[str] = []
        stripped_bare = 0
        while i < len(latex):
            ch = latex[i]
            # 检测 \begin{ENV}
            if ch == "\\":
                m_begin = _begin_re.match(latex, i)
                if m_begin and m_begin.group(1) in _ALIGN_ENVS:
                    env_stack.append(m_begin.group(1))
                    out_chars.append(m_begin.group(0))
                    i = m_begin.end()
                    continue
                m_end = _end_re.match(latex, i)
                if m_end and env_stack and m_end.group(1) == env_stack[-1]:
                    env_stack.pop()
                    out_chars.append(m_end.group(0))
                    i = m_end.end()
                    continue
                # 转义符 \& 等：原样保留 2 字符
                if i + 1 < len(latex):
                    out_chars.append(latex[i : i + 2])
                    i += 2
                    continue
                out_chars.append(ch)
                i += 1
                continue
            # 裸 & 且不在对齐环境内：替换为单空格（保留 token 间距）
            if ch == "&" and not env_stack:
                out_chars.append(" ")
                stripped_bare += 1
                i += 1
                continue
            out_chars.append(ch)
            i += 1
        if stripped_bare:
            new_latex = "".join(out_chars)
            # 合并多余空白：连续 ≥2 个空白塌缩为 1 个
            new_latex = re.sub(r"[ \t]{2,}", " ", new_latex)
            logger.debug(
                "公式 LaTeX 裸 & 剥离: %d 个；%d → %d 字符",
                stripped_bare,
                original_len,
                len(new_latex),
            )
            latex = new_latex.strip()

    return latex


_FORMULA_EQ_NUMBER_PATTERNS: Tuple[re.Pattern[str], ...] = (
    # MinerU 标准：``... \tag{N}``
    re.compile(r"\\tag\s*\{\s*(\d+)\s*\}"),
    # Marker/Docling 标准：``... \quad (N)`` 或 ``... \quad ( N )``
    re.compile(r"\\quad\s*\(\s*(\d+)\s*\)"),
    # 短 inline 公式：LaTeX 尾部直接 ``(N)``（如 ``CE: (C,T) \to f_{context} (3)``）
    re.compile(r"\(\s*(\d+)\s*\)\s*$"),
)


def _extract_formula_eq_number(latex: str | None) -> str | None:
    """提取 LaTeX 公式末尾的等式编号（如 ``(3)`` / ``\\tag{4}`` / ``\\quad (5)``）。

    返回字符串形式的编号（无外围括号）。无编号时返回 ``None``。
    """
    if not latex:
        return None
    text = latex.strip()
    if not text:
        return None
    for pat in _FORMULA_EQ_NUMBER_PATTERNS:
        m = pat.search(text)
        if m:
            return m.group(1)
    return None


def _infer_missing_formula_numbers(
    extracted_numbers: List[Optional[int]],
) -> Dict[int, int]:
    """按公式 gap-consistency 推断缺失编号（ISSUE-094 R9 D-2/D-3/D-4）。

    Docling ``iterate_items`` 路径下抽取的公式 LaTeX 主体常不带
    ``\\tag{N}`` / ``\\quad (N)`` 编号，UI 视图等式编号缺失。利用
    学术论文连续编号习惯，按相邻两个有编号公式 A、B 之间的 gap
    与未编号公式数是否一致来保守填补，避免误编号。

    策略：
    1. 收集所有 ``extracted_numbers[i] is not None`` 的位置作为锚点；
    2. 对相邻两个锚点 ``(i_a, num_a)`` / ``(i_b, num_b)``，若
       ``num_b - num_a - 1 == i_b - i_a - 1``（"gap 一致"），则把
       ``i_a + 1..i_b - 1`` 位置依次填入 ``num_a + 1, num_a + 2, ...``；
    3. 仅在锚点之间填补，不外推（首段 / 末段未编号公式不做推断，
       避免与下文 / 上文真实编号冲突）。

    Args:
        extracted_numbers: 公式编号列表（按文档顺序），有编号为 int，
            无编号为 ``None``。

    Returns:
        ``{index: inferred_number}`` 字典，仅含能可靠推断的位置。
    """
    inferred: Dict[int, int] = {}
    anchors: List[Tuple[int, int]] = [
        (i, n) for i, n in enumerate(extracted_numbers) if n is not None
    ]
    if len(anchors) < 2:
        return inferred
    for k in range(len(anchors) - 1):
        i_a, num_a = anchors[k]
        i_b, num_b = anchors[k + 1]
        between_count = i_b - i_a - 1
        if between_count == 0:
            continue
        expected_gap = num_b - num_a - 1
        if between_count != expected_gap:
            continue
        for offset in range(1, between_count + 1):
            inferred[i_a + offset] = num_a + offset
    return inferred


def _formula_to_markdown(formula: ExtractedFormula) -> str:
    """将公式转换为 Markdown LaTeX（含清洗）。"""
    latex = _sanitize_latex(formula.latex or "")
    if not latex.strip():
        return ""
    if formula.formula_type == "inline":
        return f"${latex}$"
    return f"$$\n{latex}\n$$"


_CODE_LANG_HEADER_MAP = {
    "python": "python",
    "py": "python",
    "java": "java",
    "javascript": "javascript",
    "js": "javascript",
    "typescript": "typescript",
    "ts": "typescript",
    "c": "c",
    "c++": "cpp",
    "cpp": "cpp",
    "cs": "csharp",
    "csharp": "csharp",
    "rust": "rust",
    "rs": "rust",
    "go": "go",
    "golang": "go",
    "ruby": "ruby",
    "rb": "ruby",
    "php": "php",
    "swift": "swift",
    "kotlin": "kotlin",
    "scala": "scala",
    "r": "r",
    "perl": "perl",
    "lua": "lua",
    "bash": "bash",
    "sh": "bash",
    "shell": "bash",
    "zsh": "bash",
    "fish": "bash",
    "powershell": "powershell",
    "ps1": "powershell",
    "sql": "sql",
    "yaml": "yaml",
    "yml": "yaml",
    "json": "json",
    "xml": "xml",
    "html": "html",
    "css": "css",
    "scss": "scss",
    "markdown": "markdown",
    "md": "markdown",
    "toml": "toml",
    "ini": "ini",
    "dockerfile": "dockerfile",
    "makefile": "makefile",
    "graphql": "graphql",
    "protobuf": "protobuf",
    "proto": "protobuf",
}
"""常见编程语言关键词归一化表 → markdown fence highlight 名称。

来源：docling 在某些 PDF 上把代码块首行 ``Python`` / ``Javascript`` 字面字符
当作 ``text`` 输出（label='code' 但 code_language=None），导致 fence info string
缺失且首行 lang 字面被错误塞进代码本体。本表覆盖 R9 实测出现的所有 lang 名，
统一归一化到 ``highlight.js`` 识别的标准 alias（如 ``js → javascript``、
``c++ → cpp``）。
"""


def _code_block_to_markdown(code_block: ExtractedCodeBlock) -> str:
    """将代码块转换为 Markdown 代码围栏。

    R9 修复：docling 部分 PDF 上把代码块首行 lang 名字（如 ``Python``）当作
    ``text`` 字段输出，导致 fence info string 丢失且 lang 字面塞入 code body。
    此函数兼容两种来源：

    - ``code_block.language`` 已显式提供 → 用作 fence info string；同时清理
      code body 首行可能残留的同名 lang 字面；
    - ``code_block.language`` 为空但 code 首行单独是 lang 关键词（不区分大小写，
      允许尾随空白）→ 提升为 fence info string，从 body 移除首行。

    不在 :data:`_CODE_LANG_HEADER_MAP` 中的首行不会被吞掉，避免误删合法代码。
    """
    code = code_block.code or ""
    lang = (code_block.language or "").strip().lower()

    # 拆首行用于 lang 头识别
    stripped = code.lstrip("\n")
    first_newline = stripped.find("\n")
    first_line = stripped[:first_newline] if first_newline >= 0 else stripped
    rest = stripped[first_newline + 1 :] if first_newline >= 0 else ""

    first_line_token = first_line.strip().lower()
    inferred_lang = _CODE_LANG_HEADER_MAP.get(first_line_token)

    # 决策表：
    # 1. 有显式 lang → 用 lang，body 首行若同语言（如 "Python\n..."）则剔除；
    # 2. 无显式 lang 但首行命中 lang 表 → 用推断 lang，body 移除首行；
    # 3. 否则 → 保留原 body，fence 用 lang（可能为空）。
    if lang:
        normalized = _CODE_LANG_HEADER_MAP.get(lang, lang)
        # 若 body 首行单独是同语言名（含同义词），剔除
        if inferred_lang and inferred_lang == normalized:
            body = rest
        else:
            body = code
        return f"```{normalized}\n{body}\n```"

    if inferred_lang is not None:
        return f"```{inferred_lang}\n{rest}\n```"

    return f"```\n{code}\n```"


# PDF 点（pt）→ CSS 像素（px）转换因子：
# PDF 标准 72pt = 1in；HTML/CSS 标准 96px = 1in；因此 1pt = 96/72 = 4/3 ≈ 1.333 px。
# 之前 ``_image_to_markdown`` 直接把 bbox 宽（pt 单位）当作 px 输出，导致 figure
# 在 markdown view 中显示为 PDF 原版尺寸的 75%（A4 595pt 全宽 figure 仅 ~595px
# 而非 ~793px），用户视觉感受是"图被压缩到容器宽度的 1/3"。R7 修复后对 figure 按
# 标准 DPI 比例放大，让显示宽度回到 PDF 原版尺寸（在 96 DPI 默认 web rendering
# context 下视觉与 PDF 1:1 等价）。响应式样式 ``max-width:100%;height:auto;``
# 在窄屏下仍能正确缩放，无副作用。
_PDF_PT_TO_CSS_PX = 96.0 / 72.0


def _image_to_markdown(image: ExtractedImage) -> str:
    """将图片转换为 Markdown 图片引用，保留 PDF 原版显示尺寸。

    输出 **内嵌 HTML ``<img>``** 形式，并按以下优先级决定 ``width``/``height``：

    1. **优先使用 ``bbox``**（PDF 点坐标计算的显示宽高，与 PDF 原版视觉一致）：
       - PDF 点（72pt = 1in）按 96/72 = 4/3 ≈ 1.333 系数映射为 CSS 像素
         （PDF 标准 DPI 72 vs HTML/CSS 默认 96，标准 web rendering 等价）；
       - 这是 UI 中 ``DocumentImage`` 期望的「展示尺寸」语义，与 PDF 中视觉布局保持比例；
       - 同时配合响应式样式 ``max-width:100%;height:auto;`` 适配窄屏；
    2. 退化路径：当 ``bbox`` 缺失时回退到 ``image.width``/``image.height``
       （引擎报告的栅格像素分辨率，已是 px 单位无需再换算）；
    3. 极端兜底：无任何尺寸信息时输出标准 ``![alt](src)`` Markdown 形式。

    高分辨率原图始终由 ``src`` 指向的资源端点提供（不丢失清晰度），
    属性中的 ``width``/``height`` 仅约束 UI 展示尺寸，避免小图被放大、大图被拉伸。

    UI 端契约对齐：``apps/negentropy-ui/features/knowledge/components/
    DocumentMarkdownRenderer.tsx`` 中 ``DocumentImage`` 通过 ``parsePixelValue()``
    读取 ``width``/``height`` 像素值约束 ``max-width``。
    """
    alt_text = image.caption or image.filename or "image"
    src = f"./images/{image.filename}"

    display_w: Optional[int] = None
    display_h: Optional[int] = None
    if image.bbox is not None:
        try:
            x0, y0, x1, y1 = (float(v) for v in image.bbox)
            bw, bh = x1 - x0, y1 - y0
            if bw > 0 and bh > 0:
                display_w = int(round(bw * _PDF_PT_TO_CSS_PX))
                display_h = int(round(bh * _PDF_PT_TO_CSS_PX))
        except (TypeError, ValueError):
            display_w = display_h = None

    if display_w is None and image.width:
        display_w = int(image.width)
    if display_h is None and image.height:
        display_h = int(image.height)

    # R9 修复：始终输出 CSS px 像素值（PDF pt × 4/3）作为 width / height 属性，
    # 配合 ``style="max-width:100%;height:auto"`` 实现「PDF 原版尺寸 + 窄屏
    # 自适应」双赢。此前的 ``is_large_figure → width="100%"`` 分支会把所有
    # 全宽 figure 拍扁到容器宽度，丢失 PDF 中半宽 / 全宽 figure 的相对比例
    # 信息，导致 R9 477 页教材中 32 张 md_img + 61 张 html_img 几乎全是
    # ``width="100%"``，与 PDF 原版视觉差距大。
    if display_w or display_h:
        parts: List[str] = [
            f'<img src="{html.escape(src, quote=True)}"',
            f'alt="{html.escape(alt_text, quote=True)}"',
        ]
        if display_w:
            parts.append(f'width="{display_w}"')
        if display_h:
            parts.append(f'height="{display_h}"')
        parts.append('style="max-width:100%;height:auto;" />')
        return " ".join(parts)
    return f"![{alt_text}]({src})"


# ---------------------------------------------------------------------------
# Stage 本地工具映射
# ---------------------------------------------------------------------------

_TOOLS: Dict[str, type] = {
    "builtin_assembler": BuiltinAssembler,
}


# ---------------------------------------------------------------------------
# Stage 类
# ---------------------------------------------------------------------------


class AssemblyStage(Stage[AssemblyInput, AssemblyOutput]):
    """S8: Markdown 组装 Stage。"""

    STAGE_ID = "assembly"
    STAGE_NAME = "Markdown 组装"
    TOOLS = _TOOLS

    @property
    def stage_id(self) -> str:
        return self.STAGE_ID

    @property
    def stage_name(self) -> str:
        return self.STAGE_NAME

    async def execute(self, input_data: AssemblyInput) -> StageResult[AssemblyOutput]:
        """执行 Markdown 组装。"""
        for tool_cls in _TOOLS.values():
            tool = tool_cls()
            if tool.is_available():
                return await tool.execute(input_data)
        return StageResult(success=False, error="无可用的组装工具")
