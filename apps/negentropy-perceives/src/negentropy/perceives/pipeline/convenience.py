"""Pipeline 高级便捷 API。

提供两个高级函数，供 MCP 工具层直接调用，
屏蔽 PipelineOrchestrator 的配置解析细节。
"""

from __future__ import annotations

import base64
import importlib
import logging
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..config import settings
from .base import StageResult
from .engine_selector import build_selector
from .models import (
    AssemblyInput,
    AssemblyOutput,
    CodeDetectionOutput,
    ExtractedImage,
    FormulaExtractionOutput,
    ImageAsset,
    ImageExtractionOutput,
    LayoutAnalysisOutput,
    PipelineResult,
    PreprocessingInput,
    PreprocessingOutput,
    StageContext,
    TableExtractionOutput,
    TextExtractionOutput,
)
from .orchestrator import PipelineOrchestrator

logger = logging.getLogger(__name__)


def _get_pdf_stages_config() -> list[dict[str, Any]]:
    """从全局配置中获取 PDF Pipeline 的 Stage 配置。"""
    pipeline_cfg = settings.pipeline
    if pipeline_cfg is None or pipeline_cfg.pdf is None:
        return []
    return [s.model_dump() for s in pipeline_cfg.pdf.stages]


def _get_webpage_stages_config() -> list[dict[str, Any]]:
    """从全局配置中获取 WebPage Pipeline 的 Stage 配置。"""
    pipeline_cfg = settings.pipeline
    if pipeline_cfg is None or pipeline_cfg.webpage is None:
        return []
    return [s.model_dump() for s in pipeline_cfg.webpage.stages]


def _get_defaults_config() -> dict[str, Any]:
    """获取 Pipeline 全局默认配置。"""
    pipeline_cfg = settings.pipeline
    if pipeline_cfg is None or pipeline_cfg.defaults is None:
        return {}
    return pipeline_cfg.defaults.model_dump()


def _get_engine_gates() -> dict[str, bool]:
    """根据引擎级 enabled 配置构建门控映射。

    覆盖 4 个可受配置门控的引擎（``opendataloader`` 在 PR #163 之后引入,
    此前遗漏会导致 ``settings.opendataloader_enabled=False`` 不生效:
    ``EngineSelector`` 重排时仍会把 ODL 列入候选）。

    ``pymupdf`` / ``pypdf`` 视为强制兜底引擎,不暴露 gate, 永远视为可用。
    """
    return {
        "docling": settings.docling_enabled,
        "mineru": settings.mineru_enabled,
        "marker": settings.marker_enabled,
        "opendataloader": settings.opendataloader_enabled,
    }


def _serialize_stage_result(result: StageResult) -> Dict[str, Any]:
    """把 ``StageResult`` 序列化为 ``PipelineResult.stage_results`` 字典项。

    透出 stage 级的可观测信号:
        - ``success`` / ``error`` / ``engine`` (原有字段)
        - ``elapsed_ms``: 由 ``PipelineOrchestrator._execute_stage`` 在 Stage
          完成时自动写入 (orchestrator.py 第 ~287 行)
        - ``selector_decision``: 由 orchestrator 透传 ``EngineSelector`` 的决策
          原因 (如 ``profile:no_tables`` / ``profile:scanned``)
        - ``selector_skipped``: True 表示该 Stage 被 selector 短路跳过

    供基准脚本 (``scripts/benchmark/parse_pdf_*``) 与 MCP 调用方观测 Pipeline
    端到端的时延分布与路由决策, 实现严格循证的性能调优。
    """
    metadata = getattr(result, "metadata", None) or {}
    return {
        "success": result.success,
        "engine": result.engine_used,
        "elapsed_ms": round(getattr(result, "elapsed_ms", 0.0) or 0.0, 2),
        "selector_decision": metadata.get("selector_decision"),
        "selector_skipped": bool(metadata.get("selector_skipped", False)),
        "error": result.error,
    }


# PDF Pipeline 中可以并行执行的 Stage 名称
_PDF_PARALLEL_STAGES = [
    "text_extraction",
    "table_extraction",
    "formula_extraction",
    "image_extraction",
    "code_detection",
]

