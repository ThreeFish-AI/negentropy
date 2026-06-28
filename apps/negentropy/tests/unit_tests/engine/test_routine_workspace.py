"""Routine 隔离 worktree 编排单测 — 真实 git（tmp_path 临时仓库），无 DB / 无网络。

覆盖：normalize_base_branch / _sanitize_ref 纯函数；validate_repo 正反例；
ensure_worktree 创建 + 幂等复用；remove_worktree 幂等回收。
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest

from negentropy.engine.routine import workspace as ws

pytestmark = pytest.mark.asyncio


def _head_branch(path: str) -> str:
    """worktree HEAD 所在分支名。"""
    return subprocess.run(
        ["git", "-C", path, "rev-parse", "--abbrev-ref", "HEAD"], capture_output=True, text=True, check=True
    ).stdout.strip()


def _local_branch_exists(repo: str, branch: str) -> bool:
    """仓库中本地分支 ``branch`` 是否存在。"""
    return (
        subprocess.run(
            ["git", "-C", repo, "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}"], capture_output=True
        ).returncode
        == 0
    )


def _routine_branches(repo: str) -> list[str]:
    """仓库中全部 ``routine/*`` 本地分支（短名，排序）。"""
    out = subprocess.run(
        ["git", "-C", repo, "branch", "--list", "routine/*", "--format=%(refname:short)"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.split()
    return sorted(out)


def _make_repo_with_remote(tmp_path) -> tuple[str, str]:
    """建带 bare origin 的仓库：返回 (work_repo, bare_remote)；work 已含 main 并 push 到 origin。"""
    bare = str(tmp_path / "origin.git")
    subprocess.run(["git", "init", "-q", "--bare", bare], check=True)
    work = _make_git_repo(tmp_path / "repo")
    subprocess.run(["git", "-C", work, "remote", "add", "origin", bare], check=True)
    subprocess.run(["git", "-C", work, "push", "-q", "-u", "origin", "main"], check=True)
    subprocess.run(["git", "-C", work, "fetch", "-q", "origin"], check=True)
    return work, bare


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


async def test_ensure_worktree_reanchors_when_head_drifted(tmp_path):
    """CC 在 worktree 内 ``git switch`` 漂离 work_branch → 下轮 ensure_worktree re-anchor 切回，
    **不移除/不重建目录**（未跟踪 marker 文件保留，证明非 stale_recreate）。维系单一 workspace。"""
    repo = _make_git_repo(tmp_path / "repo")
    s = _settings(str(tmp_path / "wt"))
    r = _routine(repo)
    info = await ws.ensure_worktree(r, s)
    r.worktree_path, r.work_branch = info.path, info.branch

    # 在 worktree 内留未跟踪 marker：re-anchor 保留；stale_recreate（remove+re-add）会丢。
    marker = Path(info.path) / "marker.txt"
    marker.write_text("persist")
    # CC 漂移：切到一条新分支
    subprocess.run(["git", "-C", info.path, "checkout", "-b", "stray"], check=True, capture_output=True)
    assert _head_branch(info.path) == "stray"

    info2 = await ws.ensure_worktree(r, s)
    assert (info2.path, info2.branch) == (info.path, info.branch)  # 同一 workspace
    assert _head_branch(info.path) == info.branch  # HEAD 已 re-anchor 回 work_branch
    assert marker.exists() and marker.read_text() == "persist"  # 目录未重建


async def test_ensure_worktree_reanchors_detached_head(tmp_path):
    """CC 漂移到 detached HEAD（``git checkout --detach``）→ re-anchor 切回 work_branch。"""
    repo = _make_git_repo(tmp_path / "repo")
    s = _settings(str(tmp_path / "wt"))
    r = _routine(repo)
    info = await ws.ensure_worktree(r, s)
    r.worktree_path, r.work_branch = info.path, info.branch

    subprocess.run(["git", "-C", info.path, "checkout", "--detach"], check=True, capture_output=True)
    assert _head_branch(info.path) == "HEAD"  # detached

    info2 = await ws.ensure_worktree(r, s)
    assert (info2.path, info2.branch) == (info.path, info.branch)
    assert _head_branch(info.path) == info.branch


async def test_ensure_worktree_reanchors_with_dirty_worktree(tmp_path):
    """漂移 + 脏工作树 → re-anchor 兜底切回 work_branch（clean-carry 或 stash），工作树改动不阻断。"""
    repo = _make_git_repo(tmp_path / "repo")
    s = _settings(str(tmp_path / "wt"))
    r = _routine(repo)
    info = await ws.ensure_worktree(r, s)
    r.worktree_path, r.work_branch = info.path, info.branch

    # 脏工作树（改已跟踪文件）+ 漂移到新分支
    (Path(info.path) / "README.md").write_text("# changed")
    subprocess.run(["git", "-C", info.path, "checkout", "-b", "stray"], check=True, capture_output=True)

    info2 = await ws.ensure_worktree(r, s)
    assert (info2.path, info2.branch) == (info.path, info.branch)
    assert _head_branch(info.path) == info.branch  # 无论 clean-carry 还是 stash，HEAD 已回 work_branch


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


# ---------------------------------------------------------------------------
# checkpoint_commit —— ISSUE-114 引擎确定性 auto-commit 回归锁定
# ---------------------------------------------------------------------------


async def test_checkpoint_commit_commits_changes(tmp_path):
    """有改动时确定性提交并返回 True；提交后工作树干净、HEAD 前进一个提交。"""
    repo = _make_git_repo(tmp_path / "repo")
    s = _settings(str(tmp_path / "wt"))
    # 在 worktree（此处直接用 repo 根模拟隔离工作区）写入改动
    (tmp_path / "repo" / "new_file.py").write_text("print('hi')\n")
    before = subprocess.run(
        ["git", "-C", repo, "rev-list", "--count", "HEAD"], capture_output=True, text=True, check=True
    ).stdout.strip()

    committed = await ws.checkpoint_commit(repo, s, seq=3)
    assert committed is True
    # 工作树应干净（全部已提交）
    status = subprocess.run(["git", "-C", repo, "status", "--porcelain"], capture_output=True, text=True).stdout
    assert status.strip() == ""
    after = subprocess.run(
        ["git", "-C", repo, "rev-list", "--count", "HEAD"], capture_output=True, text=True, check=True
    ).stdout.strip()
    assert int(after) == int(before) + 1
    # commit message 含 seq
    msg = subprocess.run(["git", "-C", repo, "log", "-1", "--pretty=%B"], capture_output=True, text=True).stdout
    assert "seq=3" in msg


async def test_checkpoint_commit_noop_when_clean(tmp_path):
    """无改动时跳过提交、返回 False，HEAD 不前进。"""
    repo = _make_git_repo(tmp_path / "repo")
    s = _settings(str(tmp_path / "wt"))
    before = subprocess.run(
        ["git", "-C", repo, "rev-list", "--count", "HEAD"], capture_output=True, text=True, check=True
    ).stdout.strip()
    committed = await ws.checkpoint_commit(repo, s, seq=1)
    assert committed is False
    after = subprocess.run(
        ["git", "-C", repo, "rev-list", "--count", "HEAD"], capture_output=True, text=True, check=True
    ).stdout.strip()
    assert after == before


async def test_checkpoint_commit_missing_path_returns_false(tmp_path):
    """worktree 路径不存在 → 安全返回 False，不抛。"""
    s = _settings(str(tmp_path / "wt"))
    assert await ws.checkpoint_commit(str(tmp_path / "nonexistent"), s, seq=1) is False


# ---------------------------------------------------------------------------
# 单一分支不变量 —— 跨重启/崩溃终生一个工作分支（确定性命名 + 分支感知重绑）
# ---------------------------------------------------------------------------


def test_stable_work_branch_is_id_derived():
    """确定性命名：``routine/<sanitize(key)>-<id8>``，由不可变 id 派生（可复算、自愈）。"""
    rid = uuid4()
    r = SimpleNamespace(id=rid, key="My Key!")
    assert ws._stable_work_branch(r) == f"routine/My-Key-{rid.hex[:8]}"
    assert ws._stable_slug(r) == f"My-Key-{rid.hex[:8]}"


async def test_ensure_worktree_branch_name_is_stable_id_suffixed(tmp_path):
    """新建 routine 的工作分支/路径后缀取 ``id8``（替代旧时间戳，确定性可复算）。"""
    repo = _make_git_repo(tmp_path / "repo")
    s = _settings(str(tmp_path / "wt"))
    r = _routine(repo)
    info = await ws.ensure_worktree(r, s)
    assert info.branch == f"routine/demo_routine-{r.id.hex[:8]}"
    assert info.path.endswith(f"demo_routine-{r.id.hex[:8]}")


async def test_ensure_worktree_rebinds_same_branch_after_dir_deleted(tmp_path):
    """worktree 目录被外部删除（留残注册）+ 句柄按重启清空 worktree_path → 重绑**同名**分支，绝不铸新。"""
    repo = _make_git_repo(tmp_path / "repo")
    s = _settings(str(tmp_path / "wt"))
    r = _routine(repo)
    info = await ws.ensure_worktree(r, s)
    r.worktree_path, r.work_branch = info.path, info.branch

    shutil.rmtree(info.path)  # 删目录、留残 worktree 注册（崩溃场景）
    r.worktree_path = None  # 模拟重启：清 worktree_path、保 work_branch

    info2 = await ws.ensure_worktree(r, s)
    assert info2.branch == info.branch  # 同一分支名
    assert os.path.isdir(info2.path)
    assert _head_branch(info2.path) == info.branch
    assert _routine_branches(repo) == [info.branch]  # 仓库中只有这一个工作分支


async def test_ensure_worktree_resumes_checkpoint_commits_after_restart(tmp_path):
    """重启（keep_branch=True 回收目录、保分支+提交）后重绑 → 上一检查点产物存活（从检查点续作）。"""
    repo = _make_git_repo(tmp_path / "repo")
    s = _settings(str(tmp_path / "wt"))
    r = _routine(repo)
    info = await ws.ensure_worktree(r, s)
    r.worktree_path, r.work_branch = info.path, info.branch

    (Path(info.path) / "progress.py").write_text("done = True\n")
    assert await ws.checkpoint_commit(info.path, s, seq=1) is True

    await ws.remove_worktree(r, s, keep_branch=True)  # 回收目录、保留本地分支与提交
    r.worktree_path = None  # 模拟重启：保 work_branch

    info2 = await ws.ensure_worktree(r, s)
    assert info2.branch == info.branch
    assert (Path(info2.path) / "progress.py").exists()  # 检查点提交在重建 worktree 中续作


async def test_ensure_worktree_recovers_from_origin_when_local_branch_deleted(tmp_path):
    """本地分支被清理（默认 keep_branch=False）但已 push 到 origin → 从 ``origin/<b>`` 恢复同名分支与提交。"""
    repo, _bare = _make_repo_with_remote(tmp_path)
    s = _settings(str(tmp_path / "wt"))
    r = _routine(repo)
    info = await ws.ensure_worktree(r, s)
    r.worktree_path, r.work_branch = info.path, info.branch

    (Path(info.path) / "feat.py").write_text("x = 1\n")
    assert await ws.checkpoint_commit(info.path, s, seq=1) is True
    subprocess.run(["git", "-C", info.path, "push", "-q", "-u", "origin", info.branch], check=True)

    await ws.remove_worktree(r, s)  # 默认删本地分支
    r.worktree_path = None
    assert _local_branch_exists(repo, info.branch) is False  # 本地分支已删

    info2 = await ws.ensure_worktree(r, s)
    assert info2.branch == info.branch  # 同名恢复
    assert (Path(info2.path) / "feat.py").exists()  # 提交从 origin 恢复
    upstream = subprocess.run(
        ["git", "-C", info2.path, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
        capture_output=True,
        text=True,
    ).stdout.strip()
    assert upstream == f"origin/{info.branch}"  # 跟踪 origin/<b>


async def test_ensure_worktree_falls_back_to_baseline_when_no_local_no_remote(tmp_path):
    """已有 work_branch 句柄但本地/远端皆无该分支 → 从 baseline 重建**同名**分支（首次/无可恢复提交）。"""
    repo = _make_git_repo(tmp_path / "repo")
    s = _settings(str(tmp_path / "wt"))
    r = _routine(repo, work_branch="routine/demo_routine-deadbeef")
    info = await ws.ensure_worktree(r, s)
    assert info.branch == "routine/demo_routine-deadbeef"  # 保留同名
    head = subprocess.run(["git", "-C", info.path, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    main = subprocess.run(["git", "-C", repo, "rev-parse", "main"], capture_output=True, text=True).stdout.strip()
    assert head == main  # 从基线 tip 派生


async def test_ensure_worktree_clears_stale_dir_at_target_path(tmp_path):
    """确定性目标路径上存在非空残留目录 → 先清理再 add，不报 ``already exists``。"""
    repo = _make_git_repo(tmp_path / "repo")
    root = str(tmp_path / "wt")
    s = _settings(root)
    r = _routine(repo)
    os.makedirs(root, exist_ok=True)
    stale = os.path.join(root, f"demo_routine-{r.id.hex[:8]}")
    os.makedirs(stale, exist_ok=True)
    (Path(stale) / "junk.txt").write_text("junk\n")

    info = await ws.ensure_worktree(r, s)
    assert info.path == stale  # 用确定性路径
    assert _head_branch(info.path) == info.branch  # 残留清理后成功重绑


async def test_ensure_worktree_keeps_legacy_timestamped_branch(tmp_path):
    """存量时间戳分支名（migration 前）原样保留、不改名、不误删活动目录（向后兼容）。"""
    repo = _make_git_repo(tmp_path / "repo")
    root = str(tmp_path / "wt")
    s = _settings(root)
    os.makedirs(root, exist_ok=True)
    legacy_branch = "routine/demo_routine-20240101000000"
    legacy_path = os.path.join(root, "demo_routine-20240101000000")
    subprocess.run(["git", "-C", repo, "worktree", "add", "-b", legacy_branch, legacy_path, "main"], check=True)

    r = _routine(repo, work_branch=legacy_branch, worktree_path=legacy_path)
    info = await ws.ensure_worktree(r, s)
    assert info.branch == legacy_branch  # 不改名为 id8
    assert info.path == legacy_path
    assert os.path.isdir(legacy_path)  # 既有有效 worktree 被复用而非删除


async def test_restart_preserves_single_branch_identity(tmp_path):
    """**头号不变量**：跨一次「重启」（keep_branch=True 回收 + 清 worktree_path、保 work_branch）两次
    ensure 必产**同一分支名**，且仓库始终只有一个 ``routine/*`` 工作分支。"""
    repo = _make_git_repo(tmp_path / "repo")
    s = _settings(str(tmp_path / "wt"))
    r = _routine(repo)

    info1 = await ws.ensure_worktree(r, s)
    r.worktree_path, r.work_branch = info1.path, info1.branch

    # 复刻 restart 端点行为：保 work_branch、仅清 worktree 目录与 worktree_path 句柄。
    await ws.remove_worktree(r, s, keep_branch=True)
    r.worktree_path = None

    info2 = await ws.ensure_worktree(r, s)
    assert info2.branch == info1.branch
    assert _routine_branches(repo) == [info1.branch]  # 终生唯一工作分支


async def test_remove_worktree_keep_branch_preserves_local_branch(tmp_path):
    """keep_branch=True：回收 worktree 目录但保留本地工作分支（供续作/审计）。"""
    repo = _make_git_repo(tmp_path / "repo")
    s = _settings(str(tmp_path / "wt"))
    r = _routine(repo)
    info = await ws.ensure_worktree(r, s)
    r.worktree_path, r.work_branch = info.path, info.branch

    await ws.remove_worktree(r, s, keep_branch=True)
    assert not os.path.isdir(info.path)
    assert _local_branch_exists(repo, info.branch) is True  # 本地分支保留


async def test_remove_worktree_default_deletes_local_branch(tmp_path):
    """默认 keep_branch=False：回收 worktree 目录并删除本地分支（origin 同名分支保留供 PR，回归锁定）。"""
    repo = _make_git_repo(tmp_path / "repo")
    s = _settings(str(tmp_path / "wt"))
    r = _routine(repo)
    info = await ws.ensure_worktree(r, s)
    r.worktree_path, r.work_branch = info.path, info.branch

    await ws.remove_worktree(r, s)
    assert not os.path.isdir(info.path)
    assert _local_branch_exists(repo, info.branch) is False  # 本地分支已删
