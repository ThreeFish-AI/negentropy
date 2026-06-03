"""IterationMemoryExtractor — Routine 迭代经验记忆提炼器。

在 Routine 评估闭环中，LLM 分析迭代执行-评估数据，提炼有价值的结构化经验记忆，
存入 Memory Module 作为 NegentropyEngine 的自主习得知识。

设计参照 ``consolidation/llm_fact_extractor.py`` 的成熟模式：
- task_registry 模型解析 + litellm.acompletion + JSON structured output
- 指数退避重试 + 优雅降级
- 零 payload 压缩形态控制 token 成本

衰减率覆盖（``decay_override``）写入 ``metadata_`` JSONB，
由 ``MemoryGovernanceService.calculate_retention_score()`` 在计算时优先读取。

参考文献：
[1] N. Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning,"
    NeurIPS, 2023. arXiv:2303.11366. 跨迭代自反思记忆。
[2] A. Ebbinghaus, "Memory: A Contribution to Experimental Psychology," 1885.
    类型化衰减曲线。
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any

import litellm

from negentropy.engine.utils.model_config import resolve_model_config_async
from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.routine.memory_extractor")

# task_registry 中登记的 task_key；用户可在 /interface/task-models 为本任务单独绑定模型。
_TASK_KEY = "routine.memory_extract"

# 合法的记忆类型子集（不含 core / preference — 不由提取器产生）
_VALID_EXTRACTION_TYPES = frozenset({"procedural", "episodic", "semantic", "fact"})
_FALLBACK_TYPE = "episodic"

# 衰减率覆盖矩阵：verdict × memory_type → decay_override
_DECAY_OVERRIDE_MAP: dict[str, dict[str, float]] = {
    "pass": {
        "procedural": 0.003,
        "semantic": 0.003,
        "fact": 0.005,
        "episodic": 0.02,
    },
    "progressing": {
        "procedural": 0.02,
        "semantic": 0.02,
        "fact": 0.02,
        "episodic": 0.04,
    },
    "regressed": {
        "procedural": 0.03,
        "semantic": 0.03,
        "fact": 0.03,
        "episodic": 0.02,  # 失败经验即避险学习
    },
    "stalled": {
        "procedural": 0.03,
        "semantic": 0.03,
        "fact": 0.03,
        "episodic": 0.02,
    },
}
_DEFAULT_DECAY_OVERRIDE = 0.05

# LLM 提取 prompt
_EXTRACTION_PROMPT = """\
你是 NegentropyEngine 的记忆提炼专家。分析以下自主任务迭代的执行与评估数据，\
提炼值得长期记住的经验知识。

# 任务目标
{goal}

# 验收标准
{acceptance_criteria}

# 本轮执行摘要
{summary}

# 评估结果
评分: {score}/100
判定: {verdict}
评估反思: {reflection}

{gate_section}
# 关键动作序列（摘要）
{condensed_events}

提炼要求：
1. 仅提取**真正有价值**的知识 — 通用常识不值得记忆
2. 每条记忆独立、自包含（不依赖上下文即可理解）
3. 按类型分类：
   - procedural: "如何做"知识、有效方法、最佳实践、错误恢复策略
   - episodic: 特定事件、结果、上下文（如"某次尝试 X 方法失败因为 Y"）
   - semantic: 领域知识、架构理解、代码库结构发现
   - fact: 具体事实发现（如"配置项 X 默认值是 Y"、"模块 M 依赖 L@v1.2"）
4. 每条 ≤200 字，中文

仅输出 JSON：
{{"memories": [{{"content": "...", "type": "procedural|episodic|semantic|fact", \
"rationale": "为何值得记住"}}]}}
"""

# 终止时批量提取 prompt（跨迭代合成）
_TERMINATION_EXTRACTION_PROMPT = """\
你是 NegentropyEngine 的记忆提炼专家。以下是某个自主任务的完整迭代轨迹，\
请提炼跨迭代的经验模式与知识总结。

# 任务目标
{goal}

# 验收标准
{acceptance_criteria}

# 最终结果
状态: {termination_status}
终止原因: {termination_reason}

# 迭代轨迹（从早到晚）
{iteration_timeline}

提炼要求：
1. 提炼**跨迭代的模式认知**（如"前 N 次用方案 A 失败，切换方案 B 成功"）
2. 总结该任务中的**领域知识发现**和**有效方法论**
3. 记录**错误恢复策略**和**避险教训**
4. 每条 ≤200 字，中文，自包含