# WebPage Pipeline 中可以并行执行的 Stage 名称
_WEBPAGE_PARALLEL_STAGES = [
    "math_formula_extraction",
    "code_block_detection",
    "table_extraction",
    "image_extraction",
]


# ---------------------------------------------------------------------------
# PDF Pipeline 复合输入构造器
# ---------------------------------------------------------------------------


def _build_assembly_input(
    results: Dict[str, StageResult], initial_input: Any
) -> AssemblyInput:
    """为 ``assembly`` Stage 汇聚各前序 Stage 结果。"""
    preprocessing = _unwrap(results.get("preprocessing"))
    if not isinstance(preprocessing, PreprocessingOutput):
        raise ValueError(
            "assembly 输入缺失或类型不符：preprocessing Stage 未产出 PreprocessingOutput"
        )
    return AssemblyInput(
        preprocessing=preprocessing,
        layout=_unwrap(results.get("layout_analysis")),
        text=_unwrap(results.get("text_extraction")),
        tables=_unwrap(results.get("table_extraction")),
        formulas=_unwrap(results.get("formula_extraction")),
        images=_unwrap(results.get("image_extraction")),
        code=_unwrap(results.get("code_detection")),
    )


def _build_asset_bundling_input(
    results: Dict[str, StageResult], initial_input: Any
) -> Any:
    """为 ``asset_bundling`` Stage 汇聚 assembly / image / preprocessing 结果。"""
    from .stages.pdf.asset_bundling import _AssetBundlingInput

    assembly_output = _unwrap(results.get("assembly"))
    if not isinstance(assembly_output, AssemblyOutput):
        raise ValueError(
            "asset_bundling 输入缺失或类型不符：assembly Stage 未产出 AssemblyOutput"
        )
    cfg = getattr(initial_input, "config", {}) or {}
    images = _unwrap(results.get("image_extraction"))
    preprocessing = _unwrap(results.get("preprocessing"))
    return _AssetBundlingInput(
        assembly_output=assembly_output,
        images=images if isinstance(images, ImageExtractionOutput) else None,
        preprocessing=preprocessing
        if isinstance(preprocessing, PreprocessingOutput)
        else None,
        output_dir=cfg.get("output_dir") if isinstance(cfg, dict) else None,
    )


def _build_image_extraction_input(
    results: Dict[str, StageResult], initial_input: Any
) -> Any:
    """为 ``image_extraction`` Stage 汇聚 preprocessing + layout_analysis 结果。

    layout_analysis 失败时 ``layout`` 设为 ``None``，
    FitzImageExtractor 将退化为纯 PyMuPDF 光栅图提取（兼容降级）。
    """
    from .models import ImageExtractionInput

    preprocessing = _unwrap(results.get("preprocessing"))
    if not isinstance(preprocessing, PreprocessingOutput):
        raise ValueError(
            "image_extraction 输入缺失或类型不符："
            "preprocessing Stage 未产出 PreprocessingOutput"
        )
    layout = _unwrap(results.get("layout_analysis"))
    return ImageExtractionInput(
        preprocessing=preprocessing,
        layout=layout if isinstance(layout, LayoutAnalysisOutput) else None,
    )


_PDF_INPUT_BUILDERS = {
    "assembly": _build_assembly_input,
    "asset_bundling": _build_asset_bundling_input,
    "image_extraction": _build_image_extraction_input,
}


# ---------------------------------------------------------------------------
# PDF 引擎可用性启动汇总
# ---------------------------------------------------------------------------

_pdf_engines_summary_logged = False


def _probe_module(names: tuple[str, ...]) -> Optional[str]:
    """按顺序尝试导入模块，返回首个成功的模块名；全部失败返回 ``None``。"""
    for name in names:
        try:
            importlib.import_module(name)
            return name
        except ImportError:
            continue
    return None


