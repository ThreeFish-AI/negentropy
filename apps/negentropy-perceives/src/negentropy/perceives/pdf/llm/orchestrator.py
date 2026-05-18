"""LLM 编排多引擎 PDF 转 Markdown 核心模块。

实现三阶段编排流程：

1. **分析阶段 (Analyze)**：PyMuPDF 快速预扫描 + LLM 生成引擎调度计划
2. **执行阶段 (Execute)**：按计划并行调度 Docling / PyMuPDF 等引擎
3. **融合阶段 (Synthesize)**：LLM 评估多引擎输出质量信号，择优合成最终 Markdown

降级策略：LLM 不可用或调用失败时，自动采用默认编排计划（Docling + PyMuPDF，
merge 策略），保证功能可用性。
"""

import asyncio
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from .._imports import import_fitz as _import_fitz
from .._imports import import_pypdf as _import_pypdf
from .client import LLMClient

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 数据类：编排流程输入输出
# ---------------------------------------------------------------------------


@dataclass
class PDFCharacteristics:
    """PDF 文档特征分析结果（Phase 1 预扫描产物）。"""

    page_count: int = 0
    has_tables: bool = False
    has_formulas: bool = False
    has_code_blocks: bool = False
    has_images: bool = False
    has_complex_layout: bool = False
    text_density: str = "normal"  # "sparse" | "normal" | "dense"
    estimated_content_types: List[str] = field(default_factory=list)
    sample_text: str = ""  # 前 500 字符用于 LLM 分析


@dataclass
class EngineTask:
    """单个引擎的执行任务描述。"""

    engine: str  # "docling" | "pymupdf" | "pypdf" | "mineru" | "marker"
    focus: str  # 该引擎的侧重点描述
    priority: int = 0  # 优先级权重（0-10，用于融合阶段）


@dataclass
class OrchestrationPlan:
    """LLM 生成的编排计划。"""

    characteristics: PDFCharacteristics
    engine_tasks: List[EngineTask] = field(default_factory=list)
    synthesis_strategy: str = "merge"  # "best_of" | "merge" | "weighted"
    reasoning: str = ""


@dataclass
class EngineResult:
    """单个引擎的执行结果。"""

    engine: str
    success: bool
    content: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    quality_signals: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class OrchestrationResult:
    """编排最终结果。"""

    content: str
    method_used: str = "smart"
    engines_used: List[str] = field(default_factory=list)
    plan: Optional[OrchestrationPlan] = None
    engine_results: List[EngineResult] = field(default_factory=list)
    synthesis_reasoning: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    enhanced_assets: Dict[str, Any] = field(default_factory=dict)
    page_count: int = 0


# ---------------------------------------------------------------------------
# 质量信号提取工具
# ---------------------------------------------------------------------------


def _extract_quality_signals(content: str) -> Dict[str, Any]:
    """从 Markdown 内容中提取质量信号指标。"""
    if not content:
        return {"word_count": 0, "is_empty": True}

    lines = content.split("\n")
    heading_count = sum(1 for line in lines if re.match(r"^#{1,6}\s+", line))
    table_pipe_count = sum(
        1 for line in lines if "|" in line and line.strip().startswith("|")
    )
    formula_block_count = len(re.findall(r"\$\$[\s\S]+?\$\$", content))
    formula_inline_count = len(re.findall(r"(?<!\$)\$(?!\$)([^$]+?)\$(?!\$)", content))
    code_fence_count = len(re.findall(r"```", content)) // 2
    image_count = len(re.findall(r"!\[.*?\]\(.*?\)", content))
    list_count = sum(
        1
        for line in lines
        if re.match(r"^\s*[-*+]\s+", line) or re.match(r"^\s*\d+\.\s+", line)
    )

    return {
        "word_count": len(content.split()),
        "char_count": len(content),
        "line_count": len(lines),
        "heading_count": heading_count,
        "table_lines": table_pipe_count,
        "formula_block_count": formula_block_count,
        "formula_inline_count": formula_inline_count,
        "code_fence_count": code_fence_count,
        "image_count": image_count,
        "list_count": list_count,
        "is_empty": False,
    }


# ---------------------------------------------------------------------------
# 默认编排计划
# ---------------------------------------------------------------------------

_DEFAULT_PLAN = OrchestrationPlan(
    characteristics=PDFCharacteristics(),
    engine_tasks=[
        EngineTask(
            engine="docling",
            focus="全文档高保真转换（布局、表格、公式、代码）",
            priority=8,
        ),
        EngineTask(engine="pymupdf", focus="快速文本提取作为参考与补充", priority=5),
    ],
    synthesis_strategy="merge",
    reasoning="默认双引擎策略：Docling 为主体，PyMuPDF 补充缺失内容",
)


