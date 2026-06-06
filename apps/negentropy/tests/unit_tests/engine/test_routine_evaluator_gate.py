"""Routine 评估器门控执行目录单测 — ``_gate_cwd`` 纯函数（无 LLM / 无子进程）。

回归锚定：worktree routine 的验收命令必须在隔离 worktree（``worktree_path``）内执行，而非
原始 ``cwd`` 根目录——否则在根目录运行将找不到 Claude Code 在 worktree 内新建/修改的文件
（exit 2 file-not-found），评分被 gate 限制在 60、永远无法达成阈值（实测 #1-#4 卡 55）。
修复后 gate 在 worktree 内运行，gate=0 → 评分跃升 95+ → 成功收敛。
"""

from __future__ import annotations

from dataclasses import dataclass

from negentropy.engine.routine.evaluator import RoutineEvaluator


@dataclass
class _FakeRoutine:
    """评估器只读视图（避免依赖 ORM / DB）。"""

    cwd: str | None = None
    worktree_path: str | None = None
    verification_command: str | None = None
    goal: str = "g"
    acceptance_criteria: str = "ac"


def test_gate_cwd_prefers_worktree_path():
    """worktree routine：门控执行目录应取 worktree_path（CC 实际工作区），而非原始 cwd。"""
    routine = _FakeRoutine(
        cwd="/repo/project-root",
        worktree_path="/repo/.negentropy-worktrees/proj-20260101000000",
    )
    assert RoutineEvaluator._gate_cwd(routine) == "/repo/.negentropy-worktrees/proj-20260101000000"


def test_gate_cwd_falls_back_to_cwd_when_no_worktree():
    """非 worktree routine（worktree_path 为空）：回退到原始 cwd。"""
    routine = _FakeRoutine(cwd="/repo/project-root", worktree_path=None)
    assert RoutineEvaluator._gate_cwd(routine) == "/repo/project-root"


def test_gate_cwd_empty_worktree_falls_back():
    """worktree_path 为空字符串时（防御）回退 cwd，不返回空串误导子进程 cwd。"""
    routine = _FakeRoutine(cwd="/repo/project-root", worktree_path="")
    assert RoutineEvaluator._gate_cwd(routine) == "/repo/project-root"


def test_gate_cwd_all_none_returns_none():
    """cwd 与 worktree_path 均为空 → None（子进程继承父进程 cwd，与原行为一致）。"""
    routine = _FakeRoutine(cwd=None, worktree_path=None)
    assert RoutineEvaluator._gate_cwd(routine) is None


def test_gate_cwd_missing_attr_defensive():
    """routine 对象缺失 worktree_path 属性（旧视图）时 getattr 兜底回退 cwd，不抛 AttributeError。"""

    @dataclass
    class _LegacyRoutine:
        cwd: str | None = "/legacy/root"

    assert RoutineEvaluator._gate_cwd(_LegacyRoutine()) == "/legacy/root"


# ---------------------------------------------------------------------------
# _run_gate 超时/异常退出码语义 + per-routine 超时覆盖 —— ISSUE-115 回归锁定
# 超时/异常须返回非零退出码（124/1），绝不返回 None——None 仅表示「未配置门控」，
# 否则 decision 的 `gate_exit_code in (None,0)` 会把超时误判为门控通过。
# ---------------------------------------------------------------------------


async def test_run_gate_timeout_returns_124_not_none():
    """门控超时返回 124（约定超时码），绝不 None。"""
    ev = RoutineEvaluator(gate_timeout_seconds=120)
    code, out = await ev._run_gate("sleep 3", None, timeout=1)
    assert code == 124, f"超时须返回 124，实际 {code}"
    assert code is not None
    assert "超时" in out


async def test_run_gate_per_routine_timeout_overrides_instance_default():
    """per-routine timeout 覆盖实例默认：传 timeout=1 应约 1s 超时（而非等实例默认 120s）。"""
    import time

    ev = RoutineEvaluator(gate_timeout_seconds=120)
    t0 = time.monotonic()
    code, _ = await ev._run_gate("sleep 5", None, timeout=1)
    elapsed = time.monotonic() - t0
    assert code == 124
    assert elapsed < 4, f"应用 timeout=1 在约 1s 超时，实际 {elapsed:.1f}s"