def _log_pdf_engines_summary_once() -> None:
    """首次调用 ``run_pdf_pipeline`` 时，INFO 级打印四大 PDF 引擎可用性摘要。

    通过模块级标志位保证进程内仅打印一次，避免污染日志。
    """
    global _pdf_engines_summary_logged
    if _pdf_engines_summary_logged:
        return
    _pdf_engines_summary_logged = True

    probes: Dict[str, tuple[str, ...]] = {
        "docling": ("docling",),
        "mineru": ("mineru",),
        "marker": ("marker_pdf", "marker"),
        "pymupdf": ("fitz",),
    }
    statuses: list[str] = []
    missing: list[str] = []
    for engine, candidates in probes.items():
        hit = _probe_module(candidates)
        if hit:
            statuses.append(f"{engine}=ok({hit})")
        else:
            statuses.append(f"{engine}=missing")
            missing.append(engine)

    logger.info("[PDF engines] %s", ", ".join(statuses))
    if missing:
        logger.info(
            "[PDF engines] 部分引擎未安装：%s。"
            "安装可选依赖以获得完整能力：uv sync --extra all-engines",
            ", ".join(missing),
        )
    logger.info(
        "[PDF engines] 首次使用前建议预热模型（避免首请求 ~1.35GB 下载超时）："
        "uv run perceives prefetch-models"
    )


# ---------------------------------------------------------------------------
# 图片资产落盘（MCP 响应透出 image_path 指针）
# ---------------------------------------------------------------------------


def _read_image_bytes(img: ExtractedImage) -> Optional[bytes]:
    """从 ExtractedImage 中还原原始字节。

    优先级：
    1. ``base64_data`` 已由上游填充 → 直接 base64 解码；
    2. ``local_path`` 指向磁盘文件 → 读入字节；
    3. 上述均无 → 返回 ``None``，调用方丢弃该图。

    对各分支的错误统一吞下并记录 WARN，避免单张图异常中断整个打包流程。
    """
    if img.base64_data:
        try:
            return base64.b64decode(img.base64_data)
        except (ValueError, TypeError) as e:
            logger.warning("图片 %s base64 解码失败: %s", img.filename, e)
            return None
    if img.local_path:
        try:
            p = Path(img.local_path)
            if p.exists():
                return p.read_bytes()
        except OSError as e:
            logger.warning("读取图片 %s 失败: %s", img.local_path, e)
    return None


def _resolve_images_dir(
    output_dir: Optional[str],
    pdf_stem: Optional[str],
) -> Path:
    """解析图片导出目录。

    优先级：
    1. 用户显式指定的 ``output_dir`` → ``<output_dir>/images/``；
    2. 否则回退到 ``<cwd>/output/<pdf_stem>/images/``，与 S9 ``BuiltinBundler``
       的目录约定保持一致（单一事实源）。
    """
    if output_dir:
        base_dir = Path(output_dir)
    else:
        base_dir = Path.cwd() / "output" / (pdf_stem or "document")
    return base_dir / "images"


def _build_image_assets(
    image_output: Optional[ImageExtractionOutput],
    *,
    output_dir: Optional[str] = None,
    pdf_stem: Optional[str] = None,
) -> List[ImageAsset]:
    """把图片原字节落盘，构造供 MCP 响应透出的 ``ImageAsset`` 指针列表。

    传输策略：图片原字节写入 ``<output_dir>/images/<filename>``；响应中只
    携带 ``filename`` 与 ``image_path``。MCP Resource URI 由 tool 层在拿到
    本函数返回值后动态注册，回填 ``resource_uri`` 字段。

    若同一文件已落盘（``ExtractedImage.local_path`` 与目标路径一致或源已存在），
    优先 ``shutil.copy2`` 复制以避免无谓的解码—编码—写盘往返。

    失败策略：单图 IO 异常仅跳过本图，不影响整体流水线成功。
    """
    if image_output is None or not image_output.images:
        return []

    images_dir = _resolve_images_dir(output_dir, pdf_stem)
    try:
        images_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        logger.warning("无法创建图片导出目录 %s: %s", images_dir, e)
        return []

    assets: List[ImageAsset] = []
    for img in image_output.images:
        dest = images_dir / img.filename
        try:
            written = False
            if img.local_path:
                src = Path(img.local_path)
                if src.exists():
                    if src.resolve() != dest.resolve():
                        shutil.copy2(src, dest)
                    written = True
            if not written:
                raw = _read_image_bytes(img)
                if raw is None:
                    continue
                dest.write_bytes(raw)
        except OSError as e:
            logger.warning("图片 %s 落盘失败，跳过: %s", img.filename, e)
            continue

        assets.append(
            ImageAsset(
                filename=img.filename,
                mime_type=img.mime_type or "image/png",
                image_path=str(dest.resolve()),
                resource_uri=None,
                width=img.width,
                height=img.height,
                caption=img.caption,
                page_number=img.page_number,
            )
        )

    if assets:
        logger.info("图片资产落盘：收录=%d 目录=%s", len(assets), images_dir)
    return assets


