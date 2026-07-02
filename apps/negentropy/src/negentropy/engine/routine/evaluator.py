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
from collections.abc import Sequence
from contextlib import suppress
from dataclasses import dataclass
from typing import Any, Protocol

import litellm

from negentropy.engine.routine.trajectory import build_anchor_audit, format_anchor_context
from negentropy.engine.utils.json_extract import loads_lenient
from negentropy.engine.utils.model_config import resolve_model_config_async
from negentropy.engine.utils.subprocess_env import inherited_env_without_engine_venv
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
1. acceptance_met：布尔值。当且仅当「验收标准」中的**全部**要求都已客观达成
   （含其中声明的端到端/部署/切换等硬性条件）时为 true；
   只要有任一验收项未完成或无法证实，即为 false。
2. score：0-100 的整数。验收标准全部满足≈90-100；主体完成有瑕疵≈70-89；部分推进≈40-69；几乎无进展≈0-39。
3. 若「客观验证结果」显示命令失败（退出码非 0），score 不得高于 60。
4. verdict 取值（仅一项）：
   - pass：达到验收标准，可终止；
   - progressing：较上轮有实质推进，应继续；
   - stalled：基本无推进；
   - regressed：较上轮退步；
   - unrecoverable：存在无法通过继续迭代解决的根本障碍（如目标自相矛盾、缺失必要前提）。
5. reflection：给执行者的具体、可操作改进建议（指出尚未满足的验收项与下一步动作），中文，≤200字。

仅输出 JSON（单行）：
{{"acceptance_met": <true|false>, "score": <int 0-100>,
  "verdict": "<pass|progressing|stalled|regressed|unrecoverable>", "reflection": "<改进建议>"}}"""

# 锚定版 Judge prompt：在「客观验证结果」与「评审要求」之间插入 {anchor_section}，
# 并追加 progress_evidence（证据先于给分）与评分锚定一致性两条要求；JSON 输出行将 progress_evidence 置首
# 以强制生成侧「先陈述证据、再落分数」的链式锚定（chain-of-anchoring）。其余段落与 _JUDGE_PROMPT 同源。
_JUDGE_PROMPT_ANCHORED = """你是一名严格、客观的任务评审员。请根据「目标」与「验收标准」，评估执行者本轮产出的质量。

# 目标
{goal}

# 验收标准
{acceptance_criteria}

# 执行者本轮产出摘要
{summary}

# 客观验证结果
{gate_section}

{anchor_section}
评审要求：
1. acceptance_met：布尔值。当且仅当「验收标准」中的**全部**要求都已客观达成
   （含其中声明的端到端/部署/切换等硬性条件）时为 true；
   只要有任一验收项未完成或无法证实，即为 false。
2. score：0-100 的整数。验收标准全部满足≈90-100；主体完成有瑕疵≈70-89；部分推进≈40-69；几乎无进展≈0-39。
3. 若「客观验证结果」显示命令失败（退出码非 0），score 不得高于 60。
4. verdict 取值（仅一项）：
   - pass：达到验收标准，可终止；
   - progressing：较上轮有实质推进，应继续；
   - stalled：基本无推进；
   - regressed：较上轮退步；
   - unrecoverable：存在无法通过继续迭代解决的根本障碍（如目标自相矛盾、缺失必要前提）。
5. reflection：给执行者的具体、可操作改进建议（指出尚未满足的验收项与下一步动作），中文，≤200字。
6. progress_evidence：**先于评分完成**——用本轮产出摘要中的具体事实，说明相对上一轮的进展或退步
   （上一轮改进建议是否被落实？哪些验收项的状态发生了变化？），中文，≤150 字。
7. 评分锚定一致性：score 须与评分轨迹相容——
   - 若 progress_evidence 中没有实质退步证据（无门控由过转败、无既有能力被破坏），score 不得低于上一轮 10 分以上；
   - 若没有实质新进展证据，score 亦不得高于上一轮 10 分以上；
   - 轨迹只是锚点、不是地板或天花板：有确凿证据的真实退步或突破必须如实反映；第 3 条（门控失败封顶 60）
     与验收判定（acceptance_met）优先于本条。

