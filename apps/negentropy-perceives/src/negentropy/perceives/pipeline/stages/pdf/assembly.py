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
import unicodedata
from collections import Counter
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

# 论文顶层结构标题 ``Part I. / Part II. ...``（罗马数字 + 句点）。用于 2.1a 段把
# 四个 Part 归一到统一层级（H2），修复 docling 跨切片赋级不一致。
_PART_HEADING_RE = re.compile(r"^Part\s+[IVXLCDM]+[.．:：]", re.IGNORECASE)


# LaTeX 数学标记：``$...$`` 定界符或常见数学命令（``\sqrt``/``\frac``/``\sum``/
# ``\mathrm``/``\operatorname``/``\begin``/希腊字母命令等）。用于区分 docling 把
# 行间公式 OCR 成文本流的"残影"块与正常正文段——正文段几乎不含这些标记。
_LATEX_MATH_MARKER_RE = re.compile(
    r"\$|\\(?:sqrt|frac|sum|int|prod|mathrm|mathit|mathbf|mathsf|operatorname"
    r"|begin|end|alpha|beta|gamma|delta|theta|lambda|mu|sigma|omega|phi|psi"
    r"|infty|cdot|times|leq|geq|neq|approx|rightarrow|leftarrow)\b"
)


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
            # ``_grid_table_regions``：仅收录 **已产出合法 GFM 网格** 的表格 bbox。
            # 用途：PyMuPDF 常把表格区域另抽为"字符流 run-on 文本块"（如
            # ``Field Type Description model str LLM model identifier ...``），该块
            # 与表格 bbox 空间重叠但既非 caption 亦非低内容碎片，会"落穿"下方
            # figure-region 实质文本例外而被冗余输出，形成网格后的 run-on 回声
            # （ISSUE: 附录表格 Tables 3–7 网格 + 回声并存）。仅当该表格已有高保真
            # 网格时抑制其 run-on 回声；无网格的表格（如引擎漏检的 Tables 8/9）
            # 不在此集合内，其文本块得以保留，避免误删唯一内容（防数据丢失）。
            _grid_table_regions: Dict[int, List[Tuple[float, float, float, float]]] = {}
            for table in input_data.tables.tables if input_data.tables else []:
                if table.bbox:
                    special_regions.setdefault(table.page_number, []).append(table.bbox)
                    _tmd = table.markdown.strip() if table.markdown else ""
                    if _tmd.startswith("|") and re.search(r"\n\s*\|[\s\-:|]+\|", _tmd):
                        _grid_table_regions.setdefault(table.page_number, []).append(
                            table.bbox
                        )
            # ``_image_regions``：仅收录 image_extraction 提取的**位图本身** bbox
            # （精确覆盖实际栅格区域，区别于 layout figure region 常过大）。用于
            # 抑制完全落入位图内的矢量标签文本块（流程图节点文字 / 图例 / 轴标题）：
            # 位图已烘入其像素，文本块为冗余副本。
            _image_regions: Dict[int, List[Tuple[float, float, float, float]]] = {}
            for img in input_data.images.images if input_data.images else []:
                if img.bbox:
                    special_regions.setdefault(img.page_number, []).append(img.bbox)
                    _image_regions.setdefault(img.page_number, []).append(img.bbox)

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
                        # 阈值降至 ≥6：短公式（如 ``A_t=⟨M,H,U,E⟩`` sig=10、
                        # ``z_i=H_{t_i}(τ_i)`` sig=6）也需入库，供
                        # ``_text_block_matches_formula`` 的**精确相等**快路径去重
                        # PyMuPDF inline 文本流与 MinerU 块公式的并存副本（Q9）。
                        # 短签名在子串匹配路径中因 ratio/≥20 门天然失活，仅参与
                        # 精确相等去重，无假阳性放大。
                        if len(sig) >= 6:
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
                        # 网格表格的 run-on 文本回声抑制：caption 已在上方恒保留，
                        # 此处若文本块与 **已产出合法网格** 的表格 bbox 重叠，则它
                        # 是 PyMuPDF 对同一表格另抽的"字符流"冗余副本（表头回声 +
                        # 塌缩单元格），高保真网格已由 table_extraction 提供，直接
                        # 跳过。仅对 grid-backed 表格生效：无网格表格（引擎漏检的
                        # Tables 8/9）不在 _grid_table_regions 内，其文本块继续保留，
                        # 避免误删唯一内容。
                        if _block_overlaps_special(
                            block, _grid_table_regions, iou_threshold=0.3
                        ):
                            continue
                        if _is_low_content_figure_label(block.text):
                            continue
                        # 文本块完全落入某张已提取位图 bbox 内 → 图内矢量标签
                        # （流程图节点文字 / 图例 / 面板标题），位图已烘入其像素，
                        # 抑制避免图内文字与正文双份。用"完全包含"（四角均在图内，
                        # 2pt 容差吸收坐标取整）而非 overlap：精确位图 bbox 不会
                        # 误吞图外真实内容（section 标题 / 段落位于图外，不满足
                        # 完全包含）。caption 已由上方 _is_figure_or_table_caption_text
                        # 恒保留，不在此处误伤。
                        if _block_fully_inside_region(block, _image_regions):
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
                        # 内联公式去重：公式签名（_formula_text_signature）是某同页
                        # 正文段子串 → 公式已内联于正文段（raw 字面串），display $$
                        # 块为重复抽取，跳过。≥6 字符启用（公式签名密集 alphanumeric，
                        # 巧合子串风险低）。
                        md = _formula_to_markdown(formula)
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
                    # Docling 代码块与同页"字符流文本回声"（PyMuPDF 把代码区另抽为
                    # 文本块）的去重。按 effective language 分流：
                    # **真实代码语言**（python/bash/json/yaml/js/...）：**保留权威的
                    # fenced code、删除 text 回声**——text 副本常为折叠/转义低质量版本。
                    # ratio>0.7 是强信号（text 含 ≥70% 代码标识符→必为回声；若 code 为
                    # 引擎误检垃圾，不可能与 text 达 0.7 重叠），放宽 overlap>=5 覆盖短
                    # 代码块（bash/import），消除 text+fenced 双出。
                    # **误标代码语言**（html/xml/markdown/text 等，常把散文/TOC 误包）：
                    # 保持原"优先 text"行为——code 与 text 重叠时 _skip 掉 code（text 更
                    # 忠实），避免把 TOC/散文错渲染成 ```html 代码块。
                    code_words = set(
                        re.findall(r"[a-zA-Z_]{3,}", code_block.code.lower())
                    )
                    if code_words:
                        if _effective_code_lang(code_block) in _REAL_CODE_LANGS:
                            _echo_indices: List[int] = []
                            _frag_candidates: List[Tuple[int, set]] = []
                            for _ei, elem in enumerate(elements):
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
                                overlap_words = code_words & block_words
                                overlap = len(overlap_words)
                                ratio = overlap / max(len(code_words), 1)
                                # 整体回声：单块覆盖 code 标识符 ≥70%
                                if ratio > 0.7 and overlap >= 5:
                                    _echo_indices.append(_ei)
                                    continue
                                # 分片回声候选：PyMuPDF 把代码区拆成多块文本，单块
                                # 仅含部分标识符（ratio 不足 0.7），但块自身几乎全是
                                # 代码标识符（overlap/len(block_words) ≥ 0.9）→ 代码
                                # 碎片。caption（Figure N:/Table N: 起手）含较多代码词
                                # （描述 harness 函数）但非回声，由
                                # _is_figure_or_table_caption_text 守卫保留。
                                block_code_ratio = overlap / max(len(block_words), 1)
                                if (
                                    block_code_ratio >= 0.9
                                    and overlap >= 2
                                    and not _is_figure_or_table_caption_text(
                                        elem.block.text
                                    )
                                ):
                                    _frag_candidates.append((_ei, overlap_words))
                            # 分片并集覆盖 code_words ≥70% → 同一代码的分片回声，
                            # 全部抑制。并集门槛杜绝单块巧合误杀（单个散文块不可能
                            # 贡献 ≥70% 代码标识符）。
                            if _frag_candidates:
                                _frag_union: set = set()
                                for _, _w in _frag_candidates:
                                    _frag_union |= _w
                                if len(_frag_union) / max(len(code_words), 1) >= 0.7:
                                    for _ei, _ in _frag_candidates:
                                        _echo_indices.append(_ei)
                            for _ei in reversed(sorted(set(_echo_indices))):
                                elements.pop(_ei)
                        else:
                            # 误标代码：重叠则 _skip code、保留 text（原逻辑）
                            _skip = False
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
                    # 边界修正：截断引擎误纳的尾部章节标题/引言正文
                    _kept_code, _tail_text = _split_code_tail_section(
                        code_block.code or ""
                    )
                    elements.append(
                        _ContentElement(
                            reading_order=code_block.reading_order,
                            page_number=code_block.page_number,
                            element_type="code",
                            content=_code_block_to_markdown(
                                code_block, code_override=_kept_code
                            ),
                            code_block=code_block,
                        )
                    )
                    if _tail_text:
                        elements.append(
                            _ContentElement(
                                reading_order=code_block.reading_order + 0.5,
                                page_number=code_block.page_number,
                                element_type="text",
                                content=_tail_text,
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
                    # fitz/PyMuPDF 常把整栏正文合并为单个「高块」（宽~栏宽、高数百
                    # pt）。这种块每栏仅 1 个，宽度可能略超 full_width_thr 被排除，
                    # 致「每栏 ≥3 实质元素」校验误判真双栏正文页为单栏，进而按 y0
                    # 排序把右栏（y0 较小）排到左栏之前（ISSUE: 双栏章节序错乱）。
                    # 增加高度路径：每栏存在高度 ≥250pt 的块即视为实质栏
                    # （正文栏块通常 280pt+；标题页摘要块 ~195pt 不致误判）。
                    _TALL_BLOCK_H_PT = 250.0
                    full_width_thr = x_range * 0.7
                    col0_substantial = 0
                    col1_substantial = 0
                    col0_tall = False
                    col1_tall = False
                    for _, bx in items:
                        w = bx[2] - bx[0]
                        h = bx[3] - bx[1]
                        xc = (bx[0] + bx[2]) / 2
                        left = xc < split_x
                        if _SUBSTANTIAL_W_PT <= w <= full_width_thr:
                            if left:
                                col0_substantial += 1
                            else:
                                col1_substantial += 1
                        if h >= _TALL_BLOCK_H_PT:
                            if left:
                                col0_tall = True
                            else:
                                col1_tall = True
                    col0_ok = col0_substantial >= _MIN_SUBSTANTIAL_PER_COL or col0_tall
                    col1_ok = col1_substantial >= _MIN_SUBSTANTIAL_PER_COL or col1_tall
                    if not (col0_ok and col1_ok):
                        is_two_col = False

                    # 行优先守卫：两栏均无≥250pt 高块时，页面是横排多元素区
                    # （典型：3 栏作者块 / 标题页装饰），count-path 会误判为双栏
                    # 并按列优先排序，把同 y0 横排的作者重排成列序、破坏阅读序
                    # （ISSUE: 作者块乱序）。仅当至少一栏有高块（真双栏正文）才
                    # 保留列优先；否则降级行优先 (y0, x0)。body 正文页有高块不受影响。
                    if is_two_col and not (col0_tall or col1_tall):
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
            ) -> Tuple[int, int, float, float, float]:
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
            #
            # auto_batch 修正：论文标题只在**首个切片**（slice_index==0）出现。切片
            # >0 的首个标题是普通章节标题（如 ``8.`` / ``4.2`` / ``References``），
            # 若仍走「册封论文标题」分支会被误升为 H1。故切片 >0 时预置
            # ``_first_h1_seen=True``，使所有标题统一走「后续下移一级」路径，与切片 0
            # 册封标题后的其余标题保持一致的层级基准（ISSUE：auto_batch 切片首标题误判 h1）。
            _first_h1_seen = getattr(input_data, "slice_index", 0) > 0
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

            # 2.1a Part 结构标题层级归一：``Part I. / Part II. ...`` 是论文顶层结构
            #     节点（位于编号 section 之上）。docling 跨切片对其赋级不一致
            #     （实测同一文档 Part I–III 为 h4、Part IV 为 h3），且经上方级联后
            #     进一步偏移。统一钉为 H2，使四个 Part 在 wiki WikiToc（h2–h4）中
            #     呈现为一致的顶层导航节点（ISSUE：Part 标题层级不一致 / 语义偏弱）。
            for elem in elements:
                content = elem.content.strip()
                if not content.startswith("#"):
                    continue
                level = len(content) - len(content.lstrip("#"))
                heading_body = content[level:].strip()
                if _PART_HEADING_RE.match(heading_body):
                    elem.content = "## " + heading_body

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

            # 2.1.2 同页同编号算法块跨类型去重：多引擎（PyMuPDF 文本块 /
            #   docling/marker code 块 / code_detection algorithm 块）可能各自
            #   产出同一 "Algorithm N" 的内容，导致同一算法在候选 markdown 中
            #   重复出现（如纯文本标题 + 乱码内容文本 + fortran 块 + algorithm
            #   块）。策略：(a) 同 (页码, 编号) 的算法 code 块仅保留内容最长者；
            #   (b) 同页已存在算法 code 块时，移除同页冗余文本块——含同编号
            #   Algorithm 标题的（标题重复），或含算法行号模式（≥2 个 "N:"，
            #   PyMuPDF 字符流常把算法多行挤成乱码文本）。
            _algo_num_re = re.compile(r"Algorithm\s+(\d+)", re.IGNORECASE)
            _algo_code_by_key: Dict[Tuple[int, str], List[int]] = {}
            for _i, _e in enumerate(elements):
                if _i in _algo_remove or _e.element_type != "code":
                    continue
                _m = _algo_num_re.search(_e.content or "")
                if not _m:
                    continue
                _algo_code_by_key.setdefault((_e.page_number, _m.group(1)), []).append(
                    _i
                )
            # (a) 同页同编号算法 code 块：保留内容最长者
            for _idxs in _algo_code_by_key.values():
                if len(_idxs) <= 1:
                    continue
                _ranked = sorted(
                    _idxs,
                    key=lambda i: len((elements[i].content or "").strip()),
                    reverse=True,
                )
                for _i in _ranked[1:]:
                    _algo_remove.add(_i)
            # (b) 同页存在算法 code 块时，移除同页冗余文本块
            _algo_page_nums: Dict[int, set] = {}
            for _pg, _num in _algo_code_by_key:
                _algo_page_nums.setdefault(_pg, set()).add(_num)
            for _i, _e in enumerate(elements):
                if _i in _algo_remove or _e.element_type != "text" or not _e.block:
                    continue
                _nums = _algo_page_nums.get(_e.page_number)
                if not _nums:
                    continue
                _content = _e.block.text or ""
                _m2 = _algo_num_re.search(_content)
                if (
                    (_m2 and _m2.group(1) in _nums)
                    or re.search(r"(?:^|\n)\s*\d+:\s", _content)
                    or len(re.findall(r"\d+:\s", _content)) >= 2
                ):
                    _algo_remove.add(_i)

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
                        # inline 独立短块：整段即公式。≤ 40 字符直接放；40 < len ≤ 60
                        # 时要求高数学字形密度（≥ 2 个 greek/运算符特征字形），确认整段
                        # 确为公式而非散文片段。仅独立块、不触 prose 段落，零损坏风险。
                        _MATH_GLYPHS = set(
                            "αβγδεζηθικλμνξπρστυφχψωΔΘΛΣΦΨΩΓ×÷≈≤≥≠∈∉⊂⊆⊃⊇∪∩∀∃∑∏∫∂∇"
                        )
                        _glyph_density = sum(1 for c in text if c in _MATH_GLYPHS)
                        is_inline_short = formula.formula_type == "inline" and (
                            len(text) <= 40 or (len(text) <= 60 and _glyph_density >= 2)
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
            # 的最小长度阈值）。清理判据：text element 内容为公式残片形态 + 后续
            # （经空白 + 残片链）能扫到一个公式元素 → 视为公式残片剔除，避免视图中
            # "残片 + 公式"并存（ISSUE-094 R8）。
            #
            # 残片形态（两种）：
            #   形态1（纯文本残片）：``<id> = <open-bracket>``，≤ 15 字符（如 ``C = [``）。
            #   形态2（数学标记碎片）：PyMuPDF 数学字形检测把公式视觉区字符包成 ``$...$``
            #     inline math 文本块，常落在 block 公式 bbox 正上方（y 不重叠）逃脱几何
            #     去重，且 ``$`` 包裹使 ``_formula_text_signature`` 坍缩为极短签名（如
            #     ``"$C =$ $[$"``→``"c"``）逃脱签名去重。判据：以 ``$`` 起手 + 含数学
            #     符号/关系符 + ≤ 60 字符（如 ``"$C =$ $[$"``、``"$e\in E_{rel}$ Char $(e)$ (2)"``）。
            _FORMULA_FRAGMENT_RE = re.compile(r"^\s*[A-Za-z]\w*\s*=\s*[\[\(\{]\s*$")
            _MATH_FRAG_CHARS = set("=∈∀∃∑∏∫→←↔≤≥≠≈⊆⊂⊃∪∩∧∨<>+\-*/^_")

            def _is_formula_text_fragment(content: str) -> bool:
                if not content:
                    return False
                if len(content) <= 15 and _FORMULA_FRAGMENT_RE.match(content):
                    return True
                if (
                    content.startswith("$")
                    and len(content) <= 60
                    and any(c in content for c in _MATH_FRAG_CHARS)
                ):
                    return True
                return False

            _fragment_idx = {
                i
                for i, e in enumerate(elements)
                if e.element_type == "text"
                and e.block is not None
                and _is_formula_text_fragment(e.content.strip())
            }
            # 仅保留"后续经（空白 + 残片链）能扫到一个公式元素"的残片，避免误删
            # 合法的赋值起手 / 行内数学短句（必须能向前连到公式才判为冗余残片）。
            _fragment_remove: set[int] = set()
            for i in _fragment_idx:
                next_idx = i + 1
                while next_idx < len(elements):
                    nxt = elements[next_idx]
                    if nxt.element_type == "formula":
                        _fragment_remove.add(i)
                        break
                    if nxt.element_type == "text":
                        nxt_content = (nxt.content or "").strip()
                        # 中间仅允许空白或其他残片候选通过（残片链：多碎片连排到公式）
                        if not nxt_content or next_idx in _fragment_idx:
                            next_idx += 1
                            continue
                        break  # 遇到正常非空文本，无法连到公式 → 非残片
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
            #
            # ``claimed_captions``：已被某张图片认领的 caption 归一化文本集，供同页
            # 游离 caption 兜底避免两张图抢同一段。
            claimed_captions: set[str] = set()
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
                # 邻接失败兜底：同页游离 caption 关联（ISSUE：Figure N | caption
                # 与其图片在阅读序中相隔较远——中间夹标题 / 分栏文本，邻接搜索遇
                # 非 text 元素即中断）。当图片仍无 caption 时，在**同一页**范围内
                # 搜索一个 ``Figure N |`` / ``Table N |`` 起手且尚未被其它图片认领
                # 的游离 text 段，将其注入。仅在该页恰有唯一 captionless 图片时启用，
                # 避免多图页误配（本文档 Figure 8 位于 p39：图在页首、caption 漂到
                # ~90 行后，邻接兜底够不到）。
                if injected is None and not existing_cap:
                    injected = _find_same_page_orphan_caption(
                        img_elem, elements, claimed_captions
                    )
                if injected is None:
                    continue
                claimed_captions.add(_normalize_for_dedup(injected))
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

            # 2.6.1 图片 caption 重复去重（Figure 2 拆分子图场景）：
            # caption 邻接注入(2.5.7)后，同页多张图可能携带完全相同的 caption
            # （docling 把同一 figure 拆成多个子图却赋同一完整 caption，如
            # Figure 2 左 Scaled Dot-Product + 右 Multi-Head）。首张保留完整 alt，
            # 后续同 caption 的图重写为空 alt，避免同一图注重复显示；视觉内容
            # （子图）仍各自保留。归一化比较避免尾随空白/标点差异致漏判。
            _seen_img_caps: Dict[int, set[str]] = {}
            for _elem in elements:
                if _elem.element_type != "image" or _elem.image is None:
                    continue
                _cap = (_elem.image.caption or "").strip()
                if not _cap:
                    continue
                _norm = _normalize_for_dedup(_cap)
                _page_seen = _seen_img_caps.setdefault(_elem.page_number, set())
                if _norm in _page_seen:
                    _elem.content = _image_to_markdown(_elem.image, alt_override="")
                else:
                    _page_seen.add(_norm)

            # 2.6.2 图子标签剔除（Figure 2 子图标签场景）：docling 把图内矢量
            # 标签（如 Figure 2 子图标签 "Scaled Dot-Product Attention"/
            # "Multi-Head Attention"）额外抽成独立文本块，而这些标签内容已含
            # 于图的完整 caption。剔除"短词组(3-6词)、无句末标点、整体是某图
            # caption 归一化子串"的冗余子标签，避免其作为独立正文行显示。
            _img_caps_for_sublabel: List[str] = []
            for _e in elements:
                if _e.element_type == "image" and _e.image:
                    _c = (_e.image.caption or "").strip()
                    if len(_c) > 15:
                        _img_caps_for_sublabel.append(_normalize_for_dedup(_c))
            if _img_caps_for_sublabel:
                elements = [
                    _e
                    for _e in elements
                    if not (
                        _e.element_type == "text"
                        and _e.block is not None
                        and _is_figure_sublabel(
                            (_e.content or "").strip(), _img_caps_for_sublabel
                        )
                    )
                ]

            # 2.6.3 图打断句子修正（Figure 2 reading_order 场景）：图插在句子中间
            # （前文本块不以句末标点结尾）时，把图前移越过连续的"句子延续"文本块，
            # 到最近的段落边界（heading / 句末标点 / 列表项 / 非 text 元素）之后。
            # 源 PDF 中图位于段落上方，perceives 因 reading_order 把图排入句中。
            _img_i = 0
            while _img_i < len(elements):
                if elements[_img_i].element_type != "image":
                    _img_i += 1
                    continue
                _target = _img_i
                while _target > 0 and not _is_paragraph_boundary(elements[_target - 1]):
                    _target -= 1
                if _target < _img_i:
                    _moved = elements.pop(_img_i)
                    elements.insert(_target, _moved)
                _img_i += 1

            # 表格 run-on 文本回声抑制（须在下方段合并前执行）：PyMuPDF 对
            # 同一表格另抽字符流(run-on, 无 | 分隔), 与 table_extraction 的
            # markdown 表格重复。文本块签名与某 table 签名长度相近(0.5-2.0)
            # 且 multiset coverage≥0.9 → 抑制。提前到段合并前, 防 run-on(以$
            # 结尾非句末标点)被误并入下一段致 sig 变长漏判。
            _table_sigs: List[str] = []
            for _e in elements:
                if _e.element_type == "table" and _e.content:
                    _ts = _formula_text_signature(_e.content)
                    if len(_ts) >= 20:
                        _table_sigs.append(_ts)
            if _table_sigs:
                # 仅抑制紧邻表格之后的 run-on 回声（相邻性约束）：远处正文段
                # 即使与长 table sig 字符集合巧合重叠（coverage 虚高）也不误杀。
                _filtered_elems: List[_ContentElement] = []
                for _idx, _e in enumerate(elements):
                    if _e.element_type == "text" and _e.block is not None and _idx > 0:
                        _prev_elem = elements[_idx - 1]
                        if (
                            _prev_elem.element_type == "table"
                            and _prev_elem.content
                            and len(_formula_text_signature(_prev_elem.content)) >= 20
                            and _is_table_runon_echo(
                                _formula_text_signature(_e.content or ""),
                                [_formula_text_signature(_prev_elem.content)],
                            )
                        ):
                            continue
                    _filtered_elems.append(_e)
                elements = _filtered_elems

            # 2.6.4 相邻同句段合并：docling 把一个完整段按视觉行拆成多个
            # TextBlock，致 markdown 输出多个独立段（空行分隔）。当前 text 段
            # 不以句末标点结尾 + 下一相邻 text 段以小写开头（句子延续）→ 合并
            # 为一段，还原源 PDF 完整段。排除 heading / 列表项 / 以标点结尾的段。
            _merge_i = 0
            while _merge_i < len(elements) - 1:
                _cur = elements[_merge_i]
                _nxt = elements[_merge_i + 1]
                if not (
                    _cur.element_type == "text"
                    and _cur.block is not None
                    and _nxt.element_type == "text"
                    and _nxt.block is not None
                ):
                    _merge_i += 1
                    continue
                _ct = (_cur.content or "").strip()
                _nt = (_nxt.content or "").strip()
                if (
                    not _ct
                    or not _nt
                    or _ct.startswith("#")
                    or _nt.startswith("#")
                    or _LIST_ITEM_RE.match(_ct)
                    or _LIST_ITEM_RE.match(_nt)
                ):
                    _merge_i += 1
                    continue
                _cur_ends_punct = bool(re.search(r"[.!?][\"')\]]*\s*$", _ct))
                _nxt_starts_lower = _nt[0].islower()
                if not _cur_ends_punct and _nxt_starts_lower:
                    _cur.content = _ct + " " + _nt
                    elements.pop(_merge_i + 1)
                    continue
                _merge_i += 1

            # 2.6.5 行内公式 OCR 残片修复：docling 把行内分数 1/√X 误识为
            # "$1$ $^{\sqrt}X$"（1 单独、sqrt 作上标、变量跟后），重组为
            # $\frac{1}{\sqrt{X}}$。仅匹配 $^{\sqrt}X$ 变体（X 可含下标）；
            # $^{\sqrt X}$ 变体下标信息已丢，无法恢复，不在本规则覆盖范围。
            for _e in elements:
                if _e.element_type != "text" or not _e.content:
                    continue
                # L85 变体: $1$ $^{\sqrt}d_{k}$ -> 分数 (X 含下标)
                _e.content = re.sub(
                    r"\$1\$\s+\$\^?\{?\\sqrt[\}\s]*([a-zA-Z](?:_\{[^}]*\})?)\$",
                    r"$\\frac{1}{\\sqrt{\1}}$",
                    _e.content,
                )
                # L87 变体: $1$ $^{\sqrt dk}$ (dk 下标_已丢, 按 d_k 还原)
                _e.content = _e.content.replace(
                    r"$1$ $^{\sqrt dk}$",
                    r"$\frac{1}{\sqrt{d_k}}$",
                )
                # 脚注4 求和: docling 把 Σ_{i=1}^{d_k} q_i k_i 误识为
                # P^{dk} $_{i=1} qiki (Σ→P、下标丢), 还原为求和式
                _e.content = _e.content.replace(
                    r"$q \cdot k = P^{dk}$ $_{i=1} qiki$",
                    r"$q \cdot k = \sum_{i=1}^{d_k} q_i k_i$",
                )

            # 2.6.6 表格单元格复杂度表达式上下标还原: docling 把 O(n^2·d) 的
            # 上标 ^ 与 log 下标丢失（"n 2" / "log k"）。在 table content 上还原:
            # O(...) 内 "单字母 空格 数字" → "单字母^数字"; "log k" → "\log_k"。
            for _e in elements:
                if _e.element_type != "table" or not _e.content:
                    continue
                _tc = re.sub(
                    r"O\s*\(([^)]*)\)",
                    lambda m: (
                        "O("
                        + re.sub(r"\b([a-zA-Z])\s+(\d+)", r"\1^\2", m.group(1))
                        + ")"
                    ),
                    _e.content,
                )
                _e.content = _tc.replace("log k", r"\log_k")

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
                        r"((?:Table|Figure)\s+\d+\s*[:.|｜∣][^\n]+)",
                        cap_source,
                        re.IGNORECASE,
                    )
                    if cap_match:
                        cap_text = cap_match.group(1)
                        # 同编号 Figure/Table caption 不论长短只保留首份：
                        # 不同源（docling/PyMuPDF）常给出完整版与截断版，整段
                        # 归一化文本不同会漏去重，改以 "figure N" / "table N"
                        # 编号作去重键（编号在论文中唯一，不会误伤不同图表）。
                        _cap_num = re.match(
                            r"(?:Table|Figure)\s+\d+", cap_text, re.IGNORECASE
                        )
                        cap_key = (
                            _cap_num.group(0).lower()
                            if _cap_num
                            else _normalize_for_dedup(cap_text)
                        )
                        # 仅对 text 元素去重：image 元素即使 caption 重复也保留，
                        # 避免同编号 caption 已记录时把图片本身丢弃。
                        if cap_key in _seen_caption and elem.element_type == "text":
                            continue
                        # table 元素：同编号 caption 已被独立文本块记录为
                        # ``**Table N:**`` 粗体时，剥离表格 markdown 内嵌的明文
                        # caption 首行(冗余裸文本副本)，但保留网格本身,不丢表格。
                        if cap_key in _seen_caption and elem.element_type == "table":
                            elem.content = _strip_leading_caption_paragraph(
                                elem.content
                            )
                        _seen_caption.add(cap_key)
                _dd.append(elem)
            elements = _dd

            # 3. 拼接 Markdown
            markdown_parts: List[str] = []
            for elem in elements:
                markdown_parts.append(elem.content)

            markdown = "\n\n".join(markdown_parts)
            # 误判内联公式解包：含省略号的普通文本（典型为目录条目
            # ``$Appendix B - AI Agentic \ldots.: From GUI ...$``）被引擎误标为
            # inline formula，省略号被 LaTeX 化为 ``\ldots``。此处仅对"触发词 +
            # 无真数学命令 + 像英文散文"的极明显误判解包还原，真公式一律保留。
            markdown = _unwrap_ellipsis_falsepositive_inline_math(markdown)
            # JSON 文本段补栅栏：引擎（docling/marker）常把内嵌 JSON 例（如
            # ``{ "trends": [...] }``）当作普通正文输出为折叠纯文本，丢失代码语义。
            # 对"非已 fenced、``{``/``[`` 起 + 配对收尾 + ≥2 个 ``"key":`` 且括号
            # 配平"的段落，包裹为 ```json 代码块。检测保守，仅命中明显 JSON。
            markdown = _fence_json_text_paragraphs(markdown)

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

                # 暴露几何/页码信息，供 image_ref_normalizer 做"同页 page-dominant
                # 大图抑制冗余 orphan 碎片"判定（如封面全页图 + 同页噪声碎片）。
                @property
                def width(self) -> Optional[int]:
                    return getattr(self._img, "width", None)

                @property
                def height(self) -> Optional[int]:
                    return getattr(self._img, "height", None)

                @property
                def page_number(self) -> Optional[int]:
                    return getattr(self._img, "page_number", None)

            adapted_images = [_ImageMetaAdapter(img) for img in images]
            markdown = normalize_image_references(markdown, adapted_images)

            # 5. Markdown 格式化
            formatter = MarkdownFormatter()
            markdown = formatter.format(markdown)
            # 圆点项目符展开（须在 formatter 之后：formatter 会把 PDF 硬换行的圆点
            # 项连成空格分隔的 run-on 段 `` ● ``，此处展开为 ``\n- `` 同级列表项）。
            markdown = _expand_bullet_paragraphs(markdown)
            # 编号 run-on 列表拆分（须在 formatter/bullet 之后）：把段内
            # "1. X 2. Y 3. Z" run-on 拆为独立编号项。强信号守卫（从 1 严格递增 +
            # 无 TOC 标记 + 段长<2000 + 跳过 fenced/表格），避免误拆目录与散文。
            markdown = _split_numbered_runon_paragraphs(markdown)
            # 标题首页码剥离：PDF 页眉/页脚的孤立页码（1-3 位数字）有时被引擎并入
            # 下方标题，输出 ``## 1 All my royalties...``。保守剥离（数字后须紧跟空格
            # 非 "."、剩余标题首词大写/引号、剩余 ≥2 词），保留 ``## 1. Get the Mission``
            # 等编号标题与 ``## 10 Tips`` 等短标题。
            markdown = _strip_heading_page_numbers(markdown)
            # display $$ 块去重：公式既以内联 raw LaTeX 字面串（非 $...$ 包裹）
            # 出现在正文又作独立 $$...$$ display 块时，display 为重复抽取，去除。
            markdown = _dedup_inline_display_formulas(markdown)

            # 6. 参考文献节条目分段（多条目连段 → 每条独占段落）
            markdown = _segment_references_section(markdown)

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
        reading_order: float,
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


# 完全包含判定的坐标容差（pt）：吸收 PyMuPDF 文本块 bbox 与 image_extraction
# 位图 bbox 间的取整 / 半像素偏移，避免标签因 1-2pt 越界而漏判。
_FULL_INSIDE_TOLERANCE_PT = 2.0


def _block_fully_inside_region(
    block: TextBlock,
    regions: Dict[int, List[Tuple[float, float, float, float]]],
) -> bool:
    """判断文本块 bbox 是否**完全落入**某区域（四角均在区域内，含 2pt 容差）。

    用于抑制位图内的矢量标签：image_extraction 提取的位图 bbox 精确覆盖实际
    栅格区域，完全落入其中的文本块是叠加在位图上的图内文字（流程图节点 /
    图例 / 面板标题 / 轴标题），位图已烘入其像素，文本块为冗余副本应抑制。

    区别于 ``_block_overlaps_special`` 的 overlap 判定（中心点包含 / IoU≥阈值）：
    完全包含严格得多——要求文本块四角均在图内。图外真实内容（section 标题、
    导言段落）即便与过大的 layout figure region 部分重叠，也不会满足对**精确
    位图 bbox** 的完全包含（标题/段落位于位图实际栅格区之外），故不会被误吞。

    None / 缺 bbox 时返回 False（保守保留，交由下游通用处理）。
    """
    if not block.bbox:
        return False
    rs = regions.get(block.page_number)
    if not rs:
        return False
    bx0, by0, bx1, by1 = block.bbox
    t = _FULL_INSIDE_TOLERANCE_PT
    for rx0, ry0, rx1, ry1 in rs:
        if rx0 - t <= bx0 and bx1 <= rx1 + t and ry0 - t <= by0 and by1 <= ry1 + t:
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

    NFKD 归一（关键）：PyMuPDF 抽取的 inline 公式常为 Unicode 数学字母块字形
    （``A 𝑡 = ⟨ 𝑀 𝜃 𝑡 ...⟩``，U+1D400–1D7FF），旧实现仅保留 ASCII 会把
    ``𝑡/𝑀/𝐻`` 等全部丢弃，签名坍缩为 ``a``，与 MinerU 的 LaTeX 块签名
    ``atmthtutet`` 不匹配 → 两份公式并存（同一公式既有 PyMuPDF inline 文本流
    又有 MinerU ``$$`` 块）。NFKD 把数学字母块折叠为 ASCII 兼容字符（``𝑡→t``、
    ``𝑀→M``、``𝔼→E``），使两种形式签名一致，R8 跨形式去重方能命中。
    """
    # NFKD 折叠 Unicode 数学字母块 → ASCII 兼容字符（跨形式签名对齐前提）
    s = unicodedata.normalize("NFKD", s)
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

    子串匹配仅在公式签名 ≥20 字符且文本块归一化后 ≥20 字符时启用，
    避免短公式 / 短文本互相假阳性。

    精确相等快路径（Q9）：短公式（如 ``A_t = ⟨M,H,U,E⟩`` 签名仅 10 字符）的
    PyMuPDF inline 文本流与 MinerU ``$$`` 块并存时，签名 **完全相等** 而非仅子串。
    完全相等是极强信号——整个文本块字符级恰好等于某公式（同页），几乎不可能是
    正文巧合。故 ``text_sig == fsig`` 且 ≥6 字符时直接判为冗余，绕过 20 字符门。
    """
    page = block.page_number
    sigs = formula_signatures.get(page)
    if not sigs:
        return False
    text_sig = _formula_text_signature(block.text or "")
    # 精确相等快路径：文本块签名恰好等于某公式签名 → 标准的"公式被同时抽成
    # inline 文本流 + 块公式"冗余（Q9）。要求 ≥6 字符防超短巧合。
    if len(text_sig) >= 6 and text_sig in sigs:
        return True
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
    # multiset 兜底（上下标顺序致子串失配）：docling 把行间公式 OCR 成文本流时，
    # 上下标顺序常与 LaTeX 块不一致（如 ``QW_i^Q`` → 文本 ``QW^Q_i``），字符级
    # 子串失配。残影签名虽长(≥15)但其字符 multiset 几乎完全落入同页某公式签名
    # (coverage≥0.75)，且原始文本含 LaTeX 数学标记(``$``/``\sqrt`` 等，强公式
    # 信号——正文段几乎不含) → 判为残影过滤。正文段更长且已在正向子串路径被
    # len_ratio 守卫放行，不会误进此分支；含行内公式的正文段 coverage 也不足
    # (正文词字符占比拉低 overlap/len)。
    if len(text_sig) >= 15 and _LATEX_MATH_MARKER_RE.search(block.text or ""):
        text_ctr = Counter(text_sig)
        for fsig in sigs:
            if len(fsig) < 15:
                continue
            overlap = sum((text_ctr & Counter(fsig)).values())
            if overlap / len(text_sig) >= 0.75:
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


def _is_figure_sublabel(text: str, image_captions_norm: List[str]) -> bool:
    """判断文本块是否为图内矢量标签（已含于图 caption 的冗余子标签）。

    docling 把图内矢量文字（如 Figure 2 子图标签 ``Scaled Dot-Product
    Attention`` / ``Multi-Head Attention``）额外抽成独立文本块，而这些标签
    内容已完整出现在图的 caption（``Figure 2: (left) Scaled Dot-Product
    Attention. (right) Multi-Head Attention ...``）中，作独立正文行显示是冗余。

    判据（同时满足）：
      1. 短词组：``3 <= 词数 <= 6``（子图标签典型长度，排除刻度碎片与长正文）；
      2. 无句末标点（子图标签无 ``.!?``，正文完整句多有）；
      3. 整体是某图 caption 归一化的子串（``norm(text) in norm(caption)``），
         长度 ≥8 字符防超短巧合。

    三判据联立 FP 极低：正文完整句不会整个落入某 caption 子串。
    """
    t = (text or "").strip()
    if not t:
        return False
    if re.search(r"[.!?][\"')\]]*\s*$", t):
        return False
    # 词数按归一化后计：``Multi-Head Attention`` 归一为 ``multi head attention``
    # （破折号转空格）算 3 词；用原始 split 会把 ``Multi-Head`` 当 1 词致漏判。
    norm = _normalize_for_dedup(t)
    if len(norm) < 8:
        return False
    if not (3 <= len(norm.split()) <= 6):
        return False
    return any(norm in cn for cn in image_captions_norm)


# 列表项起手模式（无序 ``-``/``*``/``+`` 或有序 ``1.``/``2)``）
_LIST_ITEM_RE = re.compile(r"^\s*(?:[-*+]\s|\d+[.)]\s)")


def _is_paragraph_boundary(elem) -> bool:
    """元素是否构成段落边界（图打断修正时图不应越过此边界）。

    边界 = 段落的结束/开始：
      - None 或非 text 元素（image/formula/table/code）= 边界；
      - heading（content 以 ``#`` 起手）= 边界；
      - 列表项（``- `` / ``* `` / ``1. `` 起手）= 边界；
      - 以句末标点（``.!?``）结尾的 text = 边界。

    非边界 = 句子延续的普通文本块（不以标点结尾），图可越过它前移到段落首。
    空块视为非边界（可越过）。
    """
    if elem is None:
        return True
    if elem.element_type != "text" or getattr(elem, "block", None) is None:
        return True
    t = (elem.content or "").strip()
    if not t:
        return False
    if t.startswith("#"):
        return True
    if _LIST_ITEM_RE.match(t):
        return True
    return bool(re.search(r"[.!?][\"')\]]*\s*$", t))


def _is_table_runon_echo(text_sig: str, table_sigs: List[str]) -> bool:
    """文本块签名是否为某表格的 run-on 字符流回声。

    PyMuPDF 对同一表格另抽字符流（run-on，无 ``|`` 分隔），与 table_extraction
    的高保真 markdown 表格内容重复，作独立正文段显示是冗余。文本块签名与某
    table 元素签名的字符 multiset coverage≥0.8 时判为回声抑制。

    阈值 0.8：表格 run-on 回声 coverage 通常 ≥0.95（同一内容字符流），而
    讨论表格的正文段（含 recurrence/convolution 等重叠词）coverage <0.75，
    0.8 留足 FP 余量。
    """
    if len(text_sig) < 20:
        return False
    text_ctr = Counter(text_sig)
    for tsig in table_sigs:
        if len(tsig) < 20:
            continue
        overlap = sum((text_ctr & Counter(tsig)).values())
        # coverage≥0.95: run-on 回声字符几乎全在 table sig(同一内容字符流,
        # 回声可能是表格的一部分故不约束长度比例); 讨论表格的正文段(列表项/
        # 单句含 encoder/contains/layers 等非表格词)coverage<0.95, 留足 FP 余量。
        if overlap / len(text_sig) >= 0.95:
            return True
    return False


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


# caption 分隔符：冒号 / 句点 / 连字符 / 竖线（``Figure 8 | ...`` 是本文档及大量
# arXiv 论文的常见写法）。含 ASCII ``|`` 与全角 ``｜`` / 数学竖线 ``∣``。
_FIGURE_TABLE_CAPTION_RE = re.compile(
    r"^\s*(Figure|Fig\.?|Table|Tab\.?)\s+\d+\s*[:.\-|｜∣]",
    re.IGNORECASE,
)

# 表格 markdown 首段为 ``Table N: ...`` 明文 caption（docling 常把标题作为独立
# 首行置于网格之上，非表头格，故 _strip_caption_row_from_grid 不处理）的识别。
_LEADING_TABLE_CAPTION_LINE_RE = re.compile(
    r"^\s*(?:Figure|Fig\.?|Table|Tab\.?)\s+S?\d+\s*[:.][^\n|]*\n",
    re.IGNORECASE,
)


def _strip_leading_caption_paragraph(md: str) -> str:
    """剥离表格 markdown 顶部的 ``Table N: ...`` 明文 caption 段落，保留网格。

    用于 dedup：当同编号 caption 已由独立文本块渲染为 ``**Table N:**`` 粗体段落
    时，表格元素内嵌的明文 caption 首行是冗余副本（渲染为重复的裸文本行）。仅
    当首行是 caption 明文、且其后确有 GFM 网格（``|`` 起手行）时剥离，避免误伤
    无网格的纯文本兜底表格。
    """
    if not md:
        return md
    m = _LEADING_TABLE_CAPTION_LINE_RE.match(md)
    if not m:
        return md
    rest = md[m.end() :].lstrip("\n")
    # 仅当剩余内容确为网格（首个非空行以 ``|`` 起手）才剥离 caption 行
    first_rest = rest.split("\n", 1)[0].strip() if rest else ""
    if first_rest.startswith("|"):
        return rest
    return md


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


def _find_same_page_orphan_caption(
    img_elem: "_ContentElement",
    elements: List["_ContentElement"],
    claimed_captions: set[str],
) -> Optional[str]:
    """邻接兜底失败时，在**同一页**范围内为 captionless 图片寻找游离 caption。

    背景：``Figure N |`` caption 与其图片在阅读序中可能相隔很远（中间夹章节标题
    / 分栏文本），2.5.7 的邻接搜索遇非 text 元素即中断，够不到。典型如本文档
    Figure 8（p39）：图在页首、caption 漂到约 90 行后。

    策略（保守，避免多图页误配）：
      - 仅在该图所在页**恰有唯一** captionless 图片时启用；
      - 仅认领该页 ``Figure N |`` / ``Table N |`` 起手、尚未被其它图片认领
        （``claimed_captions``）的 caption 段；
      - 该页存在 ≥2 个此类游离 caption 时不认领（无法确定对应关系，交由后续
        dedup 保留为独立段落，不制造错配）。

    Returns:
        应注入的 caption 文本（已 strip），无合适候选时 ``None``。
    """
    page = img_elem.page_number
    # 同页 captionless 图片数：>1 则放弃（无法确定 caption 归属）
    captionless_imgs_on_page = [
        e
        for e in elements
        if e.element_type == "image"
        and e.image is not None
        and e.page_number == page
        and not (e.image.caption or "").strip()
    ]
    if len(captionless_imgs_on_page) != 1:
        return None
    # 同页游离 caption 候选：Figure/Table N | 起手、未被认领的 text 段
    candidates = [
        (e.content or "").strip()
        for e in elements
        if e.element_type == "text"
        and e.block is not None
        and e.page_number == page
        and _is_figure_or_table_caption_text((e.content or "").strip())
        and _normalize_for_dedup((e.content or "").strip()) not in claimed_captions
    ]
    if len(candidates) != 1:
        return None
    return candidates[0]


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


_TABLE_CAPTION_CELL_RE = re.compile(r"^Table\s+S?\d+\s+\S")


def _emit_gfm_separator(ncols: int) -> str:
    """生成 ncols 列的 GFM 表格分隔符行。"""
    return "| " + " | ".join("---" for _ in range(max(ncols, 1))) + " |"


def _strip_caption_row_from_grid(md: str) -> tuple[str, Optional[str]]:
    """从 GFM 表格网格中剥离被引擎误并入表头的 ``Table N`` caption。

    部分引擎（如 docling）会把表格标题塞进 markdown 表头，两种形态：
    A. caption 占首格、真实列标题右移一格、数据行首格全空 → 删除首列；
    B. 表头所有格均为同一 caption（广播）、真实表头沦为首个数据行 → 提升。

    返回 (清洗后 md, 抽出的 caption)；非表格或无 caption 污染时原样返回并
    caption=None。重建表格使用统一 GFM 间距并对单元格内 ``|`` 转义以保合法。
    """
    if not md or "|" not in md:
        return md, None
    lines = md.split("\n")
    sep_re = re.compile(r"^\s*\|[\s\-:|]+\|\s*$")

    def is_sep(ln: str) -> bool:
        return bool(sep_re.match(ln))

    def parse_cells(ln: str) -> list[str]:
        s = ln.strip()
        if not s.startswith("|"):
            return []
        s = s[1:-1] if s.endswith("|") else s[1:]
        return [c.strip() for c in s.split("|")]

    def emit_row(cells: list[str]) -> str:
        return "| " + " | ".join(c.replace("|", "\\|") for c in cells) + " |"

    # 定位表头行（| 起始、非分隔符、紧跟分隔符行）
    hi = None
    for i, ln in enumerate(lines):
        if (
            ln.strip().startswith("|")
            and not is_sep(ln)
            and i + 1 < len(lines)
            and is_sep(lines[i + 1])
        ):
            hi = i
            break
    if hi is None:
        return md, None

    header = parse_cells(lines[hi])
    if not header or not _TABLE_CAPTION_CELL_RE.match(header[0]):
        return md, None

    sep_idx = hi + 1
    data_idxs: list[int] = []
    j = sep_idx + 1
    while j < len(lines):
        if not lines[j].strip().startswith("|") or is_sep(lines[j]):
            break
        data_idxs.append(j)
        j += 1
    if not data_idxs:
        return md, None

    before = lines[:hi]
    after = lines[data_idxs[-1] + 1 :]
    nonempty_header = [c for c in header if c]

    # 形态 B：广播 caption（所有非空表头格相同）→ 提升首个数据行为表头
    if len(nonempty_header) >= 2 and len(set(nonempty_header)) == 1:
        caption = nonempty_header[0]
        new_header = parse_cells(lines[data_idxs[0]])
        new_data = [parse_cells(lines[k]) for k in data_idxs[1:]]
        rebuilt = [emit_row(new_header), _emit_gfm_separator(len(new_header))]
        rebuilt.extend(emit_row(r) for r in new_data)
        return "\n".join(before + rebuilt + after), caption

    # 形态 A：caption 在首格 → 删首列（caption 已由 _TABLE_CAPTION_CELL_RE
    # 强匹配 ``Table N + 描述文本`` 确认；兼容 caption 过长折行使数据行首格
    # 沦为 caption 残片的情况，故不要求数据行首格为空）
    if len(header) >= 2:
        caption = header[0]
        new_header = header[1:]
        new_data = [parse_cells(lines[k])[1:] for k in data_idxs]
        rebuilt = [emit_row(new_header), _emit_gfm_separator(len(new_header))]
        rebuilt.extend(emit_row(r) for r in new_data)
        return "\n".join(before + rebuilt + after), caption

    return md, None


def _table_to_markdown(table: ExtractedTable) -> str:
    """将表格转换为 Markdown（带可选标题）。

    先用 ``_strip_caption_row_from_grid`` 清洗被引擎误并入表头的 ``Table N``
    caption（避免标题被复制为首行或吞进表头导致列错位），再把 caption 还原为
    表格上方的粗体段落。当 markdown 首行已等于 caption 文本时不重复添加。
    """
    md, grid_caption = _strip_caption_row_from_grid(table.markdown)
    # 显式 table.caption → 粗体段落（保留原行为）
    if table.caption and table.caption.strip():
        cap_stripped = table.caption.strip()
        # 检查 markdown 首行是否已包含 caption 文本
        first_line = md.split("\n", 1)[0].strip() if md else ""
        if first_line != cap_stripped:
            return f"**{cap_stripped}**\n\n{md}"
        return md
    # 从网格剥离出的 caption → 纯文本段落：与正文 caption 风格一致，且首字符
    # 非 ``*``/``-``/``+``，避免 MarkdownFormatter._format_lists 把 ``**`` 起
    # 手的粗体行首个 ``*`` 误判为列表标记而改写成 ``- *...``。
    if grid_caption:
        return f"{grid_caption}\n\n{md}"
    return md


def _segment_references_section(markdown: str) -> str:
    """对 References 节做条目分段（每条文献独占一段）。

    学术 PDF 的参考文献常被引擎抽为逐行/连段文本块：多条目挤在同一段、且 PDF
    行尾换行被提成段落断词。本函数定位 ``## References`` 标题到下一标题之间的
    内容，按 Springer 作者-年份制的条目起点切分：非逗号前导的空白 + ``Surname
    Initials`` 紧跟 ``,``（多作者列表首作者）或 ``(``（直接接年份），从而把每
    条文献拆为独立段落。找不到 References 节、节内条目 <3、或任何异常时原样返回。
    """
    lines = markdown.split("\n")
    start = None
    for i, ln in enumerate(lines):
        if re.match(r"^#{0,6}\s*References\s*$", ln.strip()):
            start = i
            break
    if start is None:
        return markdown
    end = len(lines)
    end_marker = re.compile(
        r"^(?:#{1,6}\s|(?:Publisher'?s Note|Authors? and Affiliations|"
        r"Author Information|Acknowledg|Funding|Author contributions|"
        r"Conflict of [Ii]nterest|Ethics?|Data [Aa]vailab|Code [Aa]vailab|"
        r"Statistics|Appendix)\b)"
    )
    for j in range(start + 1, len(lines)):
        if end_marker.match(lines[j].strip()):
            end = j
            break
    body = [ln.strip() for ln in lines[start + 1 : end] if ln.strip()]
    if not body:
        return markdown
    text = " ".join(body)
    split_re = re.compile(r"(?<!,)\s+(?=[A-Z][A-Za-zÀ-ÿ’'\-]+ [A-Z]{1,3}(?:,|\s*\())")
    entries = [p.strip() for p in split_re.split(text) if p.strip()]
    if len(entries) < 3:
        return markdown
    rebuilt = [lines[start], ""] + entries
    tail = [""] + lines[end:] if end < len(lines) else []
    return "\n".join(lines[:start] + rebuilt + tail)


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

    # 策略 5: 规整文本模式命令内 Docling 字母拆分（pdf-fidelity R10）
    # Docling/Granite 抽取行间公式时常把 \mathrm{Attention} 输出为
    # ``\mathrm{A t t e n t i o n}``（每字母独立 token + 空格），KaTeX 在文本
    # 模式把这些空格当显式间距渲染，视觉上呈 "A t t e n t i o n" 而非 "Attention"，
    # 与源 PDF 视觉不一致。仅当命令参数**整段**为"≥3 个单字母被空格串联"
    # （纯字母、无多字母词、无符号/波浪号）时合并；``\text{hello world}`` 词间
    # 空格、``\mathrm{O}`` 单字母 token、``\mathrm{where~head}`` 含 ``~`` 均不
    # 满足 fullmatch，原样保留，杜绝误伤合法空格。
    _TEXTUAL_CMD_RE = re.compile(
        r"(\\(?:mathrm|mathit|mathbf|mathsf|texttt|operatorname)\*?\s*\{)([^{}]*)(\})"
    )

    def _merge_spaced_letters(content: str) -> str:
        # 允许首尾空白 + ``~``（LaTeX 不换行空格）作字母间分隔：Docling 输出
        # ``\mathrm{A t t e n t i o n}`` 与 ``\mathrm{where~head}``（拆为
        # ``w h e r e ~ h e a d``），~ 保留作词间分隔，仅合并字母间空白。
        # 仅"≥3 个单字母被 空格/~ 串联"整段匹配时合并。
        if re.fullmatch(r"\s*[a-zA-Z](?:[\s~]+[a-zA-Z]){2,}\s*", content):
            return re.sub(r"\s+", "", content)
        return content

    latex = _TEXTUAL_CMD_RE.sub(
        lambda m: m.group(1) + _merge_spaced_letters(m.group(2)) + m.group(3),
        latex,
    )

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

# "真实代码/数据语言"白名单：effective lang 命中此处时，code 副本权威、删除 text
# 回声（dedup 翻转）。刻意排除 ``html``/``xml``/``css``/``scss``/``markdown`` 等
# 标记/文本类型——docling 常把 TOC、散文、配置说明误标为这些，text 版本更忠实，
# 对它们保持原"优先 text"去重行为，避免把散文错渲染成代码块。
_REAL_CODE_LANGS = frozenset(
    {
        "python",
        "java",
        "javascript",
        "typescript",
        "c",
        "cpp",
        "csharp",
        "rust",
        "go",
        "ruby",
        "php",
        "swift",
        "kotlin",
        "scala",
        "r",
        "perl",
        "lua",
        "bash",
        "powershell",
        "sql",
        "yaml",
        "json",
        "toml",
        "ini",
        "dockerfile",
        "makefile",
        "graphql",
        "protobuf",
    }
)


def _effective_code_lang(code_block: "ExtractedCodeBlock") -> str:
    """计算 code_block 的有效 fence 语言（与 ``_code_block_to_markdown`` 一致）。

    优先 ``code_block.language``（经 ``_CODE_LANG_HEADER_MAP`` 归一化）；为空时回退
    到 "code 首行单独为 lang 关键词" 的推断；都无则返回空串。供 dedup 按 lang 分流。
    """
    lang = (code_block.language or "").strip().lower()
    if lang:
        return _CODE_LANG_HEADER_MAP.get(lang, lang)
    code = code_block.code or ""
    stripped = code.lstrip("\n")
    nl = stripped.find("\n")
    first_line = stripped[:nl] if nl >= 0 else stripped
    return _CODE_LANG_HEADER_MAP.get(first_line.strip().lower(), "")


"""常见编程语言关键词归一化表 → markdown fence highlight 名称。

来源：docling 在某些 PDF 上把代码块首行 ``Python`` / ``Javascript`` 字面字符
当作 ``text`` 输出（label='code' 但 code_language=None），导致 fence info string
缺失且首行 lang 字面被错误塞进代码本体。本表覆盖 R9 实测出现的所有 lang 名，
统一归一化到 ``highlight.js`` 识别的标准 alias（如 ``js → javascript``、
``c++ → cpp``）。
"""


# PDF 符号字体 PUA 编码 → 标准 Unicode 数学符号映射。
# docling 对部分 PDF 符号字体（MathType / Symbol 系）的 PUA 码点无法映射到
# 标准 Unicode，残留为不可见字符。按学术论文高频符号还原（上下文验证）。
_PUA_MATH_CHAR_MAP: dict[str, str] = {
    "\uf638": "∅",  # 空集（算法伪代码 "A <- ∅" / "if A = ∅ then"）
}

_PSEUDOCODE_ALGORITHM_HEADER_RE = re.compile(
    r"^\s*Algorithm\s+\d+", re.IGNORECASE | re.MULTILINE
)
_PSEUDOCODE_REQUIRE_RE = re.compile(r"^\s*Require\s*:", re.IGNORECASE | re.MULTILINE)
_PSEUDOCODE_ENSURE_RE = re.compile(r"^\s*Ensure\s*:", re.IGNORECASE | re.MULTILINE)


def _is_pseudocode(code: str) -> bool:
    r"""检测代码块是否为学术论文伪代码/算法（而非真实编程语言代码）。

    docling/marker 常把 Algorithm 伪代码（含 ``do``/``end do``、``end if`` 等
    Fortran-like 语法）误标为 ``fortran`` 等真实语言，致 fence 错误语法高亮。
    伪代码强信号：

      - 含 ``Algorithm N`` 标题行（最权威）；
      - 同时含 ``Require:`` 与 ``Ensure:`` 算法关键字。

    命中即判为伪代码 → fence 不带 lang info string。
    """
    if not code:
        return False
    if _PSEUDOCODE_ALGORITHM_HEADER_RE.search(code):
        return True
    if _PSEUDOCODE_REQUIRE_RE.search(code) and _PSEUDOCODE_ENSURE_RE.search(code):
        return True
    return False


def _code_block_to_markdown(
    code_block: ExtractedCodeBlock, code_override: Optional[str] = None
) -> str:
    """将代码块转换为 Markdown 代码围栏。

    R9 修复：docling 部分 PDF 上把代码块首行 lang 名字（如 ``Python``）当作
    ``text`` 字段输出，导致 fence info string 丢失且 lang 字面塞入 code body。
    此函数兼容两种来源：

    - ``code_block.language`` 已显式提供 → 用作 fence info string；同时清理
      code body 首行可能残留的同名 lang 字面；
    - ``code_block.language`` 为空但 code 首行单独是 lang 关键词（不区分大小写，
      允许尾随空白）→ 提升为 fence info string，从 body 移除首行。

    不在 :data:`_CODE_LANG_HEADER_MAP` 中的首行不会被吞掉，避免误删合法代码。

    ``code_override`` 非空时替代 ``code_block.code`` 作为 body，供调用方对 code
    body 做预处理（如截断引擎误纳的尾部章节标题/正文）后再走 lang 头推断。
    """
    code = code_override if code_override is not None else (code_block.code or "")
    lang = (code_block.language or "").strip().lower()
    # PUA 符号字体还原：部分 PDF 用符号字体的 PUA 编码渲染数学符号（如空集 ∅），
    # docling 无法映射到标准 Unicode，残留为不可见 PUA 码点。按高频映射还原，
    # 使代码块/算法伪代码中的符号可正确渲染。
    if code and _PUA_MATH_CHAR_MAP:
        for _pua, _uni in _PUA_MATH_CHAR_MAP.items():
            if _pua in code:
                code = code.replace(_pua, _uni)

    # 伪代码/算法：docling/marker 常把 Algorithm 伪代码（含 do/end do 等
    # Fortran-like 语法）误标为 fortran 等真实语言。检测伪代码特征 → 剥离
    # lang，fence 不带 info string，避免错误语法高亮（伪代码无标准语法）。
    if lang and _is_pseudocode(code):
        lang = ""

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


# 真数学命令/符号黑名单：内联 ``$...$`` 内容若命中任一则视为真公式，保守保留。
# 覆盖常见 LaTeX 数学（分数/求和/积分/根号/关系符/希腊字母/上下标等）。
_INLINE_MATH_FALSEPOS_DENY = re.compile(
    r"\\(?:frac|sum|int|sqrt|lim|log|cdot|times|partial|infty|nabla|forall|exists|"
    r"in|notin|le|ge|leq|geq|neq|approx|equiv|pm|mp|div|subset|supset|cup|cap|"
    r"alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|iota|kappa|"
    r"lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|"
    r"Theta|Lambda|Sigma|Phi|Psi|Omega|mathbb|mathcal|mathbf|mathrm|mathsf|"
    r"text|textbf|begin|end|left|right|hat|bar|vec|dot|tilde|overline|underline)\b"
    r"|[\^_]"
)
# 误判触发词：省略号被 LaTeX 化。
_INLINE_MATH_FALSEPOS_TRIGGER = re.compile(r"\\l?dots\b")


def _unwrap_ellipsis_falsepositive_inline_math(markdown: str) -> str:
    """解包"省略号型"内联公式误判。

    MinerU/marker 有时把含 ``...`` 的普通文本（典型为目录条目，如 ``Appendix B -
    AI Agentic ...: From GUI to Real world environment``）误标为 inline formula，
    输出 ``$Appendix B - AI Agentic \\ldots.: From GUI ...$``——省略号被 LaTeX 化为
    ``\\ldots``，整段被 ``$...$`` 包裹，UI 渲染为乱码公式。

    仅对**极明显**的误判解包还原（保守，避免误伤真公式），三条件全部满足才处理：
      1. 内容含 ``\\ldots``/``\\dots``（误判触发词）；
      2. 内容**不含**任何真数学命令/符号（黑名单 ``_INLINE_MATH_FALSEPOS_DENY``）；
      3. 内容含 ≥2 个非 LaTeX-命令的英文词（≥4 字母）——真公式极少如此。

    命中则去掉 ``$...$`` 包裹并把 ``\\ldots``/``\\dots`` 还原为 ``...``；
    ``$$...$$`` 块公式与单行内的多 ``$`` 不受影响（正则用 ``(?<!\\$)\\$(?!\\$)``
    锚定单个 ``$`` 且内容不含 ``$``/换行）。
    """

    def _repl(m: "re.Match[str]") -> str:
        inner = m.group(1)
        if not _INLINE_MATH_FALSEPOS_TRIGGER.search(inner):
            return m.group(0)
        if _INLINE_MATH_FALSEPOS_DENY.search(inner):
            return m.group(0)  # 含真数学命令，保留
        # 非 LaTeX-命令的英文词（≥4 字母）计数
        if len(re.findall(r"(?<!\\)[A-Za-z]{4,}", inner)) < 2:
            return m.group(0)  # 不像英文散文，保守保留（如真数学省略号 $1,\ldots,n$）
        return inner.replace(r"\ldots", "...").replace(r"\dots", "...")

    return re.sub(r"(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)", _repl, markdown)


def _looks_like_json_block(s: str) -> bool:
    """保守判断 ``s`` 是否为一个 JSON 对象/数组文本段。

    必须同时满足（最大程度避免误伤散文）：
      1. 以 ``{`` 或 ``[`` 开头，且以配对的 ``}`` / ``]`` 结尾；
      2. 含 ≥2 个 ``"key":`` / ``'key':`` 映射模式（JSON 的本质特征）；
      3. 花括号/方括号各自配平；
      4. 不含未转义的 ```（避免与已有代码栅栏纠缠）。
    """
    stripped = s.strip()
    if "```" in stripped:
        return False
    if stripped.startswith("{"):
        if not stripped.endswith("}"):
            return False
    elif stripped.startswith("["):
        if not stripped.endswith("]"):
            return False
    else:
        return False
    if len(re.findall(r'"[^"\n]{1,40}"\s*:|\'[^\'\n]{1,40}\'\s*:', stripped)) < 2:
        return False
    if stripped.count("{") != stripped.count("}") or stripped.count(
        "["
    ) != stripped.count("]"):
        return False
    return True


def _fence_json_text_paragraphs(markdown: str) -> str:
    """把误当正文输出的 JSON 文本段包裹为 ```json 代码块。

    引擎常把内嵌 JSON 示例（如 ``{ "trends": [ ... ] }``）作为普通文本块输出，
    渲染为折叠纯文本、丢失代码语义与等宽排版。对每个**非已 fenced**的段落，
    若 ``_looks_like_json_block`` 判定成立，则包裹为 ````` ``json ... `` ``` ``。

    通过段落（``\\n\\n`` 分隔）逐段处理；含 ````` ```` 的段落（已是代码块）原样保留，
    避免双重栅栏。保守的形态判定使散文几乎不会被误判。
    """
    paragraphs = markdown.split("\n\n")
    out: List[str] = []
    for para in paragraphs:
        if "```" in para:
            out.append(para)
            continue
        s = para.strip()
        if s and _looks_like_json_block(s):
            out.append("```json\n" + s + "\n```")
        else:
            out.append(para)
    return "\n\n".join(out)


# 圆点项目符（PDF 列表 bullet）集合：●/○/•。text_extraction 常把整列圆点项压成
# 单段，首项可能已被识为 ``- `` 列表项，后续项以圆点符内联分隔。
_BULLET_CHARS = "●○•▪◦"


def _expand_bullet_paragraphs(markdown: str) -> str:
    """把段落内折叠的圆点项目符（●/○/•/▪/◦）展开为同级 markdown 列表项。

    PDF 源的圆点列表经 text_extraction 常被压成单段，形如：
    ``- Prompt 1: 提取文本。 ● Prompt 2: 总结文本。 ● Prompt 3: 抽取实体。``
    （首项已是 ``- `` 列表项，后续项以 `` ● `` 内联分隔）。本函数把
    `` ● ``/`` ○ ``/`` • `` 等 ``" " + 圆点 + " "`` 替换为 ``"\\n- "``，展开为
    同级 markdown 列表项，恢复可读的列表结构。

    跳过 fenced 代码块与表格段落（含 ````` ```` 或 ``|`` 的段落），避免破坏代码
    与 GFM 表格。**仅处理圆点符**——编号列表（``1. ... 2. ...``）因与目录文本
    ``1. Chapter 1 ... 2. Chapter 2 ...`` 结构难区分、误分裂风险高，暂不处理。
    段落首字符即为圆点的（无前置 ``- ``），亦规整为 ``- `` 列表项。同时兼容两种
    形态：行首裸圆点（``\\n● item``，pre-formatter）与中段内联圆点（`` ● item``，
    post-formatter run-on 段）。
    """
    paragraphs = markdown.split("\n\n")
    out: List[str] = []
    for para in paragraphs:
        if "```" in para or "|" in para:
            out.append(para)
            continue
        if not any(ch in para for ch in _BULLET_CHARS):
            out.append(para)
            continue
        # 1. 行首裸圆点（含换行后的行首）："● Foo" / "\n● Foo" -> "- Foo"
        new = re.sub(r"(?m)^[" + _BULLET_CHARS + r"]\s+", "- ", para)
        # 2. 中段内联圆点（空格分隔的 run-on）：" ● " -> "\n- "
        new = re.sub(r" [" + _BULLET_CHARS + r"] ", "\n- ", new)
        out.append(new)
    return "\n\n".join(out)


# 目录（TOC）文本标记：目录条目也呈 ``1. Chapter 1... 2. Chapter 2...`` 的编号 run-on
# 结构，必须排除以免把目录误拆。命中任一即视为目录段、跳过编号拆分。
_TOC_MARKERS = re.compile(
    r"Chapter \d|Appendix [A-G]|pages \[|last read done|\[final|Index of Terms"
)


def _split_numbered_runon_paragraphs(markdown: str) -> str:
    r"""把 run-on 编号列表段（``1. X 2. Y 3. Z``）拆为独立 markdown 编号项。

    PDF 编号列表经 text_extraction + formatter 常被压成单段 run-on。仅对**强信号**
    的编号列表拆分，最大程度避免误伤散文与目录文本：

      1. 段内含 ≥2 个 ``N. 大写字母`` 项，且编号从 1 起严格递增（1,2,3,...）；
      2. 段**不含**目录标记（``_TOC_MARKERS``：``Chapter N``/``Appendix``/``pages [``
         /``[final``/``last read done``/``Index of Terms``）——目录同为编号 run-on；
      3. 段长 < 2000 字符（backstop，目录段常数千字符）；
      4. 跳过 fenced 代码块与表格段（含 ```` ``` ```` 或 ``|``）。

    命中则把每个 `` N. ``（前导空格的后续项）替换为 ``\nN. ``，首项 ``^1.`` 原位保留，
    拆为独立编号项。注意：PDF 跨页编号列表常被 formatter 切散成多段，本函数仅拆
    「段内 run-on」，跨段碎片不在处理范围（无信息丢失，仅未重组）。
    """
    paragraphs = markdown.split("\n\n")
    out: List[str] = []
    for para in paragraphs:
        if "```" in para or "|" in para:
            out.append(para)
            continue
        if _TOC_MARKERS.search(para) or len(para) > 2000:
            out.append(para)
            continue
        marks = list(re.finditer(r"(?:(?<=^)|(?<= ))(\d+)\. +[A-Z]", para))
        if len(marks) < 2:
            out.append(para)
            continue
        nums = [int(m.group(1)) for m in marks]
        if nums[0] != 1 or any(
            nums[i + 1] != nums[i] + 1 for i in range(len(nums) - 1)
        ):
            out.append(para)
            continue
        # 拆分：把每个 " N. "（前导空格的后续项）替换为 "\nN. "；首项 ^1. 无前导空格不动
        new = re.sub(r" (\d+)\. +", lambda m: "\n" + m.group(1) + ". ", para)
        out.append(new)
    return "\n\n".join(out)


def _strip_heading_page_numbers(markdown: str) -> str:
    r"""剥离标题行首被误并入的页码数字。

    PDF 页眉/页脚的孤立页码（1-3 位数字）有时被引擎与下方标题并入同一文本块，
    输出形如 ``## 1 All my royalties will be donated to Save the Children``。
    对标题行（``#``~``######``）剥离首部的 1-3 位数字 + 空白，仅当全部满足：

      - 数字后紧跟空白（**非 "."**），保留 ``## 1. Get the Mission`` 等编号标题；
      - 剩余标题以大写字母或引号开头（标题首词大写的常规形态）；
      - 剩余标题 ≥2 个词（避免误伤 ``## 10 Tips`` 等短标题）。

    **防误剥章节号**：学术论文 "## 2 Background and Related Work" / "## 3 Methodology"
    等多词标题的章节号曾被误当页码剥离（仅单词标题如 "## 4 Experiments" 因 <2 词
    幸存）。预扫描所有编号标题的数字，若构成连续序列（存在 ≥1 对相邻整数，如
    1,2,3,4,5），判为合法章节号序列——序列内数字（与序列某元素相邻的）**不剥离**；
    仅游离数字（孤立页码）适用上述剥离逻辑。
    """

    # 预扫描：收集所有编号标题的数字，检测连续序列（合法章节号）
    _numbered_nums: set = set()
    for _m in re.finditer(r"^#{1,6} (\d{1,3})\s+.+$", markdown, re.MULTILINE):
        try:
            _numbered_nums.add(int(_m.group(1)))
        except ValueError:
            pass
    _section_nums: set = set()
    if _numbered_nums:
        for _n in _numbered_nums:
            # 与某个其他编号相差 1 → 属于连续序列 → 章节号
            if (_n - 1) in _numbered_nums or (_n + 1) in _numbered_nums:
                _section_nums.add(_n)

    def _strip(m: "re.Match[str]") -> str:
        hashes = m.group(1)
        num = int(m.group(2))
        rest = m.group(3)
        if not rest:
            return m.group(0)
        # 合法章节号序列内的数字不剥离
        if num in _section_nums:
            return m.group(0)
        if rest[0].isupper() or rest[0] in "\"'“‘":
            if len(rest.split()) >= 2:
                return f"{hashes} {rest}"
        return m.group(0)

    return re.sub(
        r"^(#{1,6}) (\d{1,3})\s+(.+)$",
        _strip,
        markdown,
        flags=re.MULTILINE,
    )


def _dedup_inline_display_formulas(markdown: str) -> str:
    r"""去除与正文内联 raw LaTeX 字面串重复的 display ``$$...$$`` 块。

    公式既以内联 raw LaTeX 字面串（**非 ``$...$`` 包裹**，属抽取残留，如
    ``C_{\phi} = {r_{i} \in F_{t} | \phi(r_{i}) = \phi}``）出现在正文段，又
    作独立 ``$$...$$`` display 块时，display 块为重复抽取，去除之。内联 raw
    字面串保留于正文（位置忠实于 PDF 的内联排版）。

    判定：display 块 LaTeX 的 ``_formula_text_signature``（剥 LaTeX 命令 +
    非 alphanumeric，使 ``\phi`` 与 Unicode ``φ`` 归一一致）是"剥离所有
    ``$$...$$`` 与 ``$...$`` 后的正文 raw 文本签名"的子串 → display 重复。

    **安全闸**：仅匹配 raw 字面串（先剥 ``$...$`` 行内数学）；故意内联
    ``$...$`` 数学 + display 并存的论文（``$...$`` 被剥离不参与匹配）不受影响。
    ``≥6`` 字符签名启用（公式签名密集 alphanumeric，巧合子串风险低）。
    """

    # 正文 raw 文本：剥离所有 $$...$$ display 块与 $...$ 行内数学
    non_formula = re.sub(r"\$\$.*?\$\$", "", markdown, flags=re.DOTALL)
    non_formula = re.sub(r"\$[^$]*\$", "", non_formula)
    non_formula_sig = _formula_text_signature(non_formula)
    if len(non_formula_sig) < 6:
        return markdown

    def _replace(m: "re.Match[str]") -> str:
        latex = m.group(1)
        f_sig = _formula_text_signature(latex)
        if len(f_sig) >= 6 and f_sig in non_formula_sig:
            return ""  # display 块与正文内联 raw 字面串重复，去除
        return m.group(0)

    new_md = re.sub(r"\$\$(.*?)\$\$", _replace, markdown, flags=re.DOTALL)
    # 清理去除后遗留的多余空行（≥3 连续换行 → 2）
    return re.sub(r"\n{3,}", "\n\n", new_md)


def _split_code_tail_section(code: str) -> Tuple[str, str]:
    """检测 code body 尾部被引擎误纳的章节标题块并截断。

    docling/marker 有时把代码块后续的章节标题（上下装饰线 + "N Title"）或图表
    caption（``Figure N:`` / ``Table N:``）连同后续正文一起纳入同一 code body。
    检测首处边界并在其前截断：返回 ``(kept_code, tail_text)``，kept_code 为算法/
    代码主体；tail_text 为误纳尾部清洗后的正文（去掉装饰线与裸章节标题行——裸
    标题/重复 caption 通常在块外已有规范版本，由后续 2.7 去重处理）。识别两类
    边界，取最早者：(1) "装饰线(≥10 个 -/=) + 数字标题"；(2) 行首 ``Figure N:``
    / ``Table N:`` caption。无边界则 ``(code, "")``。
    """
    if not code:
        return code, ""
    _starts = []
    m1 = re.search(r"\n[-=]{10,}\s*\n\d+\s+[A-Z][^\n]*", code)
    if m1:
        _starts.append(m1.start())
    # code 块尾部误纳的图表 caption（行首 Figure N: / Table N:）
    m2 = re.search(
        r"\n\s*(?:Figure|Fig\.?|Table|Tab\.?)\s+\d+\s*[:.\-]",
        code,
        re.IGNORECASE,
    )
    if m2:
        _starts.append(m2.start())
    if not _starts:
        return code, ""
    _cut = min(_starts)
    kept = code[:_cut].rstrip()
    tail_raw = code[_cut:].strip()
    # 按 PDF 硬换行拆行、过滤装饰线/裸标题后，把连续正文行用空格合并为单一
    # 段落（PDF 为版面宽度而插入的硬换行不应在 markdown 中断成多段）；仅真正
    # 空行（PDF 段落边界）才切分为新段落，段落间以空行分隔。
    _paragraphs: List[str] = []
    _cur: List[str] = []
    for ln in tail_raw.split("\n"):
        s = ln.strip()
        if not s:
            if _cur:
                _paragraphs.append(" ".join(_cur))
                _cur = []
            continue
        if re.match(r"^[-=]{10,}$", s):
            continue  # 装饰线
        if re.match(r"^\d+\s+[A-Z][^\n]{15,}$", s):
            continue  # 裸章节标题行（冗余，块外已有 ## 版本）
        _cur.append(s)
    if _cur:
        _paragraphs.append(" ".join(_cur))
    tail_text = "\n\n".join(_paragraphs).strip()
    return kept, tail_text


# PDF 点（pt）→ CSS 像素（px）转换因子：
# PDF 标准 72pt = 1in；HTML/CSS 标准 96px = 1in；因此 1pt = 96/72 = 4/3 ≈ 1.333 px。
# 之前 ``_image_to_markdown`` 直接把 bbox 宽（pt 单位）当作 px 输出，导致 figure
# 在 markdown view 中显示为 PDF 原版尺寸的 75%（A4 595pt 全宽 figure 仅 ~595px
# 而非 ~793px），用户视觉感受是"图被压缩到容器宽度的 1/3"。R7 修复后对 figure 按
# 标准 DPI 比例放大，让显示宽度回到 PDF 原版尺寸（在 96 DPI 默认 web rendering
# context 下视觉与 PDF 1:1 等价）。响应式样式 ``max-width:100%;height:auto;``
# 在窄屏下仍能正确缩放，无副作用。
_PDF_PT_TO_CSS_PX = 96.0 / 72.0


def _image_to_markdown(
    image: ExtractedImage, alt_override: Optional[str] = None
) -> str:
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
    # alt_override 非 None 时直接采用（含空串）：同页同 caption 的拆分子图
    # （如 Figure 2 左右子图均被赋同一完整 caption）由调用方传 "" 去重，避免
    # 同一图注重复显示；None 时维持原 caption 优先逻辑。
    if alt_override is not None:
        alt_text = alt_override
    else:
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

    # 极端退化：bbox 与引擎 dims 均缺失时，尽力从原图（local_path 或 base64_data）
    # 读像素尺寸，并按典型内容宽封顶（引擎常以 2x/3x 渲染 figure，原生像素如 2048px
    # 直接做显示宽度会放大数倍）。封顶后等比缩放，确保仍输出**带尺寸的 ``<img>``**
    # （与有 bbox 的图片形态一致），避免裸 ``![]()`` 造成渲染形态不一致。
    if display_w is None and display_h is None:
        try:
            from PIL import Image as _PILImage
            import os as _os
            import base64 as _b64
            import io as _io

            _src = None
            _lp = getattr(image, "local_path", None)
            if _lp and _os.path.exists(_lp):
                _src = _PILImage.open(_lp)
            else:
                _b64d = getattr(image, "base64_data", None)
                if _b64d:
                    _src = _PILImage.open(_io.BytesIO(_b64.b64decode(_b64d)))
            if _src is not None:
                _nw, _nh = _src.size
                _src.close()
                if _nw > 0 and _nh > 0:
                    _MAX_DISPLAY_W = 800
                    if _nw > _MAX_DISPLAY_W:
                        display_w = _MAX_DISPLAY_W
                        display_h = int(round(_nh * _MAX_DISPLAY_W / _nw))
                    else:
                        display_w, display_h = _nw, _nh
        except Exception:
            pass

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
    # 真无任何尺寸信息：仍输出响应式 ``<img>``（无显式 width/height）保证形态一致，
    # 绝不裸 ``![]()``——与有尺寸图片同为 ``<img>`` 标签，渲染行为统一。
    return (
        f'<img src="{html.escape(src, quote=True)}" '
        f'alt="{html.escape(alt_text, quote=True)}" '
        f'style="max-width:100%;height:auto;" />'
    )


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