def _cleanup_image_temp_dir(image_output: Any) -> None:
    """清理图片提取阶段创建的临时目录。

    在 ``_build_image_assets`` 完成文件拷贝后调用，删除矢量渲染产生的临时目录。
    """
    if isinstance(image_output, ImageExtractionOutput):
        temp_dir = image_output.metadata.get("_temp_output_dir")
        if temp_dir:
            # ignore_errors=True 已吞下 OSError，无需额外 try/except 兜底
            shutil.rmtree(temp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# 引擎预热（消除 worker 冷启动时间窗）
# ---------------------------------------------------------------------------


def _kickoff_engine_warmup() -> None:
    """异步触发 docling/mineru/marker worker 预热。

    与 :func:`run_pdf_pipeline` 主流程**完全解耦**：
    - 不阻塞 caller，不抛异常；任何失败仅记录 DEBUG/WARN；
    - 仅在引擎被 ``settings.{docling|mineru|marker}_enabled`` 启用时预热；
    - 进程隔离非 ``process`` 时直接跳过。

    时间窗：preprocessing(~62ms) + quick_scan(~86ms) ≈ 150ms，足以让 spawn
    + torch import + MPS first-touch 在主流水线前完成（实测 docling worker
    冷启动 ~10s 在 layout_analysis 关键路径外完成，即可减少首 stage 等待）。
    """
    if not getattr(settings, "pdf_engine_warmup_enabled", True):
        return

    try:
        import asyncio as _asyncio

        from ..infra.engine_worker import get_engine_pool
    except Exception as e:  # noqa: BLE001
        logger.debug("引擎预热模块导入失败，跳过: %s", e)
        return

    try:
        pool = get_engine_pool()
    except Exception as e:  # noqa: BLE001
        logger.debug("EngineWorkerPool 不可用，跳过预热: %s", e)
        return

    if getattr(pool, "isolation", "process") != "process":
        return

    engines: List[str] = []
    if getattr(settings, "docling_enabled", True):
        engines.append("docling")
    if getattr(settings, "mineru_enabled", True):
        engines.append("mineru")
    if getattr(settings, "marker_enabled", True):
        engines.append("marker")

    if not engines:
        return

    try:
        loop = _asyncio.get_running_loop()
    except RuntimeError:
        # 同步调用上下文（如测试），无事件循环时静默跳过
        return

    for engine in engines:
        loop.create_task(pool.warmup(engine))
    logger.info("引擎预热已触发 engines=%s", engines)


async def run_pdf_pipeline(
    source: str,
    page_range: Optional[tuple[int, int]] = None,
    extract_images: bool = True,
    extract_tables: bool = True,
    extract_formulas: bool = True,
    embed_images: bool = False,
    output_dir: Optional[str] = None,
) -> PipelineResult:
    """执行 PDF -> Markdown 完整管线。

    Args:
        source: PDF 文件路径或 URL
        page_range: 可选页码范围
        extract_images: 是否提取图片
        extract_tables: 是否提取表格
        extract_formulas: 是否提取公式
        embed_images: 是否嵌入图片
        output_dir: 输出目录

    Returns:
        PipelineResult 包含 Markdown 内容和统计数据
    """
    stages_config = _get_pdf_stages_config()
    if not stages_config:
        return PipelineResult(
            success=False,
            error="Pipeline 配置未找到（pipeline.pdf.stages 为空）",
        )

    # 确保导入 PDF Stage 工具以触发注册
    from .stages import pdf as _  # noqa: F401

    # 首次调用时打印四大 PDF 引擎可用性摘要
    _log_pdf_engines_summary_once()

    stage_names = [s.get("name", "?") for s in stages_config]
    logger.info(
        "PDF Pipeline 启动 stages=%s parallel=%s",
        stage_names,
        _PDF_PARALLEL_STAGES,
    )

    orchestrator = PipelineOrchestrator(
        stages_config=stages_config,
        defaults_config=_get_defaults_config(),
        engine_gates=_get_engine_gates(),
        pipeline_name="pdf",
        input_builders=_PDF_INPUT_BUILDERS,
        selector=build_selector(),
    )

    # 引擎预热：将 docling/mineru/marker 的 spawn + torch import + MPS first-touch
    # 开销并行移出 layout_analysis 关键路径，恰好叠加 preprocessing/quick_scan
    # 的 < 200ms 时间窗。配置 `pdf.engine_warmup_enabled: false` 可关闭。
    _kickoff_engine_warmup()

    input_data = PreprocessingInput(
        source=source,
        page_range=page_range,
        config={
            "extract_images": extract_images,
            "extract_tables": extract_tables,
            "extract_formulas": extract_formulas,
            "embed_images": embed_images,
            "output_dir": output_dir,
        },
    )

    stage_results = await orchestrator.run(
        initial_input=input_data,
        parallel_stages=_PDF_PARALLEL_STAGES,
    )

    # 结果摘要日志
    summary = {
        k: {"ok": v.success, "engine": getattr(v, "engine_used", None)}
        for k, v in stage_results.items()
    }
    logger.info("PDF Pipeline 阶段结果: %s", summary)

    # 检查关键 Stage 是否成功
    preprocessing_result = stage_results.get("preprocessing")
    if not preprocessing_result or not preprocessing_result.success:
        return PipelineResult(
            success=False,
            error=preprocessing_result.error
            if preprocessing_result
            else "预处理 Stage 未执行",
        )

    # 从各 Stage 结果中构建 PipelineResult
    preprocessing_output = preprocessing_result.output

    # 收集各 Stage 输出
    _unwrap(stage_results.get("layout_analysis"))  # layout 已在 assembly 中消费
    text_output = _unwrap(stage_results.get("text_extraction"))
    table_output = _unwrap(stage_results.get("table_extraction"))
    formula_output = _unwrap(stage_results.get("formula_extraction"))
    image_output = _unwrap(stage_results.get("image_extraction"))
    code_output = _unwrap(stage_results.get("code_detection"))
    assembly_output = _unwrap(stage_results.get("assembly"))

    # PDF /Title 在预处理 Stage 已抽取（PreprocessingOutput.metadata["title"]）但历史在此被丢弃；
    # 透传进 PipelineResult.metadata，供下游（文档标题回填 / 巡检命名）复用（Fix B1）。
    _pdf_title = ""
    if isinstance(preprocessing_output, PreprocessingOutput):
        _raw_title = preprocessing_output.metadata.get("title")
        _pdf_title = str(_raw_title).strip() if _raw_title else ""

    # 如果有 assembly 输出，直接使用
    if assembly_output and isinstance(assembly_output, AssemblyOutput):
        image_output_typed = (
            image_output if isinstance(image_output, ImageExtractionOutput) else None
        )
        image_assets = _build_image_assets(
            image_output_typed,
            output_dir=output_dir,
            pdf_stem=(
                preprocessing_output.local_path.stem
                if isinstance(preprocessing_output, PreprocessingOutput)
                else None
            ),
        )
        # 图片资产已拷贝到最终输出目录，可安全清理 image_extraction 临时目录
        _cleanup_image_temp_dir(image_output_typed)
        return PipelineResult(
            success=True,
            markdown=assembly_output.markdown,
            word_count=assembly_output.word_count,
            characteristics=(
                preprocessing_output.characteristics
                if isinstance(preprocessing_output, PreprocessingOutput)
                else None
            ),
            tables_count=len(table_output.tables)
            if isinstance(table_output, TableExtractionOutput)
            else 0,
            formulas_count=(
                len(formula_output.formulas)
                if isinstance(formula_output, FormulaExtractionOutput)
                else 0
            ),
            images_count=len(image_output_typed.images) if image_output_typed else 0,
            code_blocks_count=len(code_output.code_blocks)
            if isinstance(code_output, CodeDetectionOutput)
            else 0,
            engines_used=[
                r.engine_used
                for r in stage_results.values()
                if hasattr(r, "engine_used") and r.engine_used
            ],
            stage_results={
                k: _serialize_stage_result(v) for k, v in stage_results.items()
            },
            metadata={
                **assembly_output.metadata,
                **({"title": _pdf_title} if _pdf_title else {}),
            },
            image_assets=image_assets,
        )

    # 未走 assembly 输出路径：图片资产虽未透出，仍需清理临时目录
    _cleanup_image_temp_dir(image_output)

    # 降级：如果没有 assembly 输出，尝试从 text_output 构建
    if isinstance(text_output, TextExtractionOutput):
        return PipelineResult(
            success=True,
            markdown=text_output.full_text,
            word_count=text_output.word_count,
            metadata={"title": _pdf_title} if _pdf_title else {},
            characteristics=(
                preprocessing_output.characteristics
                if isinstance(preprocessing_output, PreprocessingOutput)
                else None
            ),
            engines_used=[
                r.engine_used
                for r in stage_results.values()
                if hasattr(r, "engine_used") and r.engine_used
            ],
            stage_results={
                k: _serialize_stage_result(v) for k, v in stage_results.items()
            },
        )

    return PipelineResult(
        success=False,
        error="Pipeline 未能生成有效输出",
        stage_results={k: _serialize_stage_result(v) for k, v in stage_results.items()},
    )


async def run_webpage_pipeline(
    url: str,
    method: str = "auto",
    extract_main_content: bool = True,
    include_metadata: bool = True,
    embed_images: bool = False,
    custom_options: Optional[Dict[str, Any]] = None,
    formatting_options: Optional[Dict[str, bool]] = None,
) -> Dict[str, Any]:
    """执行 WebPage -> Markdown 完整管线。

    Args:
        url: 目标网页 URL
        method: 抓取方法
        extract_main_content: 是否提取主内容
        include_metadata: 是否包含元数据
        embed_images: 是否嵌入图片
        custom_options: 自定义转换选项
        formatting_options: 格式化选项

    Returns:
        字典包含 markdown, metadata, word_count 等字段
    """
    stages_config = _get_webpage_stages_config()
    if not stages_config:
        return {
            "success": False,
            "error": "Pipeline 配置未找到（pipeline.webpage.stages 为空）",
        }

    # 确保导入 WebPage Stage 工具以触发注册
    from .stages import webpage as _  # noqa: F401

    orchestrator = PipelineOrchestrator(
        stages_config=stages_config,
        defaults_config=_get_defaults_config(),
        pipeline_name="webpage",
        selector=build_selector(),
    )

    # 创建初始上下文
    ctx = StageContext(
        url=url,
        config={
            "method": method,
            "extract_main_content": extract_main_content,
            "include_metadata": include_metadata,
            "embed_images": embed_images,
            "custom_options": custom_options or {},
            "formatting_options": formatting_options or {},
        },
    )

    stage_results = await orchestrator.run(
        initial_input=ctx,
        parallel_stages=_WEBPAGE_PARALLEL_STAGES,
    )

    # 检查结果
    failed_stages = {k: v for k, v in stage_results.items() if not v.success}
    if failed_stages:
        logger.warning(
            "WebPage Pipeline 中 %d 个 Stage 失败: %s",
            len(failed_stages),
            list(failed_stages.keys()),
        )

    # 从最终上下文构建结果
    final_ctx = ctx  # StageContext 是可变对象，被各 Stage 直接修改
    return {
        "success": bool(final_ctx.markdown),
        "markdown_content": final_ctx.markdown,
        "metadata": final_ctx.metadata,
        "word_count": len(final_ctx.markdown.split()) if final_ctx.markdown else 0,
        "url": url,
        "title": final_ctx.title,
        "errors": final_ctx.errors,
        "stage_results": {
            k: {"success": v.success, "engine": v.engine_used}
            for k, v in stage_results.items()
        },
    }


def _unwrap(stage_result: Any) -> Any:
    """从 StageResult 中提取 output 字段。"""
    if stage_result is None:
        return None
    if hasattr(stage_result, "output"):
        return stage_result.output
    return None