仅输出 JSON（单行）：
{{"progress_evidence": "<相对上一轮的进展/退步证据，中文，≤150字>", "acceptance_met": <true|false>,
  "score": <int 0-100>,
  "verdict": "<pass|progressing|stalled|regressed|unrecoverable>", "reflection": "<改进建议>"}}"""


class _RoutineLike(Protocol):
    goal: str
    acceptance_criteria: str
    cwd: str | None
    verification_command: str | None
    # worktree routine：CC 实际在隔离 worktree 内工作，门控须同处执行（见 _gate_cwd）。
    worktree_path: str | None
    # per-routine 门控超时覆盖（来自 config.gate_timeout_seconds）；None → 用实例级默认。
    gate_timeout_seconds: int | None
    # per-routine 验收未达成评分上限覆盖（来自 config.acceptance_unmet_score_cap）；None → 用实例级默认。
    acceptance_unmet_score_cap: int | None
    # per-routine Judge 模型覆盖（来自 config.evaluator_model）；None → 用实例级默认（全局 task 模型）。
    # 高风险复刻类任务的 acceptance 裁决需要更强模型——弱模型（如 gpt-5-nano）易误判
    # acceptance_met=true 触发过早不可逆 SUCCESS+PR（ISSUE-121）。
    evaluator_model: str | None
    # per-routine 锚点轨迹窗口覆盖（来自 config.judge_anchor_window）；None → 用实例级默认 5。
    judge_anchor_window: int | None


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
    # 锚定评估（纵向）：相对上一轮的进展/退步证据（强制「证据先于给分」），缺失→None 容错。
    progress_evidence: str | None = None
    # 锚点上下文审计摘要（写入 iteration.metrics["judge_anchor"]）；未启用锚定时为 None。
    anchor: dict | None = None


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
        acceptance_unmet_score_cap: int | None = None,
    ) -> None:
        self._explicit_model = explicit_model
        self._temperature = temperature
        self._max_retries = max_retries
        self._gate_timeout_seconds = gate_timeout_seconds
        # 验收未达成时的确定性评分上限（>0 时生效）：把「未满足 Acceptance 即减半/封顶」由
        # 仅写在 acceptance_criteria 散文里、依赖小模型自觉，提升为引擎层确定性机制（ISSUE-116）。
        # None/0 = 关闭（退化原行为，对其它 routine 零影响）。per-routine 可经 config 覆盖（见 evaluate）。
        self._acceptance_unmet_score_cap = acceptance_unmet_score_cap
        # LLM Judge 单次调用显式超时（与 PlanReviewer 对齐）。缺失时 litellm 默认无超时，
        # 慢/挂起的推理模型调用会无界阻塞——历史上这是「卡在 Evaluate」的根因之一。
        self._judge_timeout_seconds = judge_timeout_seconds

    async def evaluate(
        self,
        routine: _RoutineLike,
        iteration: _IterationLike,
        history: Sequence[Any] | None = None,
    ) -> EvaluationResult:
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
        # 锚定评估（纵向）：history 非空且含已评分迭代时，渲染中文锚点段并切换到锚定版 prompt。
        # 调用方负责 floor 过滤（重启后旧迭代不进锚点）与本次尝试窗口语义。锚点上下文随成功/失败路径都回带供审计。
        anchor_context = ""
        anchor_audit: dict | None = None
        if history:
            anchor_window = getattr(routine, "judge_anchor_window", None) or 5
            anchor_context = format_anchor_context(history, window=anchor_window)
            if anchor_context:
                anchor_audit = build_anchor_audit(history, window=anchor_window)

        # 在此构造 prompt（而非 _judge 内部），使失败路径也能回带 judge_prompt 供审计。
        template = _JUDGE_PROMPT_ANCHORED if anchor_context else _JUDGE_PROMPT
        judge_prompt = template.format(
            goal=routine.goal,
            acceptance_criteria=routine.acceptance_criteria,
            summary=summary,
            gate_section=gate_section,
            anchor_section=anchor_context,
        )
        audit_gate = gate_output or None  # 门控完整输出（≤16KB）供审计；None 表示未配置门控

        # per-routine Judge 模型覆盖（高风险 acceptance 裁决用更强模型，缓解弱模型误判，ISSUE-121）。
        model_override = getattr(routine, "evaluator_model", None)
        try:
            score, verdict, reflection, judge_raw, acceptance_met, progress_evidence = await self._judge(
                judge_prompt, model_override=model_override
            )
        except Exception as exc:
            logger.warning("routine_evaluate_judge_failed", error=str(exc))
            return EvaluationResult(
                ok=False,
                gate_exit_code=gate_exit_code,
                error=str(exc),
                judge_prompt=judge_prompt,
                gate_output=audit_gate,
                progress_evidence=None,
                anchor=anchor_audit,
            )

        # 验收未达成的确定性评分封顶（ISSUE-116）：把 acceptance_criteria 散文里的「未达标即减半/封顶」
        # 规则提升为引擎机制——不依赖小模型自觉。per-routine config.acceptance_unmet_score_cap 覆盖实例默认；
        # 仅当 judge 明确 acceptance_met is False 且 cap>0 时生效（acceptance_met=None/缺失则不封顶，向后兼容）。
        cap = getattr(routine, "acceptance_unmet_score_cap", None)
        if not (isinstance(cap, int) and cap > 0):
            cap = self._acceptance_unmet_score_cap
        if isinstance(cap, int) and cap > 0 and acceptance_met is False and score > cap:
            logger.info("routine_score_capped_acceptance_unmet", original=score, cap=cap)
            score = cap
            if verdict == "pass":  # 验收未达成绝不应判 pass；纠正为 progressing 供继续迭代
                verdict = "progressing"

        return EvaluationResult(
            ok=True,
            score=score,
            verdict=verdict,
            reflection=reflection,
            gate_exit_code=gate_exit_code,
            judge_prompt=judge_prompt,
            judge_raw=judge_raw,
            gate_output=audit_gate,
            progress_evidence=progress_evidence,
            anchor=anchor_audit,
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
                # 净化环境：剥离引擎自身 uv run/venv 激活变量（VIRTUAL_ENV / UV_RUN_RECURSION_DEPTH），
                # 避免泄漏给 worktree 内的门控命令——否则 `uv run pytest` 报 VIRTUAL_ENV 错配警告，
                # 非 uv 门控（裸 pytest/python）更会落到引擎 venv 找错包产生假失败污染评分（ISSUE-120）。
                env=inherited_env_without_engine_venv(),
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

    async def _judge(
        self, prompt: str, *, model_override: str | None = None
    ) -> tuple[int, str, str, str, bool | None, str | None]:
        """调用 LLM 评审，解析结构化 JSON；含指数退避重试。

        prompt 由调用方（``evaluate``）构造并传入，使评估失败路径也能回带 judge_prompt 供审计。
        ``model_override`` 为 per-routine Judge 模型覆盖（优先于实例级 ``explicit_model``）。
        返回 ``(score, verdict, reflection, raw_content, acceptance_met, progress_evidence)``。
        ``progress_evidence`` 仅锚定版 prompt 产出；缺失/非锚定→None（``_parse`` 容错）。

        FacultyBridge（路径 A，详见 ADR 040）：当 ``settings.routine.faculty_bridge_enabled`` 开启时，
        优先经 ADK Runner 同步调用**真实元神（Contemplation）Faculty** 产出评估 JSON；失败/超时/解析
        异常即降级到下方 litellm 直调，保证评估永不因 Faculty 不可用而中断。两条路径接收同一 prompt
        字符串，故锚点注入对二者逐字节一致。
        """
        from negentropy.config import settings

        if settings.routine.faculty_bridge_enabled:
            with suppress(Exception):
                from negentropy.engine.routine.faculty_bridge import run_faculty

                text = await run_faculty(
                    "contemplation",
                    prompt,
                    timeout_seconds=float(settings.routine.faculty_bridge_timeout_seconds),
                )
                if text:
                    score, verdict, reflection, acceptance_met, progress_evidence = self._parse(text)
                    return score, verdict, reflection, text, acceptance_met, progress_evidence
                logger.info("routine_judge_faculty_bridge_empty_fallback_litellm")

        model, model_kwargs = await resolve_model_config_async(
            _TASK_KEY, explicit_model=model_override or self._explicit_model
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
                    timeout=self._judge_timeout_seconds,
                    **safe_kwargs,
                )
                content = response.choices[0].message.content
                score, verdict, reflection, acceptance_met, progress_evidence = self._parse(content)
                return score, verdict, reflection, content or "", acceptance_met, progress_evidence
            except Exception as exc:
                last_error = exc
                logger.warning("routine_judge_retry", attempt=attempt + 1, error=str(exc))
                await asyncio.sleep(2**attempt)

        raise RuntimeError(f"LLM judge failed after {self._max_retries} retries: {last_error}")

    @staticmethod
    def _parse(content: str | None) -> tuple[int, str, str, bool | None, str | None]:
        """解析 judge JSON，做边界裁剪与字段校验。返回 (score, verdict, reflection, acceptance_met, progress_evidence)。

        ``acceptance_met`` / ``progress_evidence`` 缺失（旧模型/未锚定模板/未遵循新契约）→ None，
        由调用方决定是否施加 cap / 审计回填。
        """
        # 容错解析：剥离强模型（如 claude-sonnet-4-6）的 ```json 围栏后再 loads（ISSUE-127）。
        data: dict[str, Any] = loads_lenient(content)

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

        raw_am = data.get("acceptance_met")
        acceptance_met: bool | None = raw_am if isinstance(raw_am, bool) else None

        raw_pe = data.get("progress_evidence")
        progress_evidence: str | None = str(raw_pe).strip() or None if isinstance(raw_pe, str) else None
        return score, verdict, reflection, acceptance_met, progress_evidence


__all__ = ["RoutineEvaluator", "EvaluationResult"]
