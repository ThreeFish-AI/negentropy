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


class _RepositoryLike(Protocol):
    """已注册 Repository 的最小契约：派生隔离 worktree 所需的本地根 + 基线分支。"""

    local_path: str
    baseline_branch: str


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


def _stable_slug(routine: _RoutineLike) -> str:
    """routine 的确定性命名片段：``<sanitize(key)>-<id8>``（路径与分支共用，跨重启不变）。

    后缀取**不可变** ``routine.id`` 的前 8 位十六进制：① 即便 ``work_branch`` 句柄意外丢失也能
    复算出同名分支/路径（自愈）；② 消解不同 routine 经 ``_sanitize_ref`` 归一后 slug 碰撞的路径冲突。
    """
    return f"{_sanitize_ref(routine.key)}-{routine.id.hex[:8]}"


def _stable_work_branch(routine: _RoutineLike) -> str:
    """routine 终生唯一的确定性工作分支名 ``routine/<sanitize(key)>-<id8>``。

    仅当 routine 尚无 ``work_branch`` 句柄时用于首次铸名；已有句柄一律沿用（含存量时间戳分支名），
    保障「一个 Routine 任务终生只有一个工作分支」不变量、且向后兼容、无需迁移。
    """
    return f"routine/{_stable_slug(routine)}"


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
# 有效仓库配置解析（单一事实源：Routine 持 repository_id 指针，不存副本）
# ---------------------------------------------------------------------------


def resolve_effective_repo(routine: _RoutineLike, repository: _RepositoryLike | None) -> tuple[str | None, str | None]:
    """解析 routine 的「有效仓库配置」(cwd, baseline_branch)（纯函数，无 IO）。

    单一事实源：Routine 仅持有 ``repository_id`` 指针（FK），不复制 Repository 的
    local_path/baseline_branch 副本。调用方负责在 ``repository_id`` 非空时预取 Repository
    并传入；本函数据此选取权威值：

    - ``repository`` 非空 → ``(repository.local_path, repository.baseline_branch)``（指针优先）。
    - ``repository`` 为空（未关联 / 已删 / 竞态）→ 回退手填 ``(routine.cwd, routine.baseline_branch)``。

    对 ``repository=None`` 安全回退（不抛），故 FK ``SET NULL`` 后仍优雅降级到手填配置。
    """
    if repository is not None:
        return repository.local_path, repository.baseline_branch
    return routine.cwd, routine.baseline_branch


async def list_branches(
    project_path: str | None,
    settings: RoutineSettings,
    *,
    fetch: bool | None = None,
) -> dict[str, list[str] | str]:
    """枚举本地仓库的本地分支 + 远端跟踪分支（供前端基线分支下拉）。

    校验 ``project_path`` 为已存在的 git 工作树（非法抛 ``WorkspaceError`` → API 转 422）。
    best-effort ``git fetch <remote>``（默认随 ``settings.git_fetch_before_worktree``，失败不阻断）
    后以 ``branch --format`` 枚举：

    - ``local``：``git -C <p> branch --format=%(refname:short)``。
    - ``remote``：``git -C <p> branch -r --format=%(refname:short)``（剔除 ``<remote>/HEAD`` 指针）。

    Returns:
        ``{"local": [...], "remote": [...], "default_remote": settings.git_remote}``。
    """
    if not project_path:
        raise WorkspaceError("分支枚举需提供本地仓库根路径（local_path）")
    if not os.path.isdir(project_path):
        raise WorkspaceError(f"本地仓库路径不存在：'{project_path}'")

    timeout = float(settings.git_timeout_seconds)
    rc, out, _ = await _run_git(["-C", project_path, "rev-parse", "--is-inside-work-tree"], timeout=timeout)
    if rc != 0 or out.strip() != "true":
        raise WorkspaceError(f"路径不是 git 工作树：'{project_path}'")

    do_fetch = settings.git_fetch_before_worktree if fetch is None else fetch
    if do_fetch:
        # best-effort 全量 fetch（失败不阻断；不指定 base 以拉全部远端分支供下拉）。
        await _run_git(["-C", project_path, "fetch", settings.git_remote], timeout=timeout)

    rc, out, _ = await _run_git(["-C", project_path, "branch", "--format=%(refname:short)"], timeout=timeout)
    local = [ln.strip() for ln in out.splitlines() if ln.strip()] if rc == 0 else []

    rc, out, _ = await _run_git(["-C", project_path, "branch", "-r", "--format=%(refname:short)"], timeout=timeout)
    remote = [ln.strip() for ln in out.splitlines() if ln.strip() and "/HEAD" not in ln] if rc == 0 else []

    return {"local": local, "remote": remote, "default_remote": settings.git_remote}


# ---------------------------------------------------------------------------
# worktree 生命周期
# ---------------------------------------------------------------------------


