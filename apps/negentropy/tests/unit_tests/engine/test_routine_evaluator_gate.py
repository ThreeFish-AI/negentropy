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
