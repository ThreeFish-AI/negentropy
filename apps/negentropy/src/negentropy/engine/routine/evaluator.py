"""Routine 评估器 — LLM-as-Judge + 可选命令门控（混合方案）。

闭环中 Engine 担任 Evaluator：对 Claude Code 的阶段性产出，依据验收标准评分（0-100）、
给出 verdict 与自然语言反思（reflection）。混合方案以客观命令门控
（``verification_command`` 的退出码）锚定 LLM 评分，缓解 LLM-as-Judge 的已知偏差。

LLM 调用路径复用 ``LLMFactExtractor`` 范式：``resolve_model_config_async`` 解析模型
+ ``litellm.acompletion`` 结构化 JSON 输出 + 指数退避重试。

参考文献：
[1] J. Gu et al., "A Survey on LLM-as-a-Judge," arXiv:2411.15594, 2024. 偏差与缓解。
[2] OpenAI, *Codex: long-horizon tasks*, 2025. 测试驱动的自我校验（Plan→Edit→Test→Repair）。
"""

from __future__ import annotations

import asyncio
import json
from contextlib import suppress
from dataclasses import dataclass
from typing import Any, Protocol

import litellm

from negentropy.engine.utils.model_config import resolve_model_config_async
from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.routine.evaluator")

_TASK_KEY = "routine.evaluate"
_VALID_VERDICTS = {"pass", "progressing", "stalled", "regressed", "unrecoverable"}
_SUMMARY_MAX_CHARS = 4000
# 门控完整输出审计上限（供「全过程」审计事件；给 LLM 的仍是 _format_gate 的 [-1000:] 切片）。
_GATE_OUTPUT_AUDIT_CAP = 16 * 1024

_JUDGE_PROMPT = """你是一名严格、客观的任务评审员。请根据「目标」与「验收标准」，评估执行者本轮产出的质量。

# 目标
{goal}

# 验收标准
{acceptance_criteria}

# 执行者本轮产出摘要
{summary}

# 客观验证结果
{gate_section}

评审要求：
1. score：0-100 的整数。验收标准全部满足≈90-100；主体完成有瑕疵≈70-89；部分推进≈40-69；几乎无进展≈0-39。
2. 若「客观验证结果」显示命令失败（退出码非 0），score 不得高于 60。
3. verdict 取值（仅一项）：
   - pass：达到验收标准，可终止；
   - progressing：较上轮有实质推进，应继续；
   - stalled：基本无推进；
   - regressed：较上轮退步；
   - unrecoverable：存在无法通过继续迭代解决的根本障碍（如目标自相矛盾、缺失必要前提）。
4. reflection：给执行者的具体、可操作改进建议（指出尚未满足的验收项与下一步动作），中文，≤200字。

仅输出 JSON：
{{"score": <int 0-100>, "verdict": "<pass|progressing|stalled|regressed|unrecoverable>", "reflection": "<改进建议>"}}"""


class _RoutineLike(Protocol):
    goal: str
    acceptance_criteria: str
    cwd: str | None
    verification_command: str | None
    # worktree routine：CC 实际在隔离 worktree 内工作，门控须同处执行（见 _gate_cwd）。
    worktree_path: str | None
    # per-routine 门控超时覆盖（来自 config.gate_timeout_seconds）；None → 用实例级默认。
    gate_timeout_seconds: int | None


class _IterationLike(Protocol):
    exec_status: str | None
    summary: str | None
    exec_error: str | None


@dataclass(frozen=True, slots=True)
class EvaluationResult:
    """评估产出。``ok=False`` 时表示评估自身失败（LLM 不可用等），上层据此重试/容忍。"""

    ok: bool
    score: int | None = None
    verdict: str | None = None
    reflection: str | None = None
    gate_exit_code: int | None = None
    error: str | None = None
    # 「全过程」审计：Judge 实际 prompt、Judge 原始回复、Gate 命令完整输出（≤16KB）。
    judge_prompt: str | None = None
    judge_raw: str | None = None
    gate_output: str | None = None


