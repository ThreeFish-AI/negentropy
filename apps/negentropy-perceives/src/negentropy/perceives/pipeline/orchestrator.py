"""Pipeline 编排器：串联多个 Stage 执行完整管线。

根据 ``config.default.yaml`` 中的 pipeline 配置，串联执行多个 Stage，
支持并行组和竞争模式。
"""

from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Mapping, Optional, Tuple

from ..core.task_context import method_var, stage_var, timing_var
from .base import StageResult
from .engine_selector import EngineSelector, IdentitySelector, SelectionContext
from .scheduler import StageScheduler

logger = logging.getLogger(__name__)


InputBuilder = Callable[[Dict[str, StageResult], Any], Any]


# Stage name → 空 output 工厂（selector 决定 skip 时返回的占位输出）
# 仅覆盖会被 ProfileAwareSelector 短路的 4 个特征驱动型 Stage。
def _empty_output_for_stage(stage_name: str) -> Any:
    """返回 stage 短路时的空输出占位，供下游 Stage 安全消费。"""
    from .models import (
        CodeDetectionOutput,
        FormulaExtractionOutput,
        ImageExtractionOutput,
        TableExtractionOutput,
    )

    if stage_name == "table_extraction":
        return TableExtractionOutput(
            tables=[], total_count=0, metadata={"skipped": True}
        )
    if stage_name == "formula_extraction":
        return FormulaExtractionOutput(
            formulas=[], inline_count=0, block_count=0, metadata={"skipped": True}
        )
    if stage_name == "image_extraction":
        return ImageExtractionOutput(
            images=[], total_count=0, metadata={"skipped": True}
        )
    if stage_name == "code_detection":
        return CodeDetectionOutput(
            code_blocks=[], total_count=0, metadata={"skipped": True}
        )
    return None