# ---------------------------------------------------------------------------
# Prompt 模板
# ---------------------------------------------------------------------------

_ANALYSIS_SYSTEM_PROMPT = """你是一个 PDF 文档分析专家。根据文档特征，决定最佳的多引擎处理策略。
请始终以 JSON 格式返回结果，不要添加任何额外说明。"""

_ANALYSIS_USER_TEMPLATE = """PDF 文档特征：
- 页数：{page_count}
- 包含表格：{has_tables}
- 包含公式：{has_formulas}
- 包含代码块：{has_code_blocks}
- 包含图片：{has_images}
- 布局复杂度：{layout_complexity}
- 文本密度：{text_density}
- 内容类型：{content_types}
- 文本样本（前500字符）：{sample_text}

可用引擎：
1. docling：AI 布局分析 + TableFormer 表格结构识别 + 代码检测 + 公式提取（慢，高保真）
2. pymupdf：快速文本提取 + 启发式增强（快，中保真）
3. pypdf：纯 Python 基础提取（最快，低保真）

请以 JSON 格式返回引擎调度计划：
{{
  "engine_tasks": [
    {{"engine": "docling 或 pymupdf 或 pypdf", "focus": "侧重点描述", "priority": 0到10的整数}}
  ],
  "synthesis_strategy": "best_of 或 merge 或 weighted",
  "reasoning": "决策理由"
}}"""

_SYNTHESIS_SYSTEM_PROMPT = """你是一个文档质量评估专家。根据多个引擎的处理结果质量信号，决定最优合成策略。
请始终以 JSON 格式返回结果，不要添加任何额外说明。"""

_SYNTHESIS_USER_TEMPLATE = """多引擎处理结果摘要：

{engine_summaries}

融合策略：{synthesis_strategy}

请以 JSON 格式返回合成决策：
{{
  "primary_engine": "选择作为主体的引擎名",
  "supplements": [
    {{"from_engine": "补充源引擎名", "content_type": "tables 或 formulas 或 code_blocks 或 images", "reason": "补充理由"}}
  ],
  "reasoning": "综合决策理由"
}}"""


# ---------------------------------------------------------------------------
# LLM 编排器
# ---------------------------------------------------------------------------


