"""Routine 相位纯逻辑单测 — phase 助手、prompt 分支、审批门控（无 IO）。"""

from __future__ import annotations

from types import SimpleNamespace

from negentropy.engine.routine import phase as phase_mod
from negentropy.engine.routine.orchestrator import RoutineOrchestrator, _build_scope_system_prompt
from negentropy.engine.routine.prompt_builder import build_prompt


def test_initial_phase_phased_vs_flat():
    assert phase_mod.initial_phase({"workflow": "phased"}) == phase_mod.PHASE_PLAN
    assert phase_mod.initial_phase({}) == phase_mod.PHASE_IMPLEMENT
    assert phase_mod.initial_phase(None) == phase_mod.PHASE_IMPLEMENT


def test_permission_mode_for_phase():
    assert phase_mod.permission_mode_for(phase_mod.PHASE_PLAN) == "plan"
    assert phase_mod.permission_mode_for(phase_mod.PHASE_IMPLEMENT) == "acceptEdits"
    assert phase_mod.permission_mode_for(phase_mod.PHASE_FINALIZE) == "acceptEdits"


def test_extract_pr_url_sentinel_and_fallback():
    assert phase_mod.extract_pr_url("PR_URL=https://github.com/o/r/pull/9") == "https://github.com/o/r/pull/9"
    # 句末标点应被剥除
    assert phase_mod.extract_pr_url("done. PR_URL=https://github.com/o/r/pull/9.") == "https://github.com/o/r/pull/9"
    # 裸链接兜底
    assert phase_mod.extract_pr_url("opened https://github.com/o/r/pull/12 ✅") == "https://github.com/o/r/pull/12"
    assert phase_mod.extract_pr_url("no link") is None
    assert phase_mod.extract_pr_url(None) is None
    # 非 URL 值（缺少 https://）不应被 sentinel 捕获
    assert phase_mod.extract_pr_url("PR_URL=not-a-url") is None


def _routine(**kw):
    base = dict(
        goal="目标",
        acceptance_criteria="验收",
        reflections={},
        claude_session_id=None,
        current_phase="implement",
        cwd="/tmp/test-project",
    )
    base.update(kw)
    return SimpleNamespace(**base)


def _wt_routine(**kw):
    """worktree routine 替身（含 baseline_branch / work_branch）。"""
    base = dict(
        goal="目标",
        acceptance_criteria="验收",
        reflections={},
        claude_session_id=None,
        current_phase="implement",
        baseline_branch="origin/feature/1.x.x",
        work_branch="routine/demo-20260601",
        cwd="/path/to/source-project",
        worktree_path="/path/to/.negentropy-worktrees/demo-20260601",
    )
    base.update(kw)
    return SimpleNamespace(**base)


def test_is_worktree_routine():
    assert phase_mod.is_worktree_routine(_wt_routine()) is True
    assert phase_mod.is_worktree_routine(_routine()) is False  # 无 baseline_branch 属性
    assert phase_mod.is_worktree_routine(SimpleNamespace(baseline_branch=None)) is False
    assert phase_mod.is_worktree_routine(SimpleNamespace(baseline_branch="")) is False


def test_build_prompt_worktree_header_present_all_phases():
    for ph in ("implement", "finalize"):
        p = build_prompt(_wt_routine(current_phase=ph))
        assert "隔离工作区" in p
        assert "routine/demo-20260601" in p  # 工作分支
        assert "绝不" in p  # 禁止污染基线/master 的红线


def test_build_prompt_worktree_finalize_injects_concrete_branches():
    p = build_prompt(_wt_routine(current_phase="finalize"))
    # 引擎确定性注入：push 工作分支 + gh pr create --base <归一基线> --head <工作分支>
    assert "git push -u origin routine/demo-20260601" in p
    assert "--base feature/1.x.x" in p  # origin/ 前缀已剥离
    assert "--head routine/demo-20260601" in p
    assert "PR_URL=" in p
    assert "合并" in p  # 提示人工合并