async def test_run_gate_passes_through_exit_code():
    """正常退出码原样透传（0 通过 / 非 0 失败）。"""
    ev = RoutineEvaluator()
    assert (await ev._run_gate("exit 0", None))[0] == 0
    assert (await ev._run_gate("exit 7", None))[0] == 7


# ---------------------------------------------------------------------------
# 验收未达成确定性评分封顶（acceptance_unmet_score_cap）—— ISSUE-116 回归锁定
# 把「未满足 Acceptance 即封顶」由 acceptance_criteria 散文规则提升为引擎机制，
# 不依赖小模型自觉；仅当 judge 明确 acceptance_met=False 且 cap>0 时生效。
# ---------------------------------------------------------------------------


def _parse_returns(monkeypatch, *, score, verdict, acceptance_met):
    """把 evaluator._judge 替换为返回固定 (score,verdict,reflection,raw,acceptance_met) 的桩。"""

    async def _stub(self, prompt, *, model_override=None):
        return score, verdict, "r", "{}", acceptance_met

    monkeypatch.setattr(RoutineEvaluator, "_judge", _stub)


@dataclass
class _EvalRoutine:
    goal: str = "g"
    acceptance_criteria: str = "ac"
    cwd: str | None = None
    worktree_path: str | None = None
    verification_command: str | None = None  # 无门控 → 评估只跑 judge
    gate_timeout_seconds: int | None = None
    acceptance_unmet_score_cap: int | None = None
    evaluator_model: str | None = None


@dataclass
class _EvalIter:
    exec_status: str | None = "success"
    summary: str | None = "done"
    exec_error: str | None = None


async def test_acceptance_unmet_caps_score_and_corrects_pass(monkeypatch):
    """acceptance_met=False 且 cap=50 时：越线分被封顶到 50，且 pass 纠正为 progressing。"""
    _parse_returns(monkeypatch, score=85, verdict="pass", acceptance_met=False)
    ev = RoutineEvaluator(acceptance_unmet_score_cap=50)
    res = await ev.evaluate(_EvalRoutine(), _EvalIter())
    assert res.ok and res.score == 50
    assert res.verdict == "progressing"  # 验收未达成绝不判 pass


async def test_acceptance_met_true_not_capped(monkeypatch):
    """acceptance_met=True 时不封顶（达标分原样保留）。"""
    _parse_returns(monkeypatch, score=95, verdict="pass", acceptance_met=True)
    ev = RoutineEvaluator(acceptance_unmet_score_cap=50)
    res = await ev.evaluate(_EvalRoutine(), _EvalIter())
    assert res.score == 95 and res.verdict == "pass"


async def test_acceptance_met_none_not_capped(monkeypatch):
    """acceptance_met 缺失(None，旧模型未遵循契约)时不封顶（向后兼容，不误伤）。"""
    _parse_returns(monkeypatch, score=85, verdict="progressing", acceptance_met=None)
    ev = RoutineEvaluator(acceptance_unmet_score_cap=50)
    res = await ev.evaluate(_EvalRoutine(), _EvalIter())
    assert res.score == 85


async def test_acceptance_cap_disabled_when_zero(monkeypatch):
    """cap=0（默认关闭）时即便 acceptance_met=False 也不封顶（退化原行为）。"""
    _parse_returns(monkeypatch, score=85, verdict="progressing", acceptance_met=False)
    ev = RoutineEvaluator(acceptance_unmet_score_cap=0)
    res = await ev.evaluate(_EvalRoutine(), _EvalIter())
    assert res.score == 85


async def test_acceptance_cap_per_routine_overrides_instance(monkeypatch):
    """per-routine config 的 cap 覆盖实例默认（实例 0 关闭，routine 设 50 生效）。"""
    _parse_returns(monkeypatch, score=85, verdict="pass", acceptance_met=False)
    ev = RoutineEvaluator(acceptance_unmet_score_cap=0)  # 实例默认关闭
    res = await ev.evaluate(_EvalRoutine(acceptance_unmet_score_cap=50), _EvalIter())
    assert res.score == 50 and res.verdict == "progressing"


# ---------------------------------------------------------------------------
# per-routine Judge 模型覆盖（config.evaluator_model）—— ISSUE-121 回归锁定
# 弱模型（gpt-5-nano）易误判 acceptance_met=true 触发过早不可逆 SUCCESS+PR；
# 高风险复刻类任务须能 per-routine 指定更强 Judge 模型。
# ---------------------------------------------------------------------------