class PipelineOrchestrator:
    """Pipeline 编排器。

    根据 ``config.default.yaml`` 中的 pipeline 配置，
    串联执行多个 Stage，支持并行组和竞争模式。

    输入路由（YAML 声明式）：
        - Stage 配置中的 ``input_builder`` 优先，在 ``input_builders`` 中查注册的构造器；
        - 否则 ``input_from`` 取指定前序 Stage 的 ``StageResult.output``；
        - 否则沿用链式语义（上一 Stage 输出即下一 Stage 输入）。
    """

    def __init__(
        self,
        stages_config: List[Dict[str, Any]],
        defaults_config: Optional[Dict[str, Any]] = None,
        engine_gates: Optional[Dict[str, bool]] = None,
        pipeline_name: str = "",
        input_builders: Optional[Mapping[str, InputBuilder]] = None,
        selector: Optional[EngineSelector] = None,
    ):
        """
        Args:
            stages_config: Stage 配置列表
                （来自 ``pipeline.pdf.stages`` 或 ``pipeline.webpage.stages``）
            defaults_config: 全局默认竞争配置（来自 ``pipeline.defaults``）
            engine_gates: 引擎级门控（如 ``{"docling": True, "mineru": False}``）
            pipeline_name: Pipeline 名称，用于工具限定名查找隔离
            input_builders: 复合输入构造器字典（``{key: builder}``），
                ``builder(stage_results, initial_input) -> Any``。
            selector: 路由策略（``EngineSelector`` 协议实例）。默认 ``IdentitySelector``
                （保持 YAML 顺序）。``ProfileAwareSelector`` 启用基于
                ``DocumentCharacteristics`` 的动态重排与 stage 短路。
        """
        self._stages_config = stages_config
        self._defaults = defaults_config or {}
        self._engine_gates = engine_gates or {}
        self._pipeline_name = pipeline_name
        self._input_builders: Mapping[str, InputBuilder] = input_builders or {}
        self._scheduler = StageScheduler()
        self._judge = self._init_judge()
        self._selector: EngineSelector = selector or IdentitySelector()

    @staticmethod
    def _init_judge():
        """初始化 LLM 评审器（延迟加载，LLM 不可用时返回 None）。"""
        try:
            from .llm_judge import LLMCompetitionJudge
            from ..config import settings

            judge_config = None
            try:
                from ..core.pipeline_config import CompetitionJudgeConfig

                judge_config = CompetitionJudgeConfig()
            except Exception as e:
                logger.debug("CompetitionJudgeConfig 未配置，使用默认值: %s", e)

            judge = LLMCompetitionJudge(
                config=judge_config,
                api_key=settings.llm_api_key,
                api_base_url=settings.llm_api_base_url,
            )
            if judge.is_available():
                logger.info(
                    "LLM 评审器已激活 model=%s api_base=%s",
                    settings.llm_model,
                    settings.llm_api_base_url or "(default)",
                )
                return judge
        except Exception as e:
            logger.debug("LLM 评审器未激活: %s", e)
        return None

    async def run(
        self,
        initial_input: Any,
        parallel_stages: Optional[List[str]] = None,
    ) -> Dict[str, StageResult]:
        """执行完整管线。

        Args:
            initial_input: 初始输入数据
            parallel_stages: 可并行执行的 Stage 名称列表。
                这些 Stage 将通过 ``asyncio.gather`` 并行执行。

        Returns:
            ``{stage_name: StageResult}`` 字典
        """
        parallel_set = set(parallel_stages or [])
        results: Dict[str, StageResult] = {}
        current_input = initial_input
        pipeline_start = time.monotonic()

        # 分组：连续的并行 Stage 合并为一组
        groups = self._group_stages(self._stages_config, parallel_set)

        for group in groups:
            if group["type"] == "sequential":
                for stage_cfg in group["stages"]:
                    name = stage_cfg["name"]
                    resolved, err = self._resolve_input(
                        stage_cfg, results, initial_input, current_input
                    )
                    if err is not None:
                        logger.error("Stage '%s' 输入解析失败，管线终止: %s", name, err)
                        results[name] = StageResult(success=False, error=err)
                        return results
                    result = await self._execute_stage(stage_cfg, resolved, results)
                    results[name] = result
                    if not result.success:
                        logger.error(
                            "Stage '%s' 失败，管线终止: %s",
                            name,
                            result.error,
                        )
                        return results
                    # 更新 current_input（保留链式语义，供未声明 input_from 的后续 Stage 使用）
                    if result.output is not None:
                        current_input = result.output
            elif group["type"] == "parallel":
                resolved_pairs: List[Tuple[Dict[str, Any], Any]] = []
                parallel_results: Dict[str, StageResult] = {}
                for cfg in group["stages"]:
                    name = cfg["name"]
                    resolved, err = self._resolve_input(
                        cfg, results, initial_input, current_input
                    )
                    if err is not None:
                        logger.error("Stage '%s' 输入解析失败: %s", name, err)
                        parallel_results[name] = StageResult(success=False, error=err)
                    else:
                        resolved_pairs.append((cfg, resolved))

                if resolved_pairs:
                    exec_results = await self._execute_parallel(resolved_pairs, results)
                    parallel_results.update(exec_results)

                results.update(parallel_results)
                # 检查是否有失败
                failed = {k: v for k, v in parallel_results.items() if not v.success}
                if failed:
                    logger.warning(
                        "并行组中 %d 个 Stage 失败: %s",
                        len(failed),
                        list(failed.keys()),
                    )

        elapsed = (time.monotonic() - pipeline_start) * 1000
        logger.info("管线完成，总耗时: %.1fms", elapsed)
        return results

    async def _execute_stage(
        self,
        stage_config: Dict[str, Any],
        input_data: Any,
        results_so_far: Optional[Dict[str, StageResult]] = None,
    ) -> StageResult:
        """执行单个 Stage。

        为当前 Stage 绑定 `stage_var` 与 `method_var`（ContextVar），使日志前缀
        自动携带 `stage=` / `method=` 字段，并在 TaskTiming 中追加一条 Stage 记录。
        `asyncio.gather` 为并行 Stage 自动复制 Context，故并发任务间互不干扰。

        Args:
            stage_config: Stage 配置项（含 name / tools / competition_mode 等）
            input_data: 已由 ``_resolve_input`` 解析后的输入。
            results_so_far: 截至当前的所有前序 Stage 结果，用于
                ``EngineSelector`` 读取 ``quick_scan`` 的 DocumentCharacteristics。
        """
        name = stage_config["name"]
        tool_configs = self._apply_engine_gates(stage_config.get("tools", []))
        competition_mode = stage_config.get("competition_mode", False)
        competition_config = stage_config.get(
            "competition",
            self._defaults.get("competition", {}),
        )

        # 防御性检查：若输入数据引用的本地文件已不存在（会话终止等原因清理了
        # 临时文件），直接失败而非让各引擎逐个报 "file not found"。
        local_path = getattr(input_data, "local_path", None)
        if local_path is not None and not Path(str(local_path)).exists():
            logger.warning("Stage '%s' 跳过：源文件已不存在 (%s)", name, local_path)
            return StageResult(
                success=False,
                error=f"源文件已不存在: {local_path}",
            )

        # === Adaptive Engine Selection: 路由策略决策 ===
        # 兼容：测试或外部代码可能通过 ``__new__`` + 手动赋字段绕过 __init__,
        # 未填充 ``_selector``；此处兜底为 IdentitySelector，保持与 PR2 前等价行为。
        selector = getattr(self, "_selector", None) or IdentitySelector()
        selection_ctx = self._build_selection_context(results_so_far)
        decision = selector.select(name, tool_configs, selection_ctx)
        if decision.skip:
            empty = _empty_output_for_stage(name)
            logger.info(
                "Stage '%s' 由 selector 短路跳过 (reason=%s)", name, decision.reason
            )
            return StageResult(
                success=True,
                output=empty,
                engine_used=f"skipped:{decision.reason}",
                elapsed_ms=0.0,
                metadata={
                    "selector_decision": decision.reason,
                    "selector_skipped": True,
                },
            )
        tool_configs = decision.tools

        stage_tok = stage_var.set(name)
        method_tok = method_var.set(None)
        start = time.monotonic()
        tool_names = [tc.get("name", "") for tc in tool_configs]
        logger.info(
            "Stage 开始 tools=%s competition=%s selector=%s",
            tool_names,
            competition_mode,
            decision.reason,
        )
        try:
            result = await self._scheduler.run_stage(
                stage_name=name,
                tool_configs=tool_configs,
                input_data=input_data,
                competition_mode=competition_mode,
                competition_config=competition_config,
                pipeline_name=self._pipeline_name,
                judge=self._judge,
            )
            result.elapsed_ms = (time.monotonic() - start) * 1000
            if result.engine_used:
                method_var.set(result.engine_used)
            # 把 selector 决策附加到 metadata 便于审计
            if not hasattr(result, "metadata") or result.metadata is None:
                result.metadata = {}
            result.metadata.setdefault("selector_decision", decision.reason)
            logger.info(
                "Stage 完成 success=%s elapsed=%.1fms",
                result.success,
                result.elapsed_ms,
            )
            timing = timing_var.get()
            if timing is not None:
                timing.stage_records.append(
                    (
                        name,
                        result.engine_used or "-",
                        result.elapsed_ms,
                        result.success,
                    )
                )
            return result
        finally:
            method_var.reset(method_tok)
            stage_var.reset(stage_tok)

    async def _execute_parallel(
        self,
        stage_pairs: List[Tuple[Dict[str, Any], Any]],
        results_so_far: Optional[Dict[str, StageResult]] = None,
    ) -> Dict[str, StageResult]:
        """并行执行一组已解析好输入的 Stage。

        Args:
            stage_pairs: ``[(stage_config, resolved_input), ...]``，
                由 ``run()`` 按各 Stage 的 ``input_from`` / ``input_builder``
                预先解析得到，避免多 Stage 共用同一 ``current_input`` 产生污染。
            results_so_far: 截至并行组之前的所有前序 Stage 结果，用于
                EngineSelector 读取 quick_scan 的 DocumentCharacteristics。
        """
        names = [cfg["name"] for cfg, _ in stage_pairs]
        logger.info("并行执行 Stage 组: %s", names)

        tasks = [
            self._execute_stage(cfg, data, results_so_far) for cfg, data in stage_pairs
        ]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        results: Dict[str, StageResult] = {}
        for i, raw in enumerate(raw_results):
            name = names[i]
            if isinstance(raw, StageResult):
                results[name] = raw
            elif isinstance(raw, Exception):
                results[name] = StageResult(
                    success=False,
                    error=f"Stage '{name}' 并行执行异常: {raw}",
                )
        return results

    def _build_selection_context(
        self,
        results_so_far: Optional[Dict[str, StageResult]],
    ) -> SelectionContext:
        """从前序 Stage 结果构造 ``SelectionContext``。

        优先从 ``quick_scan`` Stage 提取 DocumentCharacteristics；其次回退到
        ``preprocessing`` Stage 输出中的 characteristics（``PreprocessingOutput``
        包含此字段）。两者都缺失时 selector 会保守回退到 IdentitySelector 行为。
        """
        from .models import DocumentCharacteristics, PreprocessingOutput

        chars: Optional[DocumentCharacteristics] = None

        if results_so_far is not None:
            quick = results_so_far.get("quick_scan")
            if quick is not None and quick.success and quick.output is not None:
                if isinstance(quick.output, DocumentCharacteristics):
                    chars = quick.output

            if chars is None:
                pre = results_so_far.get("preprocessing")
                if pre is not None and pre.success and pre.output is not None:
                    pre_out = pre.output
                    if isinstance(pre_out, PreprocessingOutput):
                        chars = pre_out.characteristics

        # 激活 device 信号 (PR #164): 让 ProfileAwareSelector 的
        # _select_formula_extraction / _select_code_detection 等子规则可消费
        # 当前运行设备 (mps / cuda / cpu / xpu)。失败时回退 None, selector 视为
        # 设备未知, 走 YAML 默认。
        #
        # 选用 ``get_device_for_docling(settings.accelerator_device)`` 而非裸
        # ``detect_device()``: 前者会先尊重 ``settings.accelerator_device`` (背后
        # 接 ``NEGENTROPY_PERCEIVES_ACCELERATOR_DEVICE`` 环境变量)、``force_cpu``
        # 开关等用户层覆盖, 再回落到硬件探测。这样基准矩阵脚本通过环境变量切换
        # device 时, selector 这边能真正感知到, 不再只是 MinerU 引擎内部 device
        # 切换而 selector 侧分支恒等于物理硬件。返回的是纯小写字符串
        # ("mps"/"cpu"/"cuda"/"xpu"), 与 ``SelectionContext.device`` 的字符串协议
        # 一致, 避免 enum/str 类型混用带来的下游隐患。
        device: Optional[str] = None
        try:
            from ..config import settings as _settings
            from ..pdf.hardware.detection import get_device_for_docling

            device = get_device_for_docling(
                getattr(_settings, "accelerator_device", None)
            )
        except Exception:  # noqa: BLE001
            device = None

        return SelectionContext(characteristics=chars, device=device)

    def _resolve_input(
        self,
        stage_cfg: Dict[str, Any],
        results: Dict[str, StageResult],
        initial_input: Any,
        chain_input: Any,
    ) -> Tuple[Any, Optional[str]]:
        """解析 Stage 的输入来源。

        优先级：
            1. ``input_builder``：查注册的复合输入构造器（用于 ``AssemblyInput``
               等需要汇聚多个前序 Stage 结果的场景）。
            2. ``input_from``：取指定前序 Stage 的 ``StageResult.output``。
            3. 否则使用 ``chain_input``（链式语义，向后兼容）。

        Returns:
            ``(resolved_input, error_message)``。错误信息非空时，
            调用方应生成 ``StageResult(success=False, error=...)`` 而非抛异常，
            以便并行组内其它 Stage 继续执行。
        """
        builder_key = stage_cfg.get("input_builder")
        if builder_key:
            builder = self._input_builders.get(builder_key)
            if builder is None:
                return None, (
                    f"未注册的 input_builder: '{builder_key}'（"
                    f"可用: {sorted(self._input_builders.keys())}）"
                )
            try:
                return builder(results, initial_input), None
            except Exception as exc:  # noqa: BLE001 — 转为结构化错误上报
                return None, f"input_builder '{builder_key}' 执行异常: {exc}"

        from_name = stage_cfg.get("input_from")
        if from_name:
            prev = results.get(from_name)
            if prev is None:
                return None, (f"input_from 引用的 Stage '{from_name}' 不存在或尚未执行")
            if not prev.success:
                return None, (
                    f"input_from 依赖的 Stage '{from_name}' 已失败: {prev.error}"
                )
            if prev.output is None:
                return None, (f"input_from 依赖的 Stage '{from_name}' 未产出 output")
            return prev.output, None

        return chain_input, None

    def _apply_engine_gates(
        self,
        tool_configs: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """应用引擎级门控过滤。

        如果 ``engine_gates`` 中某引擎为 ``False``，则从工具列表中移除。
        """
        if not self._engine_gates:
            return tool_configs
        return [
            tc
            for tc in tool_configs
            if self._engine_gates.get(tc.get("name", ""), True)
        ]

    @staticmethod
    def _group_stages(
        stages: List[Dict[str, Any]],
        parallel_set: set,
    ) -> List[Dict[str, Any]]:
        """将 Stage 列表分组为顺序组和并行组。

        连续的并行 Stage 合并为一个并行组。
        """
        groups: List[Dict[str, Any]] = []
        current_parallel: List[Dict[str, Any]] = []

        for stage in stages:
            name = stage.get("name", "")
            if name in parallel_set:
                current_parallel.append(stage)
            else:
                # 先刷出累积的并行组
                if current_parallel:
                    groups.append({"type": "parallel", "stages": current_parallel})
                    current_parallel = []
                # 添加顺序 Stage
                if groups and groups[-1]["type"] == "sequential":
                    groups[-1]["stages"].append(stage)
                else:
                    groups.append({"type": "sequential", "stages": [stage]})

        # 刷出尾部并行组
        if current_parallel:
            groups.append({"type": "parallel", "stages": current_parallel})

        return groups
