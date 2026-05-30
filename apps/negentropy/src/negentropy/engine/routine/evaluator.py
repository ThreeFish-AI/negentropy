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


class RoutineEvaluator:
    """Routine 迭代评估器：命令门控 + LLM-as-Judge。"""

    def __init__(
        self,
        *,
        explicit_model: str | None = None,
        temperature: float = 0.0,
        max_retries: int = 3,
        gate_timeout_seconds: int = 120,
    ) -> None:
        self._explicit_model = explicit_model
        self._temperature = temperature
        self._max_retries = max_retries
        self._gate_timeout_seconds = gate_timeout_seconds

    async def evaluate(self, routine: _RoutineLike, iteration: _IterationLike) -> EvaluationResult:
        """评估一次迭代产出，返回 score / verdict / reflection / gate_exit_code。

        流程：先跑命令门控（若配置）→ 再调用 LLM Judge（门控结果作为锚点输入）。
        LLM 失败重试耗尽 → 返回 ``ok=False``，由 orchestrator 据 eval_failure_patience 处理。
        """
        # 1) 命令门控（可选）
        gate_exit_code: int | None = None
        gate_output = ""
        if routine.verification_command:
            gate_exit_code, gate_output = await self._run_gate(routine.verification_command, routine.cwd)

        # 2) LLM Judge
        summary = (iteration.summary or "").strip()
        if iteration.exec_status in ("error", "timeout"):
            # 执行失败也要评估：把错误信息交给 judge，通常判 regressed/stalled
            summary = (f"[执行 {iteration.exec_status}] {iteration.exec_error or ''}\n\n{summary}").strip()
        summary = summary[:_SUMMARY_MAX_CHARS] or "(执行者未产出任何摘要)"

        gate_section = self._format_gate(routine.verification_command, gate_exit_code, gate_output)

        try:
            score, verdict, reflection = await self._judge(
                routine.goal, routine.acceptance_criteria, summary, gate_section
            )
        except Exception as exc:
            logger.warning("routine_evaluate_judge_failed", error=str(exc))
            return EvaluationResult(ok=False, gate_exit_code=gate_exit_code, error=str(exc))

        return EvaluationResult(
            ok=True,
            score=score,
            verdict=verdict,
            reflection=reflection,
            gate_exit_code=gate_exit_code,
        )

    async def _run_gate(self, command: str, cwd: str | None) -> tuple[int | None, str]:
        """在 ``cwd`` 执行验证命令，返回 (exit_code, 截断输出)。超时/异常 → exit_code=None。

        以 ``start_new_session=True`` 起独立进程组，超时时整组 SIGKILL，避免 pytest 等
        fork 出的子进程在 shell 被杀后变成孤儿泄漏。
        """
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                cwd=cwd or None,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                start_new_session=True,
            )
            try:
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=self._gate_timeout_seconds)
            except TimeoutError:
                self._kill_process_group(proc)
                with suppress(Exception):
                    await proc.communicate()
                logger.warning("routine_gate_timeout", command=command[:120])
                return None, f"(命令执行超时 {self._gate_timeout_seconds}s)"
            output = (stdout or b"").decode("utf-8", errors="replace")[-2000:]
            return proc.returncode, output
        except Exception as exc:
            logger.warning("routine_gate_failed", command=command[:120], error=str(exc))
            return None, f"(命令执行异常: {exc})"

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

    async def _judge(
        self, goal: str, acceptance_criteria: str, summary: str, gate_section: str
    ) -> tuple[int, str, str]:
        """调用 LLM 评审，解析结构化 JSON；含指数退避重试。"""
        model, model_kwargs = await resolve_model_config_async(_TASK_KEY, explicit_model=self._explicit_model)
        prompt = _JUDGE_PROMPT.format(
            goal=goal,
            acceptance_criteria=acceptance_criteria,
            summary=summary,
            gate_section=gate_section,
        )
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
                    **safe_kwargs,
                )
                content = response.choices[0].message.content
                return self._parse(content)
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
