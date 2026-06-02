"""Routine 隔离工作区 — 基于基线分支的 git worktree 生命周期编排（确定性机制）。

定位（机制/策略分离）：
    worktree + 工作分支的创建/复用/销毁是**确定性机制**，由引擎独占，绝不交给 LLM。
    Claude Code（Executor）仅在引擎备好的隔离 worktree 内执行改代码/提交/push/建 PR。

为何隔离：
    Routine 此前直接在 ``cwd`` 的当前 checkout 上工作——可能污染用户分支（甚至 master/main），
    且缺乏标准化交付流水线。本模块让每个 worktree routine 基于用户指定的 ``baseline_branch``
    （如 ``origin/feature/1.x.x``）在隔离 worktree 中工作，完成后由 CC 以 PR 回基线。

实现取舍：
    - 纯 git/FS 编排，**无 DB**：运行期状态（worktree_path / work_branch）的持久化由 orchestrator
      在其事务内完成；本模块仅做 git 子命令与文件系统操作并回带结果。
    - 子进程范式镜像 ``evaluator._run_gate``：``create_subprocess_exec`` + 独立进程组 + 超时整组
      SIGKILL，避免 git 子进程在超时被杀后变孤儿。
    - 幂等：``ensure_worktree`` 复用既有有效 worktree；``remove_worktree`` best-effort 幂等。
    - 进程内按 ``routine_id`` 串行化（``asyncio.Lock``）兜底并发 ensure/remove（单引擎进程内，
      与 [[project_routine_system]] 的单一所有者假设一致）。

参考文献：
[1] Git Docs, *git-worktree(1)*. 同仓库多工作树隔离机制。
[2] .github/workflows/cognizes-ruff.yml — 分支命名 / `gh pr create` 约定。
"""

from __future__ import annotations

import asyncio
import os
import re
import shutil
from contextlib import suppress
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Protocol
from uuid import UUID

from negentropy.logging import get_logger

if TYPE_CHECKING:
    from negentropy.config.routine import RoutineSettings

logger = get_logger("negentropy.engine.routine.workspace")

# 进程内按 routine 串行化 ensure/remove，兜底同一 routine 的并发工作区操作。
_LOCKS: dict[UUID, asyncio.Lock] = {}

# git-ref / 文件名安全字符集合（其余替换为 '-'）。
_UNSAFE_REF_CHARS = re.compile(r"[^A-Za-z0-9._-]+")


class WorkspaceError(Exception):
    """工作区编排失败（仓库非法 / 基线不可解析 / worktree 创建失败等）。

    API 层据此转 422（用户可修正：路径、基线分支）；引擎层据此判定 routine 不可派发。
    """


class _RoutineLike(Protocol):
    id: UUID
    key: str
    cwd: str | None
    baseline_branch: str | None
    work_branch: str | None
    worktree_path: str | None


@dataclass(frozen=True, slots=True)
class WorkspaceInfo:
    """隔离工作区句柄：worktree 路径（= CC 实际 cwd）+ 工作分支名。"""

    path: str
    branch: str


def _lock_for(routine_id: UUID) -> asyncio.Lock:
    lock = _LOCKS.get(routine_id)
    if lock is None:
        lock = asyncio.Lock()
        _LOCKS[routine_id] = lock
    return lock


# ---------------------------------------------------------------------------
# git 子进程
# ---------------------------------------------------------------------------


