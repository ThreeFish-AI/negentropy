"""Routine 相位纯逻辑单测 — phase 助手、prompt 分支、审批门控（无 IO）。"""

from __future__ import annotations

from types import SimpleNamespace

from negentropy.engine.routine import phase as phase_mod
from negentropy.engine.routine.orchestrator import RoutineOrchestrator
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


def _routine(**kw):
    base = dict(
        goal="目标",
        acceptance_criteria="验收",
        reflections={},
        claude_session_id=None,
        current_phase="implement",
    )
    base.update(kw)
    return SimpleNamespace(**base)


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