def test_build_prompt_flat_finalize_unchanged_when_no_baseline():
    """旧扁平 routine（无 baseline）保留泛化收尾文案，不注入具体 push/--head。"""
    p = build_prompt(_routine(current_phase="finalize"))
    assert "gh pr create" in p
    assert "git push -u origin" not in p
    assert "隔离工作区" not in p


def test_build_prompt_plan_phase_forbids_writes():
    p = build_prompt(_routine(current_phase="plan"))
    assert "仅产出实现方案" in p or "Plan ONLY" in p
    assert "禁止写入" in p


def test_build_prompt_finalize_phase_creates_pr():
    p = build_prompt(_routine(current_phase="finalize"))
    assert "gh pr create" in p
    assert "PR_URL=" in p
    assert "合并" in p  # 提示人工合并


def test_build_prompt_implement_phase_matches_legacy_start_continue():
    start = build_prompt(_routine(current_phase="implement", claude_session_id=None))
    cont = build_prompt(_routine(current_phase="implement", claude_session_id="sess-1"))
    assert "# 开始" in start
    assert "# 继续" in cont


def test_needs_approval_phased_gates_first_implement_only():
    na = RoutineOrchestrator._needs_approval
    # PLAN 相位不门控（先产出计划）
    assert na("first", phased=True, phase="plan", has_prior_implement=False, seq=1) is False
    # 首个 IMPLEMENT 迭代门控
    assert na("first", phased=True, phase="implement", has_prior_implement=False, seq=2) is True
    # 已有 implement 迭代后不再门控
    assert na("first", phased=True, phase="implement", has_prior_implement=True, seq=3) is False
    # FINALIZE 不因 first 门控
    assert na("first", phased=True, phase="finalize", has_prior_implement=True, seq=4) is False
    # every 恒门控
    assert na("every", phased=True, phase="plan", has_prior_implement=False, seq=1) is True
    # auto 从不门控
    assert na("auto", phased=True, phase="implement", has_prior_implement=False, seq=2) is False


def test_needs_approval_flat_preserves_seq1_semantics():
    na = RoutineOrchestrator._needs_approval
    assert na("first", phased=False, phase="implement", has_prior_implement=False, seq=1) is True
    assert na("first", phased=False, phase="implement", has_prior_implement=False, seq=2) is False


# ── 作用域限制 (Scope Constraints) 测试 ──


def test_build_prompt_worktree_has_scope_constraints():
    """Worktree routine prompt 包含读取范围限制。"""
    p = build_prompt(_wt_routine())
    assert "作用域限制" in p
    assert "读取范围" in p
    assert "绝不" in p
    assert "兄弟目录" in p


def test_build_prompt_worktree_scope_includes_source_cwd():
    """有 cwd 时 worktree 作用域限制包含源项目路径。"""
    p = build_prompt(_wt_routine(cwd="/path/to/my-source"))
    assert "源项目目录" in p
    assert "/path/to/my-source" in p


def test_build_prompt_worktree_scope_without_cwd():
    """无 cwd 时 worktree 作用域限制不含源项目行。"""
    p = build_prompt(_wt_routine(cwd=""))
    assert "源项目目录" not in p


def test_build_scope_system_prompt_worktree():
    """worktree routine 的 system prompt 作用域限制。"""
    r = _wt_routine(
        cwd="/Users/cm.huang/Documents/projects/aurelius/data-la-maps",
        worktree_path="/Users/cm.huang/Documents/projects/aurelius/.negentropy-worktrees/demo",
    )
    sp = _build_scope_system_prompt(r)
    assert "File System Scope" in sp
    assert "isolated worktree" in sp
    assert "source project" in sp
    assert "data-la-maps" in sp
    assert "MUST NOT" in sp


def test_build_scope_system_prompt_flat_routine():
    """非 worktree routine 的 system prompt 作用域限制。"""
    r = _routine(cwd="/tmp/my-project")
    sp = _build_scope_system_prompt(r)
    assert "File System Scope" in sp
    assert "my-project" in sp
    assert "MUST NOT" in sp


def test_build_scope_system_prompt_no_cwd():
    """无 cwd 时不注入作用域限制（向后兼容）。"""
    r = _routine(cwd=None)
    sp = _build_scope_system_prompt(r)
    assert sp == ""