仅输出 JSON：
{{"memories": [{{"content": "...", "type": "procedural|episodic|semantic|fact", \
"rationale": "为何值得记住"}}]}}
"""

# 事件压缩上限：仅取最近 N 条事件的摘要
_MAX_CONDENSED_EVENTS = 30


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class ExtractedMemory:
    """单条提炼记忆。"""

    content: str  # 记忆文本（≤200 字，中文，自包含）
    memory_type: str  # procedural | episodic | semantic | fact
    rationale: str  # 为何值得记住（审计可追溯性）


@dataclass(frozen=True, slots=True)
class MemoryExtractionResult:
    """单次提取的结果。"""

    memories: list[ExtractedMemory]
    cost_usd: float = 0.0
    model_used: str = ""


# ---------------------------------------------------------------------------
# 衰减率覆盖计算
# ---------------------------------------------------------------------------


def compute_decay_override(verdict: str | None, memory_type: str) -> float:
    """根据迭代 verdict 和记忆类型计算衰减率覆盖。

    返回 ``decay_override`` 值，写入 ``metadata_`` JSONB。
    ``MemoryGovernanceService.calculate_retention_score()`` 优先读取此值。

    Args:
        verdict: 迭代评估判定（pass / progressing / stalled / regressed / unrecoverable）
        memory_type: 记忆类型（procedural / episodic / semantic / fact）

    Returns:
        衰减率 lambda 覆盖值
    """
    verdict_map = _DECAY_OVERRIDE_MAP.get(verdict or "", {})
    return verdict_map.get(memory_type, _DEFAULT_DECAY_OVERRIDE)


# ---------------------------------------------------------------------------
# 提取器
# ---------------------------------------------------------------------------


class IterationMemoryExtractor:
    """LLM 驱动的 Routine 迭代经验记忆提炼器。

    用法::

        extractor = IterationMemoryExtractor(explicit_model="...")
        result = await extractor.extract(routine, iteration, events)
        for m in result.memories:
            await mem_service.add_memory_typed(...)

    内部遵循 ``LLMFactExtractor`` 同一套模型解析 + litellm + 退避重试模式。
    """

    def __init__(
        self,
        *,
        explicit_model: str | None = None,
        temperature: float = 0.0,
        max_retries: int = 3,
    ) -> None:
        self._explicit_model = explicit_model
        self._model: str = ""
        self._model_kwargs: dict[str, Any] = {}
        self._temperature = temperature
        self._max_retries = max_retries

    async def _resolve_model(self) -> None:
        """异步解析当前任务对应的模型。"""
        self._model, self._model_kwargs = await resolve_model_config_async(
            _TASK_KEY,
            explicit_model=self._explicit_model,
        )

    # ------------------------------------------------------------------
    # 单迭代提取
    # ------------------------------------------------------------------

    async def extract(
        self,
        routine: Any,
        iteration: Any,
        events: list[Any] | None = None,
    ) -> MemoryExtractionResult:
        """从单个已完成评估的迭代中提炼经验记忆。

        Args:
            routine: Routine ORM 对象（需 .goal, .acceptance_criteria, .key, .id）
            iteration: RoutineIteration ORM 对象（需 .summary, .score, .verdict,
                        .reflection, .seq, .exec_status, .gate_exit_code）
            events: 可选的 RoutineIterationEvent 列表（用于构建动作摘要）

        Returns:
            MemoryExtractionResult 含提炼记忆列表
        """
        await self._resolve_model()

        prompt = self._build_prompt(routine, iteration, events)
        if not prompt:
            return MemoryExtractionResult(memories=[])

        content, cost = await self._call_llm(prompt)
        if not content:
            return MemoryExtractionResult(memories=[], cost_usd=cost, model_used=self._model)

        memories = self._parse_response(content)
        return MemoryExtractionResult(
            memories=memories,
            cost_usd=cost,
            model_used=self._model,
        )

    # ------------------------------------------------------------------
    # 终止时批量提取
    # ------------------------------------------------------------------

    async def extract_on_termination(
        self,
        routine: Any,
        history: list[Any],
    ) -> MemoryExtractionResult:
        """从 Routine 终止时的全部已评估迭代中合成跨迭代经验记忆。

        Args:
            routine: Routine ORM 对象（需 .goal, .acceptance_criteria, .status,
                        .termination_reason, .key, .id）
            history: 已评估迭代列表（按 seq 升序）

        Returns:
            MemoryExtractionResult 含合成记忆
        """
        await self._resolve_model()

        prompt = self._build_termination_prompt(routine, history)
        if not prompt:
            return MemoryExtractionResult(memories=[])

        content, cost = await self._call_llm(prompt)
        if not content:
            return MemoryExtractionResult(memories=[], cost_usd=cost, model_used=self._model)

        memories = self._parse_response(content)
        return MemoryExtractionResult(
            memories=memories,
            cost_usd=cost,
            model_used=self._model,
        )

    # ------------------------------------------------------------------
    # Prompt 构建
    # ------------------------------------------------------------------

    @staticmethod
    def _build_prompt(
        routine: Any,
        iteration: Any,
        events: list[Any] | None = None,
    ) -> str:
        """构建单迭代提取 prompt。"""
        goal = getattr(routine, "goal", "") or ""
        criteria = getattr(routine, "acceptance_criteria", "") or ""
        summary = getattr(iteration, "summary", "") or "（无摘要）"
        score = getattr(iteration, "score", None)
        score_str = str(score) if score is not None else "N/A"
        verdict = getattr(iteration, "verdict", "") or "N/A"
        reflection = getattr(iteration, "reflection", "") or "（无反思）"

        # 命令门控
        gate_code = getattr(iteration, "gate_exit_code", None)
        if gate_code is not None:
            gate_section = f"# 命令门控\n退出码: {gate_code}\n"
        else:
            gate_section = ""

        # 动作序列压缩
        condensed = _condense_events(events)

        return _EXTRACTION_PROMPT.format(
            goal=goal.strip(),
            acceptance_criteria=criteria.strip(),
            summary=summary[:1000],  # 控制输入长度
            score=score_str,
            verdict=verdict,
            reflection=reflection[:500],
            gate_section=gate_section,
            condensed_events=condensed,
        )

    @staticmethod
    def _build_termination_prompt(routine: Any, history: list[Any]) -> str:
        """构建终止时批量提取 prompt。"""
        goal = getattr(routine, "goal", "") or ""
        criteria = getattr(routine, "acceptance_criteria", "") or ""
        status = getattr(routine, "status", "") or "unknown"
        reason = getattr(routine, "termination_reason", "") or "unknown"

        timeline_parts: list[str] = []
        for it in history:
            seq = getattr(it, "seq", "?")
            score = getattr(it, "score", None)
            verdict = getattr(it, "verdict", "")
            reflection = getattr(it, "reflection", "") or ""
            summary = getattr(it, "summary", "") or ""
            score_str = str(score) if score is not None else "N/A"
            timeline_parts.append(
                f"### 迭代 #{seq} (评分={score_str}, 判定={verdict})\n摘要: {summary[:300]}\n反思: {reflection[:200]}"
            )
        timeline = "\n\n".join(timeline_parts) if timeline_parts else "（无迭代历史）"

        return _TERMINATION_EXTRACTION_PROMPT.format(
            goal=goal.strip(),
            acceptance_criteria=criteria.strip(),
            termination_status=status,
            termination_reason=reason,
            iteration_timeline=timeline[:3000],  # 控制总长度
        )

    # ------------------------------------------------------------------
    # LLM 调用
    # ------------------------------------------------------------------

    async def _call_llm(self, prompt: str) -> tuple[str, float]:
        """调用 LLM 提取记忆，返回 (content, cost_usd)。

        失败时返回 ("", 0.0)。
        """
        last_error: Exception | None = None
        for attempt in range(self._max_retries):
            try:
                safe_kwargs = {
                    k: v
                    for k, v in self._model_kwargs.items()
                    if k not in ("model", "messages", "temperature", "response_format")
                }
                response = await litellm.acompletion(
                    model=self._model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=self._temperature,
                    response_format={"type": "json_object"},
                    **safe_kwargs,
                )
                content = response.choices[0].message.content or ""
                cost = getattr(response, "_hidden_params", {}).get("response_cost", 0.0) or 0.0
                return content, cost
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "routine_memory_extraction_retry",
                    attempt=attempt + 1,
                    error=str(exc),
                )
                await asyncio.sleep(2**attempt)

        logger.warning(
            "routine_memory_extraction_failed",
            error=str(last_error),
            model=self._model,
        )
        return "", 0.0

    # ------------------------------------------------------------------
    # 响应解析
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_response(content: str) -> list[ExtractedMemory]:
        """解析 LLM JSON 响应为 ExtractedMemory 列表。"""
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            logger.warning("routine_memory_response_not_json", content_preview=content[:200])
            return []

        items = data.get("memories", [])
        if not isinstance(items, list):
            return []

        results: list[ExtractedMemory] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            raw_content = str(item.get("content", "")).strip()
            if not raw_content:
                continue
            raw_type = str(item.get("type", "")).strip().lower()
            memory_type = raw_type if raw_type in _VALID_EXTRACTION_TYPES else _FALLBACK_TYPE
            rationale = str(item.get("rationale", "")).strip()
            results.append(
                ExtractedMemory(
                    content=raw_content[:500],  # 硬上限防 DB 膨胀
                    memory_type=memory_type,
                    rationale=rationale[:500],
                )
            )
        return results


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def _condense_events(events: list[Any] | None) -> str:
    """将迭代事件列表压缩为摘要形态（仅 event_type + tool_name + title）。

    限制条数与单条长度以控制 token 成本。
    """
    if not events:
        return "（无事件记录）"

    lines: list[str] = []
    for evt in events[-_MAX_CONDENSED_EVENTS:]:
        event_type = getattr(evt, "event_type", "?")
        tool_name = getattr(evt, "tool_name", None)
        title = getattr(evt, "title", None)
        label = f"[{event_type}]"
        if tool_name:
            label += f" {tool_name}"
        if title:
            label += f": {title[:80]}"
        lines.append(f"- {label}")
    return "\n".join(lines)


__all__ = [
    "ExtractedMemory",
    "MemoryExtractionResult",
    "IterationMemoryExtractor",
    "compute_decay_override",
]