async def _run_git(args: list[str], *, timeout: float) -> tuple[int | None, str, str]:
    """执行 ``git <args>``，返回 (returncode, stdout, stderr)。

    以 ``start_new_session=True`` 起独立进程组，超时整组 SIGKILL（同 ``evaluator._run_gate``）。
    路径一律经 ``-C <path>`` 传入，故无需设置 cwd。超时/异常 → returncode=None。
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            "git",
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            start_new_session=True,
        )
    except Exception as exc:  # git 不存在等
        logger.warning("routine_git_spawn_failed", args=args[:3], error=str(exc))
        return None, "", f"spawn failed: {exc}"

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except TimeoutError:
        _kill_process_group(proc)
        with suppress(Exception):
            await proc.communicate()
        logger.warning("routine_git_timeout", args=args[:3], timeout=timeout)
        return None, "", f"git timed out after {timeout}s"
    out = (stdout or b"").decode("utf-8", errors="replace").strip()
    err = (stderr or b"").decode("utf-8", errors="replace").strip()
    return proc.returncode, out, err


def _kill_process_group(proc) -> None:
    """杀掉子进程所在进程组；失败则降级单进程 kill（同 evaluator）。"""
    import signal

    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except (ProcessLookupError, PermissionError, OSError):
        with suppress(Exception):
            proc.kill()


async def _run_git_checked(args: list[str], *, timeout: float, action: str) -> str:
    """执行 git 并在 returncode≠0 时抛 ``WorkspaceError``（含 stderr）。返回 stdout。"""
    rc, out, err = await _run_git(args, timeout=timeout)
    if rc != 0:
        detail = err or out or "(no output)"
        raise WorkspaceError(f"{action} failed (git rc={rc}): {detail}")
    return out


# ---------------------------------------------------------------------------
# 纯函数辅助
# ---------------------------------------------------------------------------


def _sanitize_ref(name: str) -> str:
    """把 routine key 归一为 git-ref / 文件名安全的片段。

    替换非 ``[A-Za-z0-9._-]`` 为 '-'，合并连续分隔符，去首尾 '-'/'.'，空则兜底 'routine'。
    """
    slug = _UNSAFE_REF_CHARS.sub("-", name or "").strip("-.")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug or "routine"


def normalize_base_branch(baseline_branch: str, remote: str) -> str:
    """归一 PR base：剥离前导 ``<remote>/`` 前缀（``origin/feature/1.x.x`` → ``feature/1.x.x``）。

    供 ``gh pr create --base`` 使用——PR base 须是远端上的分支名，而非 remote-tracking 引用名。
    """
    prefix = f"{remote}/"
    return baseline_branch[len(prefix) :] if baseline_branch.startswith(prefix) else baseline_branch


def _default_worktree_root(project_path: str) -> str:
    """默认 worktree 根目录：仓库**同级** ``<project_parent>/.negentropy-worktrees``。

    置于仓库工作树之外（不产生未跟踪文件污染），同文件系统使 ``worktree add`` 廉价。
    """
    parent = os.path.dirname(os.path.abspath(project_path))
    return os.path.join(parent, ".negentropy-worktrees")


def _resolve_worktree_root(project_path: str, settings: RoutineSettings) -> str:
    return settings.worktree_root or _default_worktree_root(project_path)


# ---------------------------------------------------------------------------
# 校验
# ---------------------------------------------------------------------------


async def validate_repo(project_path: str | None, baseline_branch: str | None, settings: RoutineSettings) -> None:
    """校验 worktree routine 的 Project Path 与 Baseline Branch；非法抛 ``WorkspaceError``。

    校验项：① project_path 非空且为已存在目录；② 是 git 工作树；③ baseline_branch 非空且可解析
    （best-effort fetch 后 ``rev-parse --verify``）。供 API 在 create/update 时调用转 422。
    """
    if not project_path:
        raise WorkspaceError("worktree routine 需提供 Project Path（cwd，git 仓库根）")
    if not baseline_branch or not baseline_branch.strip():
        raise WorkspaceError("worktree routine 需提供 Baseline Branch（如 origin/feature/1.x.x）")
    if not os.path.isdir(project_path):
        raise WorkspaceError(f"Project Path 目录不存在：'{project_path}'")

    timeout = float(settings.git_timeout_seconds)
    rc, out, _ = await _run_git(["-C", project_path, "rev-parse", "--is-inside-work-tree"], timeout=timeout)
    if rc != 0 or out.strip() != "true":
        raise WorkspaceError(f"Project Path 不是 git 工作树：'{project_path}'")

    if settings.git_fetch_before_worktree:
        await _try_fetch(project_path, baseline_branch, settings)

    rc, _, _ = await _run_git(
        ["-C", project_path, "rev-parse", "--verify", "--quiet", f"{baseline_branch}^{{commit}}"],
        timeout=timeout,
    )
    if rc != 0:
        raise WorkspaceError(f"Baseline Branch 无法解析：'{baseline_branch}'（请确认分支存在，或先 git fetch）")


async def _try_fetch(project_path: str, baseline_branch: str, settings: RoutineSettings) -> None:
    """best-effort ``git fetch <remote> <base>``（失败不阻断，仅日志）。"""
    base = normalize_base_branch(baseline_branch, settings.git_remote)
    rc, _, err = await _run_git(
        ["-C", project_path, "fetch", settings.git_remote, base], timeout=float(settings.git_timeout_seconds)
    )
    if rc != 0:
        logger.info("routine_worktree_fetch_skipped", baseline=baseline_branch, detail=err[:200])


# ---------------------------------------------------------------------------
# worktree 生命周期
# ---------------------------------------------------------------------------


async def ensure_worktree(routine: _RoutineLike, settings: RoutineSettings) -> WorkspaceInfo:
    """幂等地确保隔离 worktree 就绪，返回 (path, branch)。

    - 复用：若 ``routine.worktree_path``/``work_branch`` 仍指向一个有效 worktree → 直接返回。
    - 创建：否则基于 ``baseline_branch`` 新建工作分支 ``routine/<slug>-<ts>`` + worktree。

    不写 DB——调用方（orchestrator）负责把返回值持久化到 ``routine`` 行（同事务）。
    """
    project_path = routine.cwd
    baseline = routine.baseline_branch
    if not project_path or not baseline:
        raise WorkspaceError("ensure_worktree 需要 routine.cwd（仓库根）与 baseline_branch")

    timeout = float(settings.git_timeout_seconds)
    async with _lock_for(routine.id):
        # 复用既有有效 worktree（绝大多数迭代走此路径）
        if routine.worktree_path and routine.work_branch:
            if await _is_valid_worktree(routine.worktree_path, routine.work_branch, timeout):
                return WorkspaceInfo(routine.worktree_path, routine.work_branch)
            logger.warning(
                "routine_worktree_stale_recreate",
                routine_id=str(routine.id),
                stale_path=routine.worktree_path,
            )

        # 创建：唯一后缀（时间戳）避免与既往（aborted）worktree 路径/分支冲突
        slug = _sanitize_ref(routine.key)
        ts = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
        work_branch = f"routine/{slug}-{ts}"
        root = _resolve_worktree_root(project_path, settings)
        worktree_path = os.path.join(root, f"{slug}-{ts}")

        with suppress(OSError):
            os.makedirs(root, exist_ok=True)
        # 清理可能遗留的陈旧 worktree 元数据（best-effort），避免 add 报「already registered」。
        await _run_git(["-C", project_path, "worktree", "prune"], timeout=timeout)

        if settings.git_fetch_before_worktree:
            await _try_fetch(project_path, baseline, settings)

        await _run_git_checked(
            ["-C", project_path, "worktree", "add", "-b", work_branch, worktree_path, baseline],
            timeout=timeout,
            action=f"worktree add (baseline={baseline})",
        )
        logger.info(
            "routine_worktree_created",
            routine_id=str(routine.id),
            work_branch=work_branch,
            worktree_path=worktree_path,
            baseline=baseline,
        )
        return WorkspaceInfo(worktree_path, work_branch)


async def _is_valid_worktree(path: str, expected_branch: str, timeout: float) -> bool:
    """该路径是否为 checkout 在 ``expected_branch`` 的有效 git 工作树。"""
    if not os.path.isdir(path):
        return False
    rc, out, _ = await _run_git(["-C", path, "rev-parse", "--abbrev-ref", "HEAD"], timeout=timeout)
    return rc == 0 and out.strip() == expected_branch


async def remove_worktree(routine: _RoutineLike, settings: RoutineSettings, *, force: bool = True) -> None:
    """best-effort 幂等回收隔离 worktree（删 worktree + prune + 删本地工作分支）。

    **不**删除已 push 到 origin 的同名分支——PR 依赖之。所有步骤 best-effort，异常仅日志。
    """
    path = routine.worktree_path
    if not path:
        return
    project_path = routine.cwd
    timeout = float(settings.git_timeout_seconds)
    async with _lock_for(routine.id):
        if project_path and os.path.isdir(project_path):
            args = ["-C", project_path, "worktree", "remove", path]
            if force:
                args.append("--force")
            rc, _, err = await _run_git(args, timeout=timeout)
            if rc != 0:
                logger.info("routine_worktree_remove_soft_fail", path=path, detail=err[:200])
            await _run_git(["-C", project_path, "worktree", "prune"], timeout=timeout)
            if routine.work_branch:
                # 删本地工作分支（origin 上的同名分支保留供 PR）；best-effort。
                await _run_git(["-C", project_path, "branch", "-D", routine.work_branch], timeout=timeout)
        # 兜底：若目录仍残留（worktree remove 失败或 project_path 已失效），直接删目录。
        if os.path.isdir(path):
            with suppress(OSError):
                shutil.rmtree(path, ignore_errors=True)
        logger.info("routine_worktree_removed", routine_id=str(routine.id), path=path)
    _LOCKS.pop(routine.id, None)


# ---------------------------------------------------------------------------
# 状态计算（供序列化层按需调用，无副作用）
# ---------------------------------------------------------------------------

_DISK_WALK_FILE_CAP = 10_000  # os.walk 文件数安全上限，防巨型 worktree 阻塞事件循环


def _format_bytes(size: int) -> str:
    """将字节数归一为人可读字符串（如 ``"42.3M"``）。"""
    if size < 1024:
        return f"{size}B"
    if size < 1024**2:
        return f"{size / 1024:.1f}K"
    if size < 1024**3:
        return f"{size / 1024**2:.1f}M"
    return f"{size / 1024**3:.1f}G"


async def compute_worktree_status(
    routine: _RoutineLike,
    settings: RoutineSettings,
) -> dict[str, str | None]:
    """计算 worktree 生命周期状态 + 磁盘占用估算 + 清理策略（只读，无副作用）。

    供 API detail 端点按需调用后注入序列化结果；list/SSE 端点不调用以避免 N+1。

    Returns:
        dict 包含 ``status``, ``disk_usage``, ``cleanup_policy``。
    """
    if not routine.baseline_branch:
        return {"status": "none", "disk_usage": None, "cleanup_policy": settings.worktree_cleanup}

    if routine.worktree_path is None:
        # work_branch 非空 → 曾经创建过并已清理；否则尚未创建（pending/未 dispatch）。
        status = "cleaned" if routine.work_branch else "none"
        return {"status": status, "disk_usage": None, "cleanup_policy": settings.worktree_cleanup}

    if not os.path.isdir(routine.worktree_path):
        return {"status": "orphaned", "disk_usage": None, "cleanup_policy": settings.worktree_cleanup}

    # active — 估算磁盘占用（os.walk + 文件数安全上限）。
    total = 0
    file_count = 0
    try:
        for _dirpath, _dirnames, filenames in os.walk(routine.worktree_path):
            for fn in filenames:
                try:
                    total += os.lstat(os.path.join(_dirpath, fn)).st_size
                except OSError:
                    pass
                file_count += 1
                if file_count >= _DISK_WALK_FILE_CAP:
                    break
            if file_count >= _DISK_WALK_FILE_CAP:
                break
    except OSError:
        pass

    return {
        "status": "active",
        "disk_usage": _format_bytes(total),
        "cleanup_policy": settings.worktree_cleanup,
    }


__all__ = [
    "WorkspaceError",
    "WorkspaceInfo",
    "validate_repo",
    "ensure_worktree",
    "remove_worktree",
    "normalize_base_branch",
    "compute_worktree_status",
]
