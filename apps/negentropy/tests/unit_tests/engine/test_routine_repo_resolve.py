"""Repository 有效配置解析 + 分支枚举单测 — 纯函数 + 真实 git（tmp_path），无 DB / 无网络。

覆盖：
- ``resolve_effective_repo``：指针优先 / 手填回退 / repository=None 安全降级。
- ``list_branches``：枚举本地分支（含额外分支），非法路径抛 WorkspaceError。
"""

from __future__ import annotations

import subprocess
from types import SimpleNamespace

import pytest

from negentropy.engine.routine import workspace as ws

pytestmark = pytest.mark.asyncio


def _settings(**kw):
    """轻量 RoutineSettings 替身（仅 list_branches 用到的字段）；默认关 fetch 保持 hermetic。"""
    base = dict(git_remote="origin", git_fetch_before_worktree=False, git_timeout_seconds=30)
    base.update(kw)
    return SimpleNamespace(**base)


def _make_git_repo(path, *, extra_branches: tuple[str, ...] = ()) -> str:
    """建含 main 分支与初始提交的 git 仓库，可选追加额外本地分支，返回路径字符串。"""
    p = str(path)
    subprocess.run(["git", "init", "-q", p], check=True)
    subprocess.run(["git", "-C", p, "config", "user.email", "t@t.io"], check=True)
    subprocess.run(["git", "-C", p, "config", "user.name", "t"], check=True)
    (path / "README.md").write_text("# repo\n")
    subprocess.run(["git", "-C", p, "add", "-A"], check=True)
    subprocess.run(["git", "-C", p, "commit", "-q", "-m", "init"], check=True)
    subprocess.run(["git", "-C", p, "branch", "-M", "main"], check=True)
    for b in extra_branches:
        subprocess.run(["git", "-C", p, "branch", b], check=True)
    return p


# ---------------------------------------------------------------------------
# resolve_effective_repo（纯函数：指针优先 / 手填回退）
# ---------------------------------------------------------------------------


def test_resolve_effective_repo_pointer_wins():
    """repository 非空 → 返回 Repository 的 local_path/baseline（即便 routine 手填了其它值）。"""
    routine = SimpleNamespace(cwd="/manual/path", baseline_branch="manual-branch")
    repository = SimpleNamespace(local_path="/repo/root", baseline_branch="origin/feature/1.x.x")
    assert ws.resolve_effective_repo(routine, repository) == ("/repo/root", "origin/feature/1.x.x")


def test_resolve_effective_repo_manual_fallback():
    """repository 为空（未关联）→ 回退手填 cwd/baseline。"""
    routine = SimpleNamespace(cwd="/manual/path", baseline_branch="main")
    assert ws.resolve_effective_repo(routine, None) == ("/manual/path", "main")


def test_resolve_effective_repo_none_repo_safe_when_manual_empty():
    """repository=None（已删/竞态）且手填亦空 → 返回 (None, None)，不抛。"""
    routine = SimpleNamespace(cwd=None, baseline_branch=None)
    assert ws.resolve_effective_repo(routine, None) == (None, None)


# ---------------------------------------------------------------------------
# list_branches（真实 git）
# ---------------------------------------------------------------------------


async def test_list_branches_enumerates_local(tmp_path):
    repo = _make_git_repo(tmp_path / "repo", extra_branches=("feature/x", "release/2.0"))
    result = await ws.list_branches(repo, _settings())
    local = set(result["local"])
    assert "main" in local
    assert "feature/x" in local
    assert "release/2.0" in local
    assert result["default_remote"] == "origin"
    # 无远端 → remote 为空（hermetic，无 origin）。
    assert result["remote"] == []


async def test_list_branches_rejects_non_repo(tmp_path):
    plain = tmp_path / "plain"
    plain.mkdir()
    with pytest.raises(ws.WorkspaceError):
        await ws.list_branches(str(plain), _settings())


async def test_list_branches_rejects_missing_path(tmp_path):
    with pytest.raises(ws.WorkspaceError):
        await ws.list_branches(str(tmp_path / "nope"), _settings())
    with pytest.raises(ws.WorkspaceError):
        await ws.list_branches(None, _settings())