async def ensure_worktree(routine: _RoutineLike, settings: RoutineSettings) -> WorkspaceInfo:
    """幂等地确保隔离 worktree 就绪，返回 (path, branch)。

    单一分支不变量：一个 routine 终生只有一个工作分支（``routine.work_branch``，由 ``id`` 派生的
    确定性名 ``routine/<slug>-<id8>`` 首次铸定后**绝不**改名）。重启 / 崩溃丢失 worktree 时一律
    （重）绑定到该分支，**不**铸新名。

    - 复用：若 ``worktree_path``/``work_branch`` 仍指向一个有效 worktree → 直接返回（绝大多数迭代）。
    - 重绑/创建：否则在**保留同一分支名**前提下重建 worktree——分支存在感知三级阶梯：
      本地分支存在 → 直接 checkout（含其检查点提交，重启续作）；
      否则远端 ``origin/<b>`` 存在 → 从远端恢复本地分支；
      否则（首次 / 无可恢复提交）→ 基于 ``baseline_branch`` 新建。

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
            # CC 可能在 worktree 内漂移 HEAD（git switch/checkout 偏离 work_branch）。此时目录仍是
            # 有效 git worktree——re-anchor：把 HEAD 切回 work_branch，**不重建目录**（Engine「巡检 +
            # 保持」单一 workspace）。仅当目录缺失/非 git worktree 才回落重建。
            if await _is_git_worktree(routine.worktree_path, timeout):
                logger.warning(
                    "routine_worktree_head_drifted",
                    routine_id=str(routine.id),
                    path=routine.worktree_path,
                    expected=routine.work_branch,
                    actual=await _get_head_branch(routine.worktree_path, timeout),
                )
                if await _reanchor_head(routine.worktree_path, routine.work_branch, timeout):
                    return WorkspaceInfo(routine.worktree_path, routine.work_branch)
                # re-anchor 失败（极少：work_branch ref 丢失等）→ 回落既有重建兜底。
            logger.warning(
                "routine_worktree_stale_recreate",
                routine_id=str(routine.id),
                stale_path=routine.worktree_path,
            )

        # 单一分支身份：已有句柄一律沿用（含存量时间戳分支名）；否则铸确定性名。
        work_branch = routine.work_branch or _stable_work_branch(routine)
        # 路径：复用持久化路径（勿对存量 legacy 活动目录另算新路径而误删）；否则取确定性路径。
        root = _resolve_worktree_root(project_path, settings)
        worktree_path = routine.worktree_path or os.path.join(root, _stable_slug(routine))

        with suppress(OSError):
            os.makedirs(root, exist_ok=True)
        # 扫清重绑障碍：① prune 清理目录已消失的陈旧注册；② 强制移除占用本分支的兄弟 worktree；
        # ③ 再 prune；④ 清掉目标路径残留目录（防 add 报 already exists）。
        await _run_git(["-C", project_path, "worktree", "prune"], timeout=timeout)
        await _purge_sibling_worktrees(project_path, work_branch, worktree_path, timeout)
        await _run_git(["-C", project_path, "worktree", "prune"], timeout=timeout)
        if os.path.isdir(worktree_path):
            await _run_git(["-C", project_path, "worktree", "remove", "--force", worktree_path], timeout=timeout)
            if os.path.isdir(worktree_path):
                # 同 remove_worktree：同步 rmtree 须离事件循环，避免派发期阻塞全站其他请求。
                with suppress(OSError):
                    await asyncio.to_thread(shutil.rmtree, worktree_path, ignore_errors=True)

        if settings.git_fetch_before_worktree:
            await _try_fetch(project_path, baseline, settings)

        # 分支存在感知三级阶梯——始终绑定同一 ``work_branch``。
        if await _local_branch_exists(project_path, work_branch, timeout):
            add_args = ["worktree", "add", worktree_path, work_branch]
            source = f"local branch={work_branch}"
        elif await _remote_branch_exists(project_path, settings.git_remote, work_branch, timeout):
            origin_ref = f"{settings.git_remote}/{work_branch}"
            add_args = ["worktree", "add", "-b", work_branch, worktree_path, origin_ref]
            source = f"remote={origin_ref}"
        else:
            add_args = ["worktree", "add", "-b", work_branch, worktree_path, baseline]
            source = f"baseline={baseline}"

        await _run_git_checked(
            ["-C", project_path, *add_args],
            timeout=timeout,
            action=f"worktree add ({source})",
        )
        logger.info(
            "routine_worktree_created",
            routine_id=str(routine.id),
            work_branch=work_branch,
            worktree_path=worktree_path,
            source=source,
        )
        return WorkspaceInfo(worktree_path, work_branch)


async def _is_valid_worktree(path: str, expected_branch: str, timeout: float) -> bool:
    """该路径是否为 checkout 在 ``expected_branch`` 的有效 git 工作树。"""
    if not os.path.isdir(path):
        return False
    rc, out, _ = await _run_git(["-C", path, "rev-parse", "--abbrev-ref", "HEAD"], timeout=timeout)
    return rc == 0 and out.strip() == expected_branch


async def _is_git_worktree(path: str, timeout: float) -> bool:
    """路径是否为有效 git 工作树（不论 HEAD 当前在哪条分支 / 是否 detached）。

    与 ``_is_valid_worktree`` 的区别：后者额外要求 HEAD 恰在 ``expected_branch``；本函数只判
    「目录在 + 是 git 工作树」，用于区分「HEAD 漂移（可 re-anchor）」与「目录缺失/非 worktree（需重建）」。
    """
    if not os.path.isdir(path):
        return False
    rc, out, _ = await _run_git(["-C", path, "rev-parse", "--is-inside-work-tree"], timeout=timeout)
    return rc == 0 and out.strip() == "true"


async def _get_head_branch(path: str, timeout: float) -> str | None:
    """当前 HEAD 的符号引用分支名；detached HEAD（输出 ``HEAD``）或查询失败 → None。"""
    rc, out, _ = await _run_git(["-C", path, "rev-parse", "--abbrev-ref", "HEAD"], timeout=timeout)
    if rc != 0:
        return None
    name = out.strip()
    if not name or name == "HEAD":
        return None
    return name


async def _reanchor_head(worktree_path: str, work_branch: str, timeout: float) -> bool:
    """把漂移的 worktree HEAD 切回 ``work_branch``（re-anchor，**不重建目录**）。

    纯 workspace 机制：CC 在 worktree 内 ``git switch``/``checkout`` 偏离 work_branch 时，由 Engine
    在下轮派发前把 HEAD 切回，维系「一个 Routine 终生单一工作分支 + 单一 worktree」不变量。

    - 干净切换优先；脏工作树致 ``git switch`` 拒绝时，``stash push → switch → stash pop`` 兜底。
    - best-effort：任一步失败返回 False，调用方回落 ``stale_recreate`` 重建。偏离分支上的提交留在其
      分支 ref 不丢；work_branch 上的提交保留。
    """
    rc, _, err = await _run_git(["-C", worktree_path, "switch", work_branch], timeout=timeout)
    if rc == 0:
        logger.info("routine_worktree_reanchored", path=worktree_path, branch=work_branch)
        return True
    # 切换失败——仅当工作树确有未提交改动时尝试 stash 兜底（否则多为 work_branch ref 丢失，stash 无益）。
    rc_st, status_out, _ = await _run_git(["-C", worktree_path, "status", "--porcelain"], timeout=timeout)
    if rc_st == 0 and status_out.strip():
        await _run_git(["-C", worktree_path, "stash", "push", "-m", "negentropy-reanchor"], timeout=timeout)
        rc2, _, err2 = await _run_git(["-C", worktree_path, "switch", work_branch], timeout=timeout)
        if rc2 == 0:
            # stash pop best-effort：冲突时留 stash 供人工处理，不阻断 re-anchor 成局。
            await _run_git(["-C", worktree_path, "stash", "pop"], timeout=timeout)
            logger.info("routine_worktree_reanchored_with_stash", path=worktree_path, branch=work_branch)
            return True
        logger.warning(
            "routine_worktree_reanchor_failed_after_stash",
            path=worktree_path,
            branch=work_branch,
            detail=(err2 or "")[:200],
        )
        return False
    logger.warning(
        "routine_worktree_reanchor_failed",
        path=worktree_path,
        branch=work_branch,
        detail=(err or "")[:200],
    )
    return False


async def _local_branch_exists(project_path: str, branch: str, timeout: float) -> bool:
    """本地是否存在分支 ``branch``（``rev-parse --verify --quiet refs/heads/<b>`` rc==0）。"""
    rc, _, _ = await _run_git(
        ["-C", project_path, "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}"], timeout=timeout
    )
    return rc == 0


async def _remote_branch_exists(project_path: str, remote: str, branch: str, timeout: float) -> bool:
    """是否存在远端跟踪分支 ``<remote>/<branch>``（``refs/remotes/<remote>/<b>`` rc==0）。"""
    rc, _, _ = await _run_git(
        ["-C", project_path, "rev-parse", "--verify", "--quiet", f"refs/remotes/{remote}/{branch}"], timeout=timeout
    )
    return rc == 0


async def _purge_sibling_worktrees(project_path: str, branch: str, keep_path: str, timeout: float) -> None:
    """强制移除占用 ``branch`` 却位于 ``keep_path`` 之外的陈旧 worktree 注册（best-effort）。

    ``git worktree add`` 在目标分支已被另一 worktree（其目录仍在）检出时会硬失败（``already used by
    worktree``），而 ``prune`` 只能清理目录已消失的注册。本函数解析 ``worktree list --porcelain``，
    对命中目标分支且路径不等于我方目标的兄弟注册逐一 ``worktree remove --force``，扫清重绑障碍。
    """
    rc, out, _ = await _run_git(["-C", project_path, "worktree", "list", "--porcelain"], timeout=timeout)
    if rc != 0 or not out:
        return
    keep_abs = os.path.abspath(keep_path)
    cur_path: str | None = None
    for line in out.splitlines():
        if line.startswith("worktree "):
            cur_path = line[len("worktree ") :].strip()
        elif line.startswith("branch ") and cur_path:
            # porcelain 的 branch 行形如 ``branch refs/heads/<name>``。
            ref = line[len("branch ") :].strip()
            name = ref[len("refs/heads/") :] if ref.startswith("refs/heads/") else ref
            if name == branch and os.path.abspath(cur_path) != keep_abs:
                await _run_git(["-C", project_path, "worktree", "remove", "--force", cur_path], timeout=timeout)
            cur_path = None


async def checkpoint_commit(worktree_path: str, settings: RoutineSettings, *, seq: int | None = None) -> bool:
    """在隔离 worktree 内确定性提交一次迭代检查点（best-effort，返回是否产生提交）。

    引擎侧的「确定性 auto-commit」——不依赖 CC 遵循 prompt 中的检查点指令（同 ISSUE-116 的思路：
    硬性保障由引擎机制兜底，prompt 仅作软引导）。仅在 worktree 内操作，绝不 push、绝不触碰基线/主分支。
    无变更（``git status --porcelain`` 为空）→ 跳过提交返回 False。所有步骤异常仅日志，绝不冒泡阻断写回。

    设计要点（ISSUE-114 加固）：
    - ``git add -A`` 暂存全部改动（含未跟踪）；
    - 仅当有改动时 ``git commit``，避免空提交噪声；
    - commit message 含 seq 便于回溯；``--no-verify`` 跳过 worktree 内可能存在的 pre-commit 钩子
      （钩子失败不应阻断引擎检查点——质量门控由 routine 的 verification_command 负责）。
    """
    if not worktree_path or not os.path.isdir(worktree_path):
        return False
    timeout = float(settings.git_timeout_seconds)
    try:
        rc, out, _ = await _run_git(["-C", worktree_path, "status", "--porcelain"], timeout=timeout)
        if rc != 0 or not out.strip():
            return False  # 查询失败或无改动 → 不提交
        await _run_git(["-C", worktree_path, "add", "-A"], timeout=timeout)
        label = f" (seq={seq})" if seq is not None else ""
        msg = f"chore(routine): iteration checkpoint{label}\n\n引擎确定性检查点提交（防 worktree 丢失/留存进度）。"
        crc, _, cerr = await _run_git(["-C", worktree_path, "commit", "--no-verify", "-m", msg], timeout=timeout)
        if crc != 0:
            logger.info("routine_checkpoint_commit_soft_fail", path=worktree_path, detail=(cerr or "")[:200])
            return False
        logger.info("routine_checkpoint_committed", path=worktree_path, seq=seq)
        return True
    except Exception as exc:  # 绝不阻断写回
        logger.warning("routine_checkpoint_commit_error", path=worktree_path, error=str(exc))
        return False


async def remove_worktree(
    routine: _RoutineLike, settings: RoutineSettings, *, force: bool = True, keep_branch: bool = False
) -> None:
    """best-effort 幂等回收隔离 worktree（删 worktree + prune [+ 删本地工作分支]）。

    **不**删除已 push 到 origin 的同名分支——PR 依赖之。所有步骤 best-effort，异常仅日志。

    ``keep_branch=True`` 时仅回收 worktree 目录、**保留本地工作分支**（含其检查点提交）：供 restart
    从上一检查点续作、以及 ``always`` 清理策略下失败态保留进度，维系「终生单一工作分支」不变量。
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
            if routine.work_branch and not keep_branch:
                # 删本地工作分支（origin 上的同名分支保留供 PR）；best-effort。
                await _run_git(["-C", project_path, "branch", "-D", routine.work_branch], timeout=timeout)
        # 兜底：若目录仍残留（worktree remove 失败或 project_path 已失效），直接删目录。
        if os.path.isdir(path):
            # rmtree 是纯同步递归删除，对巨型 worktree（node_modules/.git/构建产物）可耗时数十秒；
            # 必须卸载到线程池，否则会冻结单 uvicorn 事件循环、阻塞全站其他请求（同 graph_algorithms 范式）。
            with suppress(OSError):
                await asyncio.to_thread(shutil.rmtree, path, ignore_errors=True)
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
    "list_branches",
    "resolve_effective_repo",
    "ensure_worktree",
    "remove_worktree",
    "normalize_base_branch",
    "compute_worktree_status",
]
