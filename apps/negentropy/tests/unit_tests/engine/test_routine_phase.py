"""Routine 相位纯逻辑单测 — phase 助手、prompt 分支、审批门控（无 IO）。"""

from __future__ import annotations

from types import SimpleNamespace

from negentropy.engine.routine import phase as phase_mod
from negentropy.engine.routine.orchestrator import (
    RoutineOrchestrator,
    _build_readonly_settings,
    _build_scope_system_prompt,
    _normalize_read_dirs,
)
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


def test_build_prompt_worktree_implement_injects_checkpoint_commit():
    """worktree IMPLEMENT 相位注入迭代检查点提交指令（git add -A && git commit，仅提交不推送）。"""
    for ph in ("implement",):
        p = build_prompt(_wt_routine(current_phase=ph))
        assert "迭代检查点" in p
        assert "git add -A" in p and "git commit" in p
        assert "切勿" in p and "push" in p  # 明确禁止推送（推送属 FINALIZE）


def test_build_prompt_worktree_checkpoint_only_in_implement():
    """检查点提交仅在 IMPLEMENT：PLAN（只读）与 FINALIZE（自带 commit+push）不重复注入。"""
    assert "迭代检查点" not in build_prompt(_wt_routine(current_phase="plan"))
    assert "迭代检查点" not in build_prompt(_wt_routine(current_phase="finalize"))


def test_build_prompt_flat_implement_no_checkpoint():
    """扁平 routine（无 baseline/worktree）IMPLEMENT 不注入检查点提交（仅 worktree 适用）。"""
    assert "迭代检查点" not in build_prompt(_routine(current_phase="implement"))


def test_build_prompt_unified_plan_stage():
    """统一闭环 plan 段（stage=plan，覆盖 current_phase）：仅产出方案、禁写盘；允许 ExitPlanMode
    或 AskUserQuestion 提交评审（二者均被钩子真实评审）；批准后结束本轮、引擎同迭代续接实施。"""
    # current_phase=implement 的 worktree routine，显式以 stage=plan 取 plan 段 prompt
    p = build_prompt(_wt_routine(current_phase="implement"), stage="plan")
    assert "仅产出实现方案" in p and "禁止写入" in p
    assert "ExitPlanMode" in p and "AskUserQuestion" in p  # 两个提交工具均提及
    assert "结束本轮" in p and "续接" in p  # 批准后结束本轮、引擎续接实施
    assert "迭代检查点" not in p  # plan 段不提交（checkpoint 仅 implement）


def test_build_prompt_legacy_plan_phase_asks_only():
    """legacy（不传 stage、current_phase=plan）：仅指示 AskUserQuestion 提交（ExitPlanMode 自动放行不评审）。"""
    p = build_prompt(_wt_routine(current_phase="plan"))
    assert "AskUserQuestion" in p
    assert "仅产出实现方案" in p


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


def test_build_prompt_worktree_scope_excludes_source_cwd():
    """Worktree 作用域限制绝不包含源项目路径（worktree 包含完整检出）。"""
    p = build_prompt(_wt_routine(cwd="/path/to/my-source"))
    assert "/path/to/my-source" not in p


def test_build_prompt_worktree_scope_prohibits_source_project():
    """Worktree prompt 明确禁止读取源项目目录。"""
    p = build_prompt(_wt_routine(cwd="/path/to/my-source"))
    assert "源项目目录" in p  # 出现在禁止列表中
    assert "无需引用源项目" in p


def test_build_scope_system_prompt_worktree():
    """Worktree routine system prompt 禁止读取源项目目录。"""
    r = _wt_routine(
        cwd="/Users/cm.huang/Documents/projects/aurelius/data-la-maps",
        worktree_path="/Users/cm.huang/Documents/projects/aurelius/.negentropy-worktrees/demo",
    )
    sp = _build_scope_system_prompt(r)
    assert "File System Scope" in sp
    assert "isolated worktree" in sp
    assert "data-la-maps" not in sp  # 源项目路径绝不在 scope 指令中
    assert "MUST NOT" in sp
    # 无 read_dirs 时回退旧契约：仅 goal 显式引用的绝对路径可读，其余一律禁止
    assert "Absolute paths explicitly referenced in the task goal" in sp
    assert "Baseline branch" in sp  # 提及基线分支名


def test_build_scope_system_prompt_worktree_grants_readonly_read_dirs():
    """配置 config.read_dirs 后，scope prompt 显式枚举授予的只读源目录并标 READ-ONLY。"""
    src = "/Users/cm.huang/conductor/workspaces/platform-maps/jerusalem-v3"
    r = _wt_routine(
        cwd="/Users/cm.huang/Documents/projects/aurelius/data-la-maps",
        worktree_path="/Users/cm.huang/Documents/projects/aurelius/.negentropy-worktrees/demo",
        config={"read_dirs": [src]},
    )
    sp = _build_scope_system_prompt(r)
    assert src in sp  # 授予目录被显式列出（物理 --add-dir 与 prompt 一致）
    assert "READ-ONLY" in sp
    assert "MUST NOT write/edit here" in sp
    assert "ONLY inside the worktree" in sp  # 写范围限定 worktree


def test_build_scope_system_prompt_worktree_no_config_attr_safe():
    """routine 无 config 属性时不抛 AttributeError（SimpleNamespace 替身鲁棒性）。"""
    r = _wt_routine()  # 不含 config
    sp = _build_scope_system_prompt(r)  # 不应抛异常
    assert "File System Scope" in sp


def test_build_prompt_worktree_never_leaks_source_cwd():
    """回归测试：worktree prompt 绝不泄露 routine.cwd 路径（隔离保证）。"""
    r = _wt_routine(cwd="/secret/source/project")
    p = build_prompt(r)
    sp = _build_scope_system_prompt(r)
    # 两个 prompt 层都不得泄露源项目路径
    assert "/secret/source/project" not in p
    assert "/secret/source/project" not in sp


def test_normalize_read_dirs_dedups_absolutizes_and_filters():
    """规整：绝对化 + 展开 ~ + 去重 + 丢弃非字符串/空串；非 list/str 入参返回空。"""
    import os

    home_a = os.path.abspath(os.path.expanduser("~/a"))
    assert _normalize_read_dirs(["~/a", os.path.expanduser("~/a"), "  ", None, 123]) == [home_a]
    assert _normalize_read_dirs("/x") == ["/x"]  # 单字符串容忍
    assert _normalize_read_dirs(None) == []
    assert _normalize_read_dirs({"k": "v"}) == []  # 非 list/str → 空


def test_build_readonly_settings_denies_edit_with_absolute_anchor():
    """只读 settings：每个目录生成 Edit(//<abs>/**) deny，且无 allow 削弱。"""
    import json

    s = _build_readonly_settings(["/Users/x/src", "/opt/go"])
    parsed = json.loads(s)
    deny = parsed["permissions"]["deny"]
    assert "Edit(//Users/x/src/**)" in deny
    assert "Edit(//opt/go/**)" in deny
    assert "allow" not in parsed["permissions"]  # 绝不放行


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
