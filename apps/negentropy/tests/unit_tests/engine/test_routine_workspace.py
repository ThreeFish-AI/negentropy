"""Routine 隔离 worktree 编排单测 — 真实 git（tmp_path 临时仓库），无 DB / 无网络。

覆盖：normalize_base_branch / _sanitize_ref 纯函数；validate_repo 正反例；
ensure_worktree 创建 + 幂等复用；remove_worktree 幂等回收。
"""

from __future__ import annotations

import subprocess
from types import SimpleNamespace
from uuid import uuid4

import pytest

from negentropy.engine.routine import workspace as ws

pytestmark = pytest.mark.asyncio


def _settings(worktree_root: str, **kw):
    """轻量 RoutineSettings 替身（仅含 workspace 用到的字段）；默认关 fetch 保持 hermetic。"""
    base = dict(
        git_remote="origin",
        git_fetch_before_worktree=False,
        git_timeout_seconds=30,
        worktree_root=worktree_root,
        worktree_cleanup="on_success",
    )
    base.update(kw)
    return SimpleNamespace(**base)


def _make_git_repo(path) -> str:
    """在 path 下建一个含 main 分支与初始提交的 git 仓库，返回其路径字符串。"""
    p = str(path)
    subprocess.run(["git", "init", "-q", p], check=True)
    subprocess.run(["git", "-C", p, "config", "user.email", "t@t.io"], check=True)
    subprocess.run(["git", "-C", p, "config", "user.name", "t"], check=True)
    (path / "README.md").write_text("# repo\n")
    subprocess.run(["git", "-C", p, "add", "-A"], check=True)
    subprocess.run(["git", "-C", p, "commit", "-q", "-m", "init"], check=True)
    subprocess.run(["git", "-C", p, "branch", "-M", "main"], check=True)
    return p


def _routine(repo: str, **kw):
    base = dict(
        id=uuid4(),
        key="demo_routine",
        cwd=repo,
        baseline_branch="main",
        work_branch=None,
        worktree_path=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


# ---------------------------------------------------------------------------
# 纯函数
# ---------------------------------------------------------------------------


def test_normalize_base_branch_strips_remote_prefix():
    assert ws.normalize_base_branch("origin/feature/1.x.x", "origin") == "feature/1.x.x"
    assert ws.normalize_base_branch("feature/1.x.x", "origin") == "feature/1.x.x"  # 无前缀原样
    assert ws.normalize_base_branch("upstream/main", "origin") == "upstream/main"  # 非该远端不剥


def test_sanitize_ref():
    assert ws._sanitize_ref("My Key!") == "My-Key"
    assert ws._sanitize_ref("a//b__c") == "a-b__c"
    assert ws._sanitize_ref("--weird..") == "weird"
    assert ws._sanitize_ref("") == "routine"


# ---------------------------------------------------------------------------
# validate_repo
# ---------------------------------------------------------------------------


async def test_validate_repo_ok(tmp_path):
    repo = _make_git_repo(tmp_path / "repo")
    await ws.validate_repo(repo, "main", _settings(str(tmp_path / "wt")))  # 不抛即通过


async def test_validate_repo_missing_inputs(tmp_path):
    s = _settings(str(tmp_path / "wt"))
    repo = _make_git_repo(tmp_path / "repo")
    with pytest.raises(ws.WorkspaceError):
        await ws.validate_repo(None, "main", s)  # 缺 cwd
    with pytest.raises(ws.WorkspaceError):
        await ws.validate_repo(repo, None, s)  # 缺 baseline


async def test_validate_repo_not_a_git_worktree(tmp_path):
    plain = tmp_path / "plain"
    plain.mkdir()
    with pytest.raises(ws.WorkspaceError):
        await ws.validate_repo(str(plain), "main", _settings(str(tmp_path / "wt")))


async def test_validate_repo_unresolvable_baseline(tmp_path):
    repo = _make_git_repo(tmp_path / "repo")
    with pytest.raises(ws.WorkspaceError):
        await ws.validate_repo(repo, "nope/does-not-exist", _settings(str(tmp_path / "wt")))


# ---------------------------------------------------------------------------
# ensure_worktree / remove_worktree
# ---------------------------------------------------------------------------


async def test_ensure_worktree_creates_then_reuses(tmp_path):
    repo = _make_git_repo(tmp_path / "repo")
    s = _settings(str(tmp_path / "wt"))
    r = _routine(repo)

    info = await ws.ensure_worktree(r, s)
    import os

    assert os.path.isdir(info.path)
    assert info.branch.startswith("routine/demo_routine-")
    # worktree HEAD 在工作分支
    head = subprocess.run(
        ["git", "-C", info.path, "rev-parse", "--abbrev-ref", "HEAD"], capture_output=True, text=True, check=True
    ).stdout.strip()
    assert head == info.branch

    # 幂等复用：携带上轮句柄再调 → 返回同一 path/branch，不新建
    r.worktree_path, r.work_branch = info.path, info.branch
    info2 = await ws.ensure_worktree(r, s)
    assert (info2.path, info2.branch) == (info.path, info.branch)


async def test_remove_worktree_idempotent(tmp_path):
    import os

    repo = _make_git_repo(tmp_path / "repo")
    s = _settings(str(tmp_path / "wt"))
    r = _routine(repo)
    info = await ws.ensure_worktree(r, s)
    r.worktree_path, r.work_branch = info.path, info.branch

    await ws.remove_worktree(r, s)
    assert not os.path.isdir(info.path)
    # 再次移除：no-op，不抛
    await ws.remove_worktree(r, s)
