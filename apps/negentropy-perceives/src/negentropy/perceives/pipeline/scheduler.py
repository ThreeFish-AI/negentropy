"""Stage 调度器：负责按配置选择和执行工具。

根据 Stage 配置决定执行模式：

- **降级模式** (``competition_mode=false``)：按 rank 顺序，首个可用即用
- **竞争模式** (``competition_mode=true``)：并行执行多个工具，择优
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, TypeVar

from .base import Stage, StageResult, StageTool
from .registry import get_tool

logger = logging.getLogger(__name__)


def _stage_timeout_multiplier() -> float:
    """读取 PDF Stage 超时倍率；配置缺失或非法时回 1.0。"""
    try:
        from ..config import settings as _settings

        mult = float(getattr(_settings, "pdf_stage_timeout_multiplier", 1.0))
        if mult <= 0 or mult > 10:
            return 1.0
        return mult
    except Exception:  # noqa: BLE001 - 配置异常不阻塞调度
        return 1.0


TInput = TypeVar("TInput")
TOutput = TypeVar("TOutput")


class StageScheduler:
    """Stage 调度器。

    根据 Stage 配置决定：

    - 降级模式（``competition_mode=false``）：按 rank 顺序，首个可用即用
    - 竞争模式（``competition_mode=true``）：并行执行多个工具，择优
    """

    async def run_stage(
        self,
        stage_name: str,
        tool_configs: List[Dict[str, Any]],
        input_data: Any,
        competition_mode: bool = False,
        competition_config: Optional[Dict[str, Any]] = None,
        selector: Optional[Callable] = None,
        pipeline_name: str = "",
        judge: Optional[Any] = None,
    ) -> StageResult:
        """执行单个 Stage。

        Args:
            stage_name: Stage 标识名
            tool_configs: 工具配置列表（已按 rank 排序）
            input_data: Stage 输入数据
            competition_mode: 是否启用竞争模式
            competition_config: 竞争模式配置（max_concurrent, timeout 等）
            selector: 自定义结果选择器
            pipeline_name: Pipeline 名称，用于限定名查找
            judge: LLM 评审器实例（LLMCompetitionJudge）

        Returns:
            Stage 执行结果
        """
        # 解析可用工具
        tools = self._resolve_tools(
            tool_configs, stage_name=stage_name, pipeline_name=pipeline_name
        )
        if not tools:
            return StageResult(
                success=False,
                error=(
                    f"Stage '{stage_name}' 无可用工具（配置中所有工具均不可用或未安装）"
                ),
            )

        if not competition_mode:
            return await self._run_fallback(stage_name, tools, input_data)
        else:
            comp = competition_config or {}
            mult = _stage_timeout_multiplier()
            base_timeout = float(comp.get("timeout", 120))
            effective_timeout = base_timeout * mult
            return await self._run_competition(
                stage_name,
                tools,
                input_data,
                max_concurrent=comp.get("max_concurrent", 2),
                timeout=effective_timeout,
                selector=selector,
                judge=judge,
                early_win_cancel=bool(comp.get("early_win_cancel", False)),
                early_win_min_rank=int(comp.get("early_win_min_rank", 1)),
                early_win_grace_seconds=float(comp.get("early_win_grace_seconds", 0.0)),
            )

    async def _run_fallback(
        self,
        stage_name: str,
        tools: List[StageTool],
        input_data: Any,
    ) -> StageResult:
        """降级模式：按 rank 顺序逐个尝试。"""
        for tool in tools:
            try:
                logger.info(
                    "Stage '%s' 降级模式：尝试工具 '%s'",
                    stage_name,
                    tool.name,
                )
                result = await tool.execute(input_data)
                if result.success:
                    result.engine_used = tool.name
                    logger.info(
                        "Stage '%s' 工具 '%s' 成功",
                        stage_name,
                        tool.name,
                    )
                    return result
                logger.warning(
                    "Stage '%s' 工具 '%s' 返回失败: %s",
                    stage_name,
                    tool.name,
                    result.error,
                )
            except Exception as exc:
                logger.warning(
                    "Stage '%s' 工具 '%s' 异常: %s",
                    stage_name,
                    tool.name,
                    exc,
                )
        return StageResult(
            success=False,
            error=f"Stage '{stage_name}' 所有工具均不可用或执行失败",
        )

    async def _run_competition(
        self,
        stage_name: str,
        tools: List[StageTool],
        input_data: Any,
        max_concurrent: int = 2,
        timeout: float = 120.0,
        selector: Optional[Callable] = None,
        judge: Optional[Any] = None,
        early_win_cancel: bool = False,
        early_win_min_rank: int = 1,
        early_win_grace_seconds: float = 0.0,
    ) -> StageResult:
        """竞争模式：并行执行多个工具，择优。

        使用 ``asyncio.as_completed`` 按完成顺序收集结果，
        避免被慢引擎超时拖住整个 Stage。

        当 ``early_win_cancel`` 启用时：rank 在 ``early_win_min_rank`` 内
        （tools 列表已按 rank 升序，``early_win_min_rank=1`` 即仅当 tools[0]
        胜出）的工具成功完成后，再为其余仍在跑的工具留 ``grace_seconds`` 缓冲
        机会，超出缓冲后主动 ``task.cancel()`` 释放算力（取消会向下传导到
        ``EngineWorkerPool``，触发 worker 的 SIGTERM→KILL 三段式）。

        Args:
            early_win_cancel: 启用早胜取消
            early_win_min_rank: 1-based rank 上限；仅 rank ≤ 该值的工具胜出才触发
            early_win_grace_seconds: 取消前的缓冲秒数；为 0 时立即取消
        """
        candidates = tools[:max_concurrent]
        # tools 在 _resolve_tools 中已按 rank 升序排列；用名字集合标记 tier-1 即可
        tier1_names: Set[str] = {
            t.name for t in candidates[: max(1, early_win_min_rank)]
        }
        logger.info(
            "Stage '%s' 竞争模式：并行运行 %d 个工具 [%s]",
            stage_name,
            len(candidates),
            ", ".join(t.name for t in candidates),
        )

        async def _safe_execute(tool: StageTool) -> Tuple[str, Any]:
            try:
                result = await asyncio.wait_for(
                    tool.execute(input_data), timeout=timeout
                )
                return tool.name, result
            except asyncio.CancelledError:
                # 早胜取消路径：让取消信号向下传导到 EngineWorkerPool
                logger.info("Stage '%s' 工具 '%s' 被早胜取消", stage_name, tool.name)
                raise
            except asyncio.TimeoutError:
                logger.warning(
                    "Stage '%s' 工具 '%s' 超时 (%.0fs)",
                    stage_name,
                    tool.name,
                    timeout,
                )
                return tool.name, None
            except Exception as exc:
                logger.warning(
                    "Stage '%s' 工具 '%s' 异常: %s",
                    stage_name,
                    tool.name,
                    exc,
                )
                return tool.name, None

        aws = [asyncio.create_task(_safe_execute(t)) for t in candidates]

        successful: List[StageResult] = []
        cancel_triggered = False
        for coro in asyncio.as_completed(aws):
            try:
                tool_name, result = await coro
            except asyncio.CancelledError:
                # 区分两种 CancelledError 来源：
                # 1) 外层任务取消（如 task_timeout_seconds 兜底 / deadline_monotonic
                #    触发的取消）→ cancelling() > 0，必须 raise 让取消传播；
                # 2) 子任务被早胜路径主动 cancel 后又被 await 到（理论上 break
                #    会先于此发生，留作防御）→ continue 跳过。
                current = asyncio.current_task()
                if current is not None and current.cancelling() > 0:
                    raise
                continue
            if isinstance(result, StageResult) and result.success:
                result.engine_used = tool_name
                successful.append(result)
                if (
                    early_win_cancel
                    and not cancel_triggered
                    and tool_name in tier1_names
                ):
                    cancel_triggered = True
                    pending = [t for t in aws if not t.done()]
                    if pending:
                        if early_win_grace_seconds > 0:
                            logger.info(
                                "Stage '%s' tier-1 工具 '%s' 胜出，等待 %.1fs 缓冲后取消其余 %d 个工具",
                                stage_name,
                                tool_name,
                                early_win_grace_seconds,
                                len(pending),
                            )
                            done, still_pending = await asyncio.wait(
                                pending, timeout=early_win_grace_seconds
                            )
                            for d in done:
                                try:
                                    n2, r2 = d.result()
                                except Exception:  # noqa: BLE001  # nosec B112 - grace 期任务失败不影响主流程
                                    continue
                                if isinstance(r2, StageResult) and r2.success:
                                    r2.engine_used = n2
                                    successful.append(r2)
                            for t in still_pending:
                                t.cancel()
                        else:
                            logger.info(
                                "Stage '%s' tier-1 工具 '%s' 胜出，立即取消其余 %d 个工具",
                                stage_name,
                                tool_name,
                                len(pending),
                            )
                            for t in pending:
                                t.cancel()
                    # 不再继续 as_completed 循环；剩余协程 cancel 后由 GC 回收
                    break

        if not successful:
            return StageResult(
                success=False,
                error=f"Stage '{stage_name}' 所有竞争工具均失败",
            )

        if len(successful) == 1:
            return successful[0]

        # 多个成功结果 -> 择优
        if selector:
            return selector(successful)

        # LLM 评审
        if (
            judge is not None
            and hasattr(judge, "is_available")
            and judge.is_available()
        ):
            try:
                best_idx = await judge.judge(stage_name, successful)
                logger.info(
                    "Stage '%s' LLM 评审选择索引 %d (%s)",
                    stage_name,
                    best_idx,
                    getattr(successful[best_idx], "engine_used", "unknown"),
                )
                return successful[best_idx]
            except Exception as e:
                logger.warning(
                    "Stage '%s' LLM 评审异常，回退到 rank 顺序: %s",
                    stage_name,
                    e,
                )

        return successful[0]  # 默认取 rank 最高的

    def _resolve_tools(
        self,
        tool_configs: List[Dict[str, Any]],
        stage_name: str = "",
        pipeline_name: str = "",
    ) -> List[StageTool]:
        """根据配置解析并排序工具实例。

        Args:
            tool_configs: ``[{name: str, rank: int, enabled: bool}, ...]``
            stage_name: Stage 名称，用于限定名查找（如 ``preprocessing.pymupdf``）
            pipeline_name: Pipeline 名称，用于跨 Pipeline 隔离

        Returns:
            按 rank 排序的可用工具实例列表
        """
        sorted_configs = sorted(
            [tc for tc in tool_configs if tc.get("enabled", True)],
            key=lambda tc: tc.get("rank", 999),
        )
        tools = []
        for tc in sorted_configs:
            name = tc.get("name", "")
            tool = None
            # 1. 尝试 pipeline 感知限定名（如 "pdf.preprocessing.pymupdf"）
            if pipeline_name and stage_name:
                try:
                    tool = get_tool(f"{pipeline_name}.{stage_name}.{name}")
                except ValueError:
                    pass
            # 2. 兼容旧格式 stage 限定名（如 "preprocessing.pymupdf"）
            if tool is None and stage_name:
                try:
                    tool = get_tool(f"{stage_name}.{name}")
                except ValueError:
                    pass
            # 3. 通用名回退（如 "aiohttp"）
            if tool is None:
                try:
                    tool = get_tool(name)
                except ValueError:
                    logger.debug("工具 '%s' 未注册，跳过", name)
                    continue
            if tool.is_available():
                tools.append(tool)
            else:
                logger.info(
                    "Stage '%s' 工具 '%s' 不可用（未安装或环境探测失败），自动跳过",
                    stage_name,
                    name,
                )
        if not tools and sorted_configs:
            names_tried = [tc.get("name", "") for tc in sorted_configs]
            logger.warning(
                "Stage '%s' 无可用工具，已尝试: %s",
                stage_name,
                names_tried,
            )
        elif tools:
            declared = [tc.get("name", "") for tc in sorted_configs]
            logger.info(
                "Stage '%s' 参与竞争 tools=%s（声明=%s，已过滤不可用）",
                stage_name,
                [t.name for t in tools],
                declared,
            )
        return tools


class CompetitiveStage(Stage[TInput, TOutput]):
    """多工具并行竞争 Stage。

    并行运行多个候选工具，通过选择器择优。
    委托 ``StageScheduler._run_competition`` 执行实际竞争逻辑。
    """

    def __init__(
        self,
        stage_id: str,
        stage_name: str,
        candidates: List[StageTool],
        selector: Optional[
            Callable[[List[StageResult[TOutput]]], StageResult[TOutput]]
        ] = None,
        max_concurrent: int = 2,
        timeout: float = 120.0,
    ):
        self._stage_id = stage_id
        self._stage_name = stage_name
        self._candidates = candidates
        self._selector = selector
        self._max_concurrent = max_concurrent
        self._timeout = timeout
        self._scheduler = StageScheduler()

    @property
    def stage_id(self) -> str:
        return self._stage_id

    @property
    def stage_name(self) -> str:
        return self._stage_name

    async def execute(self, input_data: TInput) -> StageResult[TOutput]:
        """并行执行候选工具并择优。"""
        available = [c for c in self._candidates if c.is_available()]
        if not available:
            return StageResult(
                success=False,
                error=f"Stage '{self._stage_id}' 无可用候选工具",
            )

        return await self._scheduler._run_competition(
            stage_name=self._stage_id,
            tools=available,
            input_data=input_data,
            max_concurrent=self._max_concurrent,
            timeout=self._timeout,
            selector=self._selector,
        )