class LLMOrchestrator:
    """LLM 编排多引擎 PDF 处理中枢。

    三阶段流程：

    1. ``_analyze_pdf()``：PyMuPDF 快速预扫描 + LLM 分析 → ``OrchestrationPlan``
    2. ``_execute_engines()``：按计划并行调度引擎 → ``List[EngineResult]``
    3. ``_synthesize_results()``：LLM 评估质量信号 → ``OrchestrationResult``
    """

    def __init__(
        self,
        llm_client: LLMClient,
        docling_engine: Optional[Any] = None,
        output_dir: Optional[str] = None,
    ) -> None:
        self._llm = llm_client
        self._docling_engine = docling_engine
        self._output_dir = output_dir

    # ------------------------------------------------------------------
    # 主入口
    # ------------------------------------------------------------------

    async def orchestrate(
        self,
        pdf_path: Path,
        page_range: Optional[tuple] = None,
        extract_images: bool = True,
        extract_tables: bool = True,
        extract_formulas: bool = True,
    ) -> OrchestrationResult:
        """执行完整的三阶段编排流程。"""

        # Phase 1: 分析
        plan = await self._analyze_pdf(pdf_path, page_range)
        logger.info(
            "编排计划: engines=%s, strategy=%s, reasoning=%s",
            [t.engine for t in plan.engine_tasks],
            plan.synthesis_strategy,
            plan.reasoning[:100],
        )

        # Phase 2: 并行执行
        engine_results = await self._execute_engines(pdf_path, plan, page_range)
        successful = [r for r in engine_results if r.success]
        logger.info(
            "引擎执行完成: %d/%d 成功",
            len(successful),
            len(engine_results),
        )

        if not successful:
            return OrchestrationResult(
                content="",
                method_used="smart",
                engines_used=[],
                plan=plan,
                engine_results=engine_results,
                synthesis_reasoning="所有引擎均失败",
            )

        # 仅一个成功引擎时直接返回
        if len(successful) == 1:
            r = successful[0]
            return OrchestrationResult(
                content=r.content,
                method_used="smart",
                engines_used=[r.engine],
                plan=plan,
                engine_results=engine_results,
                synthesis_reasoning=f"仅 {r.engine} 引擎成功，直接使用其输出",
                metadata=r.metadata,
                enhanced_assets=r.metadata.get("enhanced_assets", {}),
                page_count=r.metadata.get("page_count", 0),
            )

        # Phase 3: 融合
        result = await self._synthesize_results(plan, engine_results)
        return result

    # ------------------------------------------------------------------
    # Phase 1: PDF 特征分析
    # ------------------------------------------------------------------

    async def _analyze_pdf(
        self, pdf_path: Path, page_range: Optional[tuple]
    ) -> OrchestrationPlan:
        """Phase 1: PyMuPDF 快速预扫描 + LLM 调度决策。"""
        characteristics = self._quick_scan(pdf_path, page_range)

        try:
            plan = await self._llm_plan(characteristics)
            plan.characteristics = characteristics
            return plan
        except Exception as e:
            logger.warning("LLM 分析阶段失败，使用默认计划: %s", e)
            default = OrchestrationPlan(
                characteristics=characteristics,
                engine_tasks=list(_DEFAULT_PLAN.engine_tasks),
                synthesis_strategy=_DEFAULT_PLAN.synthesis_strategy,
                reasoning=f"LLM 分析失败({e})，使用默认双引擎策略",
            )
            return default

    def _quick_scan(
        self, pdf_path: Path, page_range: Optional[tuple]
    ) -> PDFCharacteristics:
        """使用 PyMuPDF 快速预扫描 PDF 特征（轻量级，~0.1-0.5s）。"""
        try:
            fitz = _import_fitz()
        except ImportError:
            return PDFCharacteristics()

        chars = PDFCharacteristics()

        try:
            doc = fitz.open(str(pdf_path))
            chars.page_count = doc.page_count

            start_page = 0
            end_page = doc.page_count
            if page_range:
                start_page = max(0, page_range[0] - 1)
                end_page = min(doc.page_count, page_range[1])

            sample_texts: List[str] = []
            total_chars = 0
            image_count = 0
            math_font_count = 0
            table_indicator_count = 0
            code_indicator_count = 0

            # 仅扫描前 5 页（或指定范围内的前 5 页）
            scan_pages = min(5, end_page - start_page)
            for page_idx in range(start_page, start_page + scan_pages):
                page = doc[page_idx]

                # 文本与字体分析
                text_dict = page.get_text("dict", flags=0)
                page_text = page.get_text("text")
                total_chars += len(page_text)
                if len("\n".join(sample_texts)) < 500:
                    sample_texts.append(page_text[:200])

                # 图片数量
                image_count += len(page.get_images())

                # 字体分析：检测数学字体
                for block in text_dict.get("blocks", []):
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            font_name = span.get("font", "").lower()
                            if any(
                                kw in font_name
                                for kw in ("math", "symbol", "cmr", "stix", "cambria")
                            ):
                                math_font_count += 1

                # 表格指示器：查找管道符号行
                for line in page_text.split("\n"):
                    stripped = line.strip()
                    if (
                        stripped.startswith("|")
                        and stripped.endswith("|")
                        and stripped.count("|") >= 3
                    ):
                        table_indicator_count += 1
                    # 代码指示器：缩进 >= 4 的行
                    if re.match(r"^    \S", line) or "def " in line or "class " in line:
                        code_indicator_count += 1

            doc.close()

            # 综合判断
            chars.has_images = image_count > 0
            chars.has_formulas = math_font_count > 3
            chars.has_tables = table_indicator_count > 2
            chars.has_code_blocks = code_indicator_count > 5
            chars.sample_text = "\n".join(sample_texts)[:500]

            # 文本密度
            avg_chars_per_page = total_chars / max(scan_pages, 1)
            if avg_chars_per_page < 200:
                chars.text_density = "sparse"
            elif avg_chars_per_page > 2000:
                chars.text_density = "dense"
            else:
                chars.text_density = "normal"

            # 布局复杂度
            chars.has_complex_layout = (
                chars.has_tables or chars.has_formulas or chars.has_images
            )

            # 内容类型摘要
            content_types = []
            if chars.has_tables:
                content_types.append("表格")
            if chars.has_formulas:
                content_types.append("数学公式")
            if chars.has_code_blocks:
                content_types.append("代码块")
            if chars.has_images:
                content_types.append("图片")
            chars.estimated_content_types = content_types or ["纯文本"]

        except Exception as e:
            logger.warning("PyMuPDF 预扫描失败: %s", e)

        return chars

    async def _llm_plan(self, characteristics: PDFCharacteristics) -> OrchestrationPlan:
        """LLM 根据 PDF 特征生成引擎调度计划。"""
        user_msg = _ANALYSIS_USER_TEMPLATE.format(
            page_count=characteristics.page_count,
            has_tables=characteristics.has_tables,
            has_formulas=characteristics.has_formulas,
            has_code_blocks=characteristics.has_code_blocks,
            has_images=characteristics.has_images,
            layout_complexity="高" if characteristics.has_complex_layout else "低",
            text_density=characteristics.text_density,
            content_types="、".join(characteristics.estimated_content_types),
            sample_text=characteristics.sample_text[:300],
        )

        response = await self._llm.acomplete(
            messages=[
                {"role": "system", "content": _ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            response_format={"type": "json_object"},
        )

        data = LLMClient.parse_json_response(response)
        if "error" in data:
            raise ValueError(f"LLM 返回无法解析的 JSON: {data.get('raw', '')[:200]}")

        # 解析引擎任务
        engine_tasks = []
        for task_data in data.get("engine_tasks", []):
            engine = task_data.get("engine", "")
            if engine in ("docling", "pymupdf", "pypdf", "mineru", "marker"):
                # 过滤不可用的引擎
                if engine == "docling" and not (
                    self._docling_engine
                    and hasattr(self._docling_engine, "is_available")
                    and self._docling_engine.is_available()
                ):
                    logger.info("LLM 计划中包含 docling 但不可用,跳过")
                    continue
                if engine == "mineru":
                    from ..engines.mineru import MinerUEngine

                    if not MinerUEngine.is_available():
                        logger.info("LLM 计划中包含 mineru 但不可用,跳过")
                        continue
                if engine == "marker":
                    from ..engines.marker import MarkerEngine

                    if not MarkerEngine.is_available():
                        logger.info("LLM 计划中包含 marker 但不可用,跳过")
                        continue
                engine_tasks.append(
                    EngineTask(
                        engine=engine,
                        focus=task_data.get("focus", ""),
                        priority=int(task_data.get("priority", 5)),
                    )
                )

        # 确保至少有一个引擎
        if not engine_tasks:
            engine_tasks = [EngineTask(engine="pymupdf", focus="文本提取", priority=5)]

        strategy = data.get("synthesis_strategy", "merge")
        if strategy not in ("best_of", "merge", "weighted"):
            strategy = "merge"

        return OrchestrationPlan(
            characteristics=characteristics,
            engine_tasks=engine_tasks,
            synthesis_strategy=strategy,
            reasoning=data.get("reasoning", ""),
        )

    # ------------------------------------------------------------------
    # Phase 2: 并行引擎执行
    # ------------------------------------------------------------------

    async def _execute_engines(
        self,
        pdf_path: Path,
        plan: OrchestrationPlan,
        page_range: Optional[tuple],
    ) -> List[EngineResult]:
        """Phase 2: 按计划并行调度引擎。"""
        tasks = []
        for engine_task in plan.engine_tasks:
            if engine_task.engine == "docling":
                tasks.append(self._run_docling(pdf_path, page_range))
            elif engine_task.engine == "pymupdf":
                tasks.append(self._run_pymupdf(pdf_path, page_range))
            elif engine_task.engine == "pypdf":
                tasks.append(self._run_pypdf(pdf_path, page_range))
            elif engine_task.engine == "mineru":
                tasks.append(self._run_mineru(pdf_path, page_range))
            elif engine_task.engine == "marker":
                tasks.append(self._run_marker(pdf_path, page_range))
            elif engine_task.engine == "mineru":
                tasks.append(self._run_mineru(pdf_path, page_range))
            elif engine_task.engine == "marker":
                tasks.append(self._run_marker(pdf_path, page_range))

        if not tasks:
            return []

        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        engine_results: List[EngineResult] = []
        for i, raw in enumerate(raw_results):
            engine_name = (
                plan.engine_tasks[i].engine if i < len(plan.engine_tasks) else "unknown"
            )
            if isinstance(raw, Exception):
                engine_results.append(
                    EngineResult(
                        engine=engine_name,
                        success=False,
                        error=str(raw),
                    )
                )
            elif isinstance(raw, EngineResult):
                engine_results.append(raw)
            else:
                engine_results.append(
                    EngineResult(
                        engine=engine_name,
                        success=False,
                        error=f"意外的返回类型: {type(raw)}",
                    )
                )

        return engine_results

    async def _run_docling(
        self, pdf_path: Path, page_range: Optional[tuple]
    ) -> EngineResult:
        """执行 Docling 引擎。"""
        if not self._docling_engine:
            return EngineResult(
                engine="docling", success=False, error="Docling 引擎不可用"
            )

        try:
            from ...core.cancellation import current_cancel_scope
            from ...infra import get_engine_pool

            _scope = current_cancel_scope()
            # 复用 processor 侧同一组 init_kwargs；若未预置则最小化配置
            _init_kwargs = getattr(self, "_docling_init_kwargs", None) or {
                "output_dir": str(self._output_dir) if self._output_dir else None,
            }
            result = await get_engine_pool().run(
                "docling",
                kwargs={"pdf_path": str(pdf_path), "page_range": page_range},
                init_kwargs=_init_kwargs,
                deadline_monotonic=_scope.deadline_monotonic if _scope else None,
            )
            if not result or not result.markdown:
                return EngineResult(
                    engine="docling", success=False, error="Docling 返回空结果"
                )

            quality = _extract_quality_signals(result.markdown)

            # 构建 enhanced_assets
            enhanced_assets: Dict[str, Any] = {}
            if result.images:
                enhanced_assets["images"] = {
                    "count": len(result.images),
                    "items": [
                        {
                            "caption": img.caption or "",
                            "page": img.page_number,
                            "classification": img.classification,
                        }
                        for img in result.images
                    ],
                }
            if result.tables:
                enhanced_assets["tables"] = {
                    "count": len(result.tables),
                    "items": [
                        {
                            "rows": t.rows,
                            "columns": t.columns,
                            "caption": t.caption or "",
                            "page": t.page_number,
                        }
                        for t in result.tables
                    ],
                }
            if result.formulas:
                enhanced_assets["formulas"] = {
                    "count": len(result.formulas),
                    "block_count": sum(
                        1 for f in result.formulas if f.formula_type == "block"
                    ),
                    "inline_count": sum(
                        1 for f in result.formulas if f.formula_type == "inline"
                    ),
                }
            if result.code_blocks:
                enhanced_assets["code_blocks"] = {
                    "count": len(result.code_blocks),
                    "languages": list(
                        {cb.language for cb in result.code_blocks if cb.language}
                    ),
                }

            return EngineResult(
                engine="docling",
                success=True,
                content=result.markdown,
                metadata={
                    "page_count": result.page_count,
                    "enhanced_assets": enhanced_assets,
                    "docling_metadata": result.metadata,
                },
                quality_signals=quality,
            )
        except Exception as e:
            logger.warning("Docling 引擎执行失败: %s", e)
            return EngineResult(engine="docling", success=False, error=str(e))

    async def _run_pymupdf(
        self, pdf_path: Path, page_range: Optional[tuple]
    ) -> EngineResult:
        """执行 PyMuPDF 引擎。"""
        try:
            fitz = _import_fitz()
        except ImportError as e:
            return EngineResult(engine="pymupdf", success=False, error=str(e))

        try:
            doc = fitz.open(str(pdf_path))
            start_page = 0
            end_page = doc.page_count
            if page_range:
                start_page = max(0, page_range[0] - 1)
                end_page = min(doc.page_count, page_range[1])

            pages_text: List[str] = []
            for page_idx in range(start_page, end_page):
                page = doc[page_idx]
                text = page.get_text("text")
                pages_text.append(text)

            doc.close()
            content = "\n\n".join(pages_text)
            quality = _extract_quality_signals(content)

            return EngineResult(
                engine="pymupdf",
                success=True,
                content=content,
                metadata={"page_count": end_page - start_page},
                quality_signals=quality,
            )
        except Exception as e:
            logger.warning("PyMuPDF 引擎执行失败: %s", e)
            return EngineResult(engine="pymupdf", success=False, error=str(e))

    async def _run_mineru(
        self, pdf_path: Path, page_range: Optional[tuple]
    ) -> EngineResult:
        """执行 MinerU 引擎。"""
        try:
            from ..engines.mineru import MinerUEngine

            if not MinerUEngine.is_available():
                return EngineResult(
                    engine="mineru", success=False, error="MinerU 未安装"
                )

            from ...core.cancellation import current_cancel_scope
            from ...infra import get_engine_pool

            _scope = current_cancel_scope()
            result = await get_engine_pool().run(
                "mineru",
                kwargs={"pdf_path": str(pdf_path), "page_range": page_range},
                init_kwargs={
                    "output_dir": str(self._output_dir) if self._output_dir else None,
                },
                deadline_monotonic=_scope.deadline_monotonic if _scope else None,
            )
            if not result or not result.markdown:
                return EngineResult(
                    engine="mineru", success=False, error="MinerU 返回空结果"
                )

            quality = _extract_quality_signals(result.markdown)

            # 构建 enhanced_assets
            enhanced_assets: Dict[str, Any] = {}
            if result.images:
                enhanced_assets["images"] = {
                    "count": len(result.images),
                    "items": [
                        {
                            "caption": img.caption or "",
                            "page": img.page_number,
                            "filename": img.filename,
                            "local_path": img.local_path,
                        }
                        for img in result.images
                    ],
                }
            if result.tables:
                enhanced_assets["tables"] = {
                    "count": len(result.tables),
                    "items": [
                        {
                            "rows": t.rows,
                            "columns": t.columns,
                            "caption": t.caption or "",
                            "page": t.page_number,
                        }
                        for t in result.tables
                    ],
                }
            if result.formulas:
                enhanced_assets["formulas"] = {
                    "count": len(result.formulas),
                    "block_count": sum(
                        1 for f in result.formulas if f.formula_type == "block"
                    ),
                    "inline_count": sum(
                        1 for f in result.formulas if f.formula_type == "inline"
                    ),
                }

            return EngineResult(
                engine="mineru",
                success=True,
                content=result.markdown,
                metadata={
                    "page_count": result.page_count,
                    "enhanced_assets": enhanced_assets,
                    "mineru_metadata": result.metadata,
                },
                quality_signals=quality,
            )
        except Exception as e:
            logger.warning("MinerU 引擎执行失败: %s", e)
            return EngineResult(engine="mineru", success=False, error=str(e))

    async def _run_marker(
        self, pdf_path: Path, page_range: Optional[tuple]
    ) -> EngineResult:
        """执行 Marker 引擎。"""
        try:
            from ..engines.marker import MarkerEngine

            if not MarkerEngine.is_available():
                return EngineResult(
                    engine="marker", success=False, error="Marker 未安装"
                )

            from ...core.cancellation import current_cancel_scope
            from ...infra import get_engine_pool

            _scope = current_cancel_scope()
            output_dir_str = str(self._output_dir) if self._output_dir else None
            result = await get_engine_pool().run(
                "marker",
                kwargs={"pdf_path": str(pdf_path), "embed_images": False},
                init_kwargs={"output_dir": output_dir_str},
                deadline_monotonic=_scope.deadline_monotonic if _scope else None,
            )
            if not result or not result.markdown:
                return EngineResult(
                    engine="marker", success=False, error="Marker 返回空结果"
                )

            quality = _extract_quality_signals(result.markdown)

            # 构建 enhanced_assets
            enhanced_assets: Dict[str, Any] = {}
            if result.images:
                enhanced_assets["images"] = {
                    "count": len(result.images),
                    "items": [
                        {
                            "caption": img.caption or "",
                            "page": img.page_number,
                            "filename": img.filename,
                            "local_path": img.local_path,
                        }
                        for img in result.images
                    ],
                }
            if result.tables:
                enhanced_assets["tables"] = {
                    "count": len(result.tables),
                    "items": [
                        {
                            "rows": t.rows,
                            "columns": t.columns,
                            "caption": t.caption or "",
                            "page": t.page_number,
                        }
                        for t in result.tables
                    ],
                }
            if result.formulas:
                enhanced_assets["formulas"] = {
                    "count": len(result.formulas),
                    "block_count": sum(
                        1 for f in result.formulas if f.formula_type == "block"
                    ),
                    "inline_count": sum(
                        1 for f in result.formulas if f.formula_type == "inline"
                    ),
                }
            if result.code_blocks:
                enhanced_assets["code_blocks"] = {
                    "count": len(result.code_blocks),
                    "languages": list(
                        {cb.language for cb in result.code_blocks if cb.language}
                    ),
                }

            return EngineResult(
                engine="marker",
                success=True,
                content=result.markdown,
                metadata={
                    "page_count": result.page_count,
                    "enhanced_assets": enhanced_assets,
                    "marker_metadata": result.metadata,
                },
                quality_signals=quality,
            )
        except Exception as e:
            logger.warning("Marker 引擎执行失败: %s", e)
            return EngineResult(engine="marker", success=False, error=str(e))

    async def _run_pypdf(
        self, pdf_path: Path, page_range: Optional[tuple]
    ) -> EngineResult:
        """执行 PyPDF 引擎。"""
        try:
            pypdf = _import_pypdf()
        except ImportError as e:
            return EngineResult(engine="pypdf", success=False, error=str(e))

        try:
            reader = pypdf.PdfReader(str(pdf_path))
            start_page = 0
            end_page = len(reader.pages)
            if page_range:
                start_page = max(0, page_range[0] - 1)
                end_page = min(len(reader.pages), page_range[1])

            pages_text: List[str] = []
            for page_idx in range(start_page, end_page):
                text = reader.pages[page_idx].extract_text() or ""
                pages_text.append(text)

            content = "\n\n".join(pages_text)
            quality = _extract_quality_signals(content)

            return EngineResult(
                engine="pypdf",
                success=True,
                content=content,
                metadata={"page_count": end_page - start_page},
                quality_signals=quality,
            )
        except Exception as e:
            logger.warning("PyPDF 引擎执行失败: %s", e)
            return EngineResult(engine="pypdf", success=False, error=str(e))

    # ------------------------------------------------------------------
    # Phase 3: 结果融合
    # ------------------------------------------------------------------

    async def _synthesize_results(
        self,
        plan: OrchestrationPlan,
        engine_results: List[EngineResult],
    ) -> OrchestrationResult:
        """Phase 3: LLM 评估多引擎输出质量信号并合成最终结果。"""
        successful = [r for r in engine_results if r.success]
        if not successful:
            return OrchestrationResult(
                content="",
                method_used="smart",
                plan=plan,
                engine_results=engine_results,
                synthesis_reasoning="所有引擎均失败",
            )

        # 构建引擎摘要
        engine_summaries = []
        for r in successful:
            qs = r.quality_signals
            summary = (
                f"引擎: {r.engine}\n"
                f"  字数: {qs.get('word_count', 0)}\n"
                f"  标题数: {qs.get('heading_count', 0)}\n"
                f"  表格行数: {qs.get('table_lines', 0)}\n"
                f"  块级公式: {qs.get('formula_block_count', 0)}\n"
                f"  行内公式: {qs.get('formula_inline_count', 0)}\n"
                f"  代码块数: {qs.get('code_fence_count', 0)}\n"
                f"  图片引用: {qs.get('image_count', 0)}\n"
                f"  列表项数: {qs.get('list_count', 0)}"
            )
            engine_summaries.append(summary)

        try:
            decision = await self._llm_synthesize(
                "\n\n".join(engine_summaries),
                plan.synthesis_strategy,
            )
        except Exception as e:
            logger.warning("LLM 融合阶段失败，使用启发式融合: %s", e)
            decision = self._heuristic_synthesize(successful, plan)

        return self._apply_synthesis_decision(
            decision, successful, plan, engine_results
        )

    async def _llm_synthesize(
        self, engine_summaries: str, strategy: str
    ) -> Dict[str, Any]:
        """LLM 评估质量信号并返回合成决策。"""
        user_msg = _SYNTHESIS_USER_TEMPLATE.format(
            engine_summaries=engine_summaries,
            synthesis_strategy=strategy,
        )

        response = await self._llm.acomplete(
            messages=[
                {"role": "system", "content": _SYNTHESIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            response_format={"type": "json_object"},
        )

        data = LLMClient.parse_json_response(response)
        if "error" in data:
            raise ValueError(f"LLM 融合决策解析失败: {data.get('raw', '')[:200]}")

        return data

    def _heuristic_synthesize(
        self,
        successful: List[EngineResult],
        plan: OrchestrationPlan,
    ) -> Dict[str, Any]:
        """启发式融合决策（LLM 不可用时的回退）。

        选择质量信号综合最优的引擎为主体，其他引擎作为补充源。
        """
        # 按优先级排序（plan 中 priority 更高的引擎优先）
        engine_priority = {t.engine: t.priority for t in plan.engine_tasks}
        scored = []
        for r in successful:
            qs = r.quality_signals
            # 综合评分：结构化内容越多越好
            score = (
                qs.get("word_count", 0) * 0.001
                + qs.get("heading_count", 0) * 5
                + qs.get("table_lines", 0) * 3
                + qs.get("formula_block_count", 0) * 10
                + qs.get("formula_inline_count", 0) * 2
                + qs.get("code_fence_count", 0) * 5
                + qs.get("image_count", 0) * 3
                + engine_priority.get(r.engine, 0) * 2
            )
            scored.append((score, r))

        scored.sort(key=lambda x: x[0], reverse=True)
        primary = scored[0][1]

        supplements = []
        if len(scored) > 1:
            secondary = scored[1][1]
            p_qs = primary.quality_signals
            s_qs = secondary.quality_signals

            # 检查次优引擎是否在某些维度更强
            if s_qs.get("table_lines", 0) > p_qs.get("table_lines", 0) * 1.5:
                supplements.append(
                    {
                        "from_engine": secondary.engine,
                        "content_type": "tables",
                        "reason": "表格更丰富",
                    }
                )
            if (
                s_qs.get("formula_block_count", 0) + s_qs.get("formula_inline_count", 0)
                > (
                    p_qs.get("formula_block_count", 0)
                    + p_qs.get("formula_inline_count", 0)
                )
                * 1.5
            ):
                supplements.append(
                    {
                        "from_engine": secondary.engine,
                        "content_type": "formulas",
                        "reason": "公式更完整",
                    }
                )
            if s_qs.get("code_fence_count", 0) > p_qs.get("code_fence_count", 0) * 1.5:
                supplements.append(
                    {
                        "from_engine": secondary.engine,
                        "content_type": "code_blocks",
                        "reason": "代码块更多",
                    }
                )

        return {
            "primary_engine": primary.engine,
            "supplements": supplements,
            "reasoning": f"启发式评分：{primary.engine} 得分最高",
        }

    def _apply_synthesis_decision(
        self,
        decision: Dict[str, Any],
        successful: List[EngineResult],
        plan: OrchestrationPlan,
        all_results: List[EngineResult],
    ) -> OrchestrationResult:
        """执行合成决策，生成最终结果。"""
        primary_name = decision.get("primary_engine", "")
        primary_result = next(
            (r for r in successful if r.engine == primary_name),
            successful[0],  # 回退到第一个成功引擎
        )

        final_content = primary_result.content
        engines_used = [primary_result.engine]
        supplements = decision.get("supplements", [])

        # merge 策略：从补充引擎中提取缺失的结构化内容
        if supplements and plan.synthesis_strategy == "merge":
            for supplement in supplements:
                from_engine = supplement.get("from_engine", "")
                content_type = supplement.get("content_type", "")
                source_result = next(
                    (r for r in successful if r.engine == from_engine),
                    None,
                )
                if source_result:
                    final_content = self._merge_content(
                        final_content, source_result.content, content_type
                    )
                    if from_engine not in engines_used:
                        engines_used.append(from_engine)

        # 收集 metadata 和 enhanced_assets
        metadata = primary_result.metadata.copy()
        enhanced_assets = metadata.pop("enhanced_assets", {})
        page_count = metadata.get("page_count", plan.characteristics.page_count)

        return OrchestrationResult(
            content=final_content,
            method_used="smart",
            engines_used=engines_used,
            plan=plan,
            engine_results=all_results,
            synthesis_reasoning=decision.get("reasoning", ""),
            metadata=metadata,
            enhanced_assets=enhanced_assets,
            page_count=page_count,
        )

    def _merge_content(self, primary: str, secondary: str, content_type: str) -> str:
        """从 secondary 中提取指定类型的结构化内容，补充到 primary 中。

        采用保守策略：仅在 primary 中缺失时补充，避免重复。
        """
        if content_type == "tables":
            return self._merge_tables(primary, secondary)
        elif content_type == "formulas":
            return self._merge_formulas(primary, secondary)
        elif content_type == "code_blocks":
            return self._merge_code_blocks(primary, secondary)
        return primary

    def _merge_tables(self, primary: str, secondary: str) -> str:
        """从 secondary 中提取表格，补充到 primary 末尾。"""
        # 提取 secondary 中的表格块
        table_pattern = re.compile(
            r"(\|[^\n]+\|\n\|[-| :]+\|\n(?:\|[^\n]+\|\n)*)", re.MULTILINE
        )
        secondary_tables = table_pattern.findall(secondary)
        primary_tables = table_pattern.findall(primary)

        # 仅补充 primary 中不存在的表格
        new_tables = []
        for table in secondary_tables:
            # 简单去重：检查表头行是否已存在
            header_line = table.split("\n")[0].strip()
            if not any(header_line in pt for pt in primary_tables):
                new_tables.append(table)

        if new_tables:
            supplement_section = "\n\n---\n\n<!-- 以下表格由补充引擎提取 -->\n\n"
            supplement_section += "\n\n".join(new_tables)
            return primary + supplement_section

        return primary

    def _merge_formulas(self, primary: str, secondary: str) -> str:
        """保守合并：如果 primary 的公式数量明显少于 secondary，附加提示。"""
        primary_formulas = len(re.findall(r"\$\$[\s\S]+?\$\$", primary))
        secondary_formulas = len(re.findall(r"\$\$[\s\S]+?\$\$", secondary))

        # 公式已在 primary 中，无需额外补充（公式位置敏感，不宜拼接）
        if secondary_formulas > primary_formulas * 2 and primary_formulas < 3:
            # 提取 secondary 中的块级公式
            block_formulas = re.findall(r"\$\$[\s\S]+?\$\$", secondary)
            if block_formulas:
                supplement = "\n\n---\n\n<!-- 以下公式由补充引擎提取 -->\n\n"
                supplement += "\n\n".join(block_formulas[:10])  # 最多补充 10 个
                return primary + supplement

        return primary

    def _merge_code_blocks(self, primary: str, secondary: str) -> str:
        """从 secondary 中提取代码块，补充到 primary 末尾。"""
        code_pattern = re.compile(r"```\w*\n[\s\S]+?\n```", re.MULTILINE)
        secondary_blocks = code_pattern.findall(secondary)
        primary_blocks = code_pattern.findall(primary)

        if len(secondary_blocks) > len(primary_blocks) * 1.5:
            # 补充 primary 中缺失的代码块
            new_blocks = []
            for block in secondary_blocks:
                # 简单去重：检查代码内容前 50 字符
                block_preview = block[:50]
                if not any(block_preview in pb for pb in primary_blocks):
                    new_blocks.append(block)

            if new_blocks:
                supplement = "\n\n---\n\n<!-- 以下代码块由补充引擎提取 -->\n\n"
                supplement += "\n\n".join(new_blocks[:20])  # 最多补充 20 个
                return primary + supplement

        return primary
