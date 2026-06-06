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