async def test_evaluator_model_override_flows_to_judge(monkeypatch):
    """config.evaluator_model 经 evaluate → _judge → resolve_model_config 的 explicit_model。"""
    captured: dict = {}

    async def _capture_resolve(task_key, *, explicit_model=None):
        captured["explicit_model"] = explicit_model
        return "captured/model", {}

    # _judge 内部对 litellm.acompletion 与解析做桩，仅验证模型解析入参。
    async def _fake_acompletion(**kwargs):
        class _M:
            content = '{"acceptance_met": true, "score": 95, "verdict": "pass", "reflection": "ok"}'

        class _C:
            message = _M()

        class _R:
            choices = [_C()]

        return _R()

    import negentropy.engine.routine.evaluator as ev_mod

    monkeypatch.setattr(ev_mod, "resolve_model_config_async", _capture_resolve)
    monkeypatch.setattr(ev_mod.litellm, "acompletion", _fake_acompletion)

    ev = RoutineEvaluator(explicit_model="instance/default")
    res = await ev.evaluate(_EvalRoutine(evaluator_model="strong/judge-model"), _EvalIter())
    assert res.ok and res.score == 95
    assert captured["explicit_model"] == "strong/judge-model", "per-routine evaluator_model 应覆盖实例默认"


async def test_evaluator_model_falls_back_to_instance_default(monkeypatch):
    """未设 config.evaluator_model 时回退实例级 explicit_model（向后兼容）。"""
    captured: dict = {}

    async def _capture_resolve(task_key, *, explicit_model=None):
        captured["explicit_model"] = explicit_model
        return "captured/model", {}

    async def _fake_acompletion(**kwargs):
        class _M:
            content = '{"acceptance_met": false, "score": 40, "verdict": "progressing", "reflection": "wip"}'

        class _C:
            message = _M()

        class _R:
            choices = [_C()]

        return _R()

    import negentropy.engine.routine.evaluator as ev_mod

    monkeypatch.setattr(ev_mod, "resolve_model_config_async", _capture_resolve)
    monkeypatch.setattr(ev_mod.litellm, "acompletion", _fake_acompletion)

    ev = RoutineEvaluator(explicit_model="instance/default")
    await ev.evaluate(_EvalRoutine(evaluator_model=None), _EvalIter())
    assert captured["explicit_model"] == "instance/default"


# ---------------------------------------------------------------------------
# 子进程环境净化（剥离引擎 venv/uv 激活变量）—— ISSUE-120 回归锁定
# worktree 子进程（gate + CC）不应继承引擎自身的 VIRTUAL_ENV / UV_RUN_RECURSION_DEPTH。
# ---------------------------------------------------------------------------


def test_inherited_env_strips_engine_venv_vars(monkeypatch):
    """净化函数剥离引擎 venv/uv 激活变量，但保留无关变量。"""
    from negentropy.engine.utils.subprocess_env import inherited_env_without_engine_venv

    monkeypatch.setenv("VIRTUAL_ENV", "/engine/.venv")
    monkeypatch.setenv("VIRTUAL_ENV_PROMPT", "(engine)")
    monkeypatch.setenv("UV_RUN_RECURSION_DEPTH", "1")
    monkeypatch.setenv("PATH_UNRELATED_KEEP", "keepme")

    env = inherited_env_without_engine_venv()
    assert "VIRTUAL_ENV" not in env
    assert "VIRTUAL_ENV_PROMPT" not in env
    assert "UV_RUN_RECURSION_DEPTH" not in env
    assert env.get("PATH_UNRELATED_KEEP") == "keepme"  # 无关变量保留


async def test_run_gate_subprocess_does_not_inherit_engine_virtualenv(monkeypatch):
    """端到端：gate 子进程实际环境不含引擎 VIRTUAL_ENV（剥离生效，ISSUE-120）。"""
    monkeypatch.setenv("VIRTUAL_ENV", "/engine/.venv/SHOULD_NOT_LEAK")
    ev = RoutineEvaluator()
    # 门控命令打印 VIRTUAL_ENV：净化后应为空行。
    code, out = await ev._run_gate("printf '[%s]' \"$VIRTUAL_ENV\"", None)
    assert code == 0
    assert "SHOULD_NOT_LEAK" not in out
    assert "[]" in out, f"VIRTUAL_ENV 应被剥离为空，实际输出: {out!r}"