class RoutineEvaluator:
    """Routine 迭代评估器：命令门控 + LLM-as-Judge。"""

    def __init__(
        self,
        *,
        explicit_model: str | None = None,
        temperature: float = 0.0,
        max_retries: int = 3,
        gate_timeout_seconds: int = 120,
        judge_timeout_seconds: int = 60,
    ) -> None:
        self._explicit_model = explicit_model
        self._temperature = temperature
        self._max_retries = max_retries
        self._gate_timeout_seconds = gate_timeout_seconds
        # LLM Judge 单次调用显式超时（与 PlanReviewer 对齐）。缺失时 litellm 默认无超时，
        # 慢/挂起的推理模型调用会无界阻塞——历史上这是「卡在 Evaluate」的根因之一。
        self._judge_timeout_seconds = judge_timeout_seconds

    async def evaluate(self, routine: _RoutineLike, iteration: _IterationLike) -> EvaluationResult:
        """评估一次迭代产出，返回 score / verdict / reflection / gate_exit_code。

        流程：先跑命令门控（若配置）→ 再调用 LLM Judge（门控结果作为锚点输入）。
        LLM 失败重试耗尽 → 返回 ``ok=False``，由 orchestrator 据 eval_failure_patience 处理。
        """
        # 1) 命令门控（可选）。per-routine 超时覆盖：大型复刻任务测试套件可能超默认 120s。
        gate_exit_code: int | None = None
        gate_output = ""
        if routine.verification_command:
            gate_timeout = getattr(routine, "gate_timeout_seconds", None)
            gate_exit_code, gate_output = await self._run_gate(
                routine.verification_command, self._gate_cwd(routine), timeout=gate_timeout
            )

        # 2) LLM Judge
        summary = (iteration.summary or "").strip()
        if iteration.exec_status in ("error", "timeout"):
            # 执行失败也要评估：把错误信息交给 judge，通常判 regressed/stalled
            summary = (f"[执行 {iteration.exec_status}] {iteration.exec_error or ''}\n\n{summary}").strip()
        summary = summary[:_SUMMARY_MAX_CHARS] or "(执行者未产出任何摘要)"

        gate_section = self._format_gate(routine.verification_command, gate_exit_code, gate_output)
        # 在此构造 prompt（而非 _judge 内部），使失败路径也能回带 judge_prompt 供审计。
        judge_prompt = _JUDGE_PROMPT.format(
            goal=routine.goal,
            acceptance_criteria=routine.acceptance_criteria,
            summary=summary,
            gate_section=gate_section,
        )
        audit_gate = gate_output or None  # 门控完整输出（≤16KB）供审计；None 表示未配置门控

        try:
            score, verdict, reflection, judge_raw = await self._judge(judge_prompt)
        except Exception as exc:
            logger.warning("routine_evaluate_judge_failed", error=str(exc))
            return EvaluationResult(
                ok=False,
                gate_exit_code=gate_exit_code,
                error=str(exc),
                judge_prompt=judge_prompt,
                gate_output=audit_gate,
            )

        return EvaluationResult(
            ok=True,
            score=score,
            verdict=verdict,
            reflection=reflection,
            gate_exit_code=gate_exit_code,
            judge_prompt=judge_prompt,
            judge_raw=judge_raw,
            gate_output=audit_gate,
        )

    @staticmethod
    def _gate_cwd(routine: _RoutineLike) -> str | None:
        """门控命令的有效执行目录：优先隔离 worktree，回退 routine.cwd。

        worktree routine 的 Claude Code 在引擎备好的隔离 worktree（``worktree_path``）内改代码，
        故验收命令（如 ``python3 hello.py`` / ``uv run pytest``）必须同处执行，否则在原始 ``cwd``
        根目录运行将找不到 CC 新建/修改的文件（exit 2 file-not-found）、永远无法通过门控——
        与 ``orchestrator._build_config`` 的 ``effective_cwd`` 逻辑保持一致。
        """
        return getattr(routine, "worktree_path", None) or routine.cwd

    async def _run_gate(self, command: str, cwd: str | None, timeout: int | None = None) -> tuple[int | None, str]:
        """在 ``cwd`` 执行验证命令，返回 (exit_code, 截断输出)。

        超时 → exit_code=124（约定的超时退出码）；异常 → exit_code=1。**绝不返回 None**——
        None 须**仅**表示「未配置门控」，否则 ``decision.decide`` 的成功判据
        ``gate_exit_code in (None, 0)`` 会把「门控超时/异常」误当作「门控通过」，致未知验证状态被判成功
        （ISSUE-115）。超时阈值优先用 per-routine ``timeout``（来自 ``config.gate_timeout_seconds``），
        缺省回退实例级默认——大型复刻任务的测试套件可能超 120s，需可调以免评分被超时永久压顶。

        以 ``start_new_session=True`` 起独立进程组，超时时整组 SIGKILL，避免 pytest 等
        fork 出的子进程在 shell 被杀后变成孤儿泄漏。
        """
        effective_timeout = timeout if (isinstance(timeout, int) and timeout > 0) else self._gate_timeout_seconds
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                cwd=cwd or None,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                start_new_session=True,
            )
            try:
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=effective_timeout)
            except TimeoutError:
                self._kill_process_group(proc)
                with suppress(Exception):
                    await proc.communicate()
                logger.warning("routine_gate_timeout", command=command[:120], timeout_s=effective_timeout)
                return 124, f"(命令执行超时 {effective_timeout}s)"
            # 审计保留尾部 16KB（给 LLM 的仍由 _format_gate 切到 [-1000:]，行为不变）。
            output = (stdout or b"").decode("utf-8", errors="replace")[-_GATE_OUTPUT_AUDIT_CAP:]
            return proc.returncode, output
        except Exception as exc:
            logger.warning("routine_gate_failed", command=command[:120], error=str(exc))
            return 1, f"(命令执行异常: {exc})"

    @staticmethod
    def _kill_process_group(proc) -> None:
        """杀掉子进程所在进程组；失败则降级单进程 kill。"""
        import os
        import signal

        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError, OSError):
            with suppress(Exception):
                proc.kill()

    @staticmethod
    def _format_gate(command: str | None, exit_code: int | None, output: str) -> str:
        if not command:
            return "（本任务未配置客观验证命令）"
        status = "通过 (exit 0)" if exit_code == 0 else f"失败 (exit {exit_code})"
        tail = output.strip()[-1000:]
        return f"命令 `{command}` 执行结果：{status}\n输出尾部：\n{tail}"

    async def _judge(self, prompt: str) -> tuple[int, str, str, str]:
        """调用 LLM 评审，解析结构化 JSON；含指数退避重试。

        prompt 由调用方（``evaluate``）构造并传入，使评估失败路径也能回带 judge_prompt 供审计。
        返回 ``(score, verdict, reflection, raw_content)``。
        """
        model, model_kwargs = await resolve_model_config_async(_TASK_KEY, explicit_model=self._explicit_model)
        safe_kwargs = {
            k: v for k, v in model_kwargs.items() if k not in ("model", "messages", "temperature", "response_format")
        }

        last_error: Exception | None = None
        for attempt in range(self._max_retries):
            try:
                response = await litellm.acompletion(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=self._temperature,
                    response_format={"type": "json_object"},
                    timeout=self._judge_timeout_seconds,
                    **safe_kwargs,
                )
                content = response.choices[0].message.content
                score, verdict, reflection = self._parse(content)
                return score, verdict, reflection, content or ""
            except Exception as exc:
                last_error = exc
                logger.warning("routine_judge_retry", attempt=attempt + 1, error=str(exc))
                await asyncio.sleep(2**attempt)

        raise RuntimeError(f"LLM judge failed after {self._max_retries} retries: {last_error}")

    @staticmethod
    def _parse(content: str | None) -> tuple[int, str, str]:
        """解析 judge JSON，做边界裁剪与字段校验。"""
        data: dict[str, Any] = json.loads(content or "{}")

        raw_score = data.get("score", 0)
        try:
            score = int(round(float(raw_score)))
        except (TypeError, ValueError):
            score = 0
        score = max(0, min(100, score))

        verdict = str(data.get("verdict", "")).strip().lower()
        if verdict not in _VALID_VERDICTS:
            # 依据分数兜底推断 verdict，保证决策层有合法输入
            verdict = "progressing" if score >= 40 else "stalled"

        reflection = str(data.get("reflection", "")).strip()
        return score, verdict, reflection


__all__ = ["RoutineEvaluator", "EvaluationResult"]
