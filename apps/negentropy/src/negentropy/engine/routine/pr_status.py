"""PR 合并状态检测——可降级的 ``gh pr view`` 只读封装。

定位（机制/策略分离）：
    本模块只做一件**确定性机制**：给定 PR 链接，best-effort 查询其合并状态，**绝不抛异常**。
    何时查、查到后如何回写 Routine（策略）由 ``orchestrator._sync_pr_merge_status`` 与
    ``routine_api`` 的手动 ``sync-pr`` 端点决定。

为何复用 ``gh`` CLI：
    ``gh`` 是本仓库 GitHub 集成的唯一事实源（CC 经 ``gh pr create`` 建 PR；``publish-wiki-pages.sh``
    经 ``gh auth token`` 取 token）。后端不引入新 GitHub 客户端 / token，直接复用运行时已授权的
    ``gh`` 做只读 ``gh pr view --json state,merged``。

可降级契约（对齐 AGENTS.md「不引入新问题」）：
    ``gh`` 不在 PATH / 未授权 / 超时 / rc≠0 / 坏 JSON / 坏 URL → 一律返回 ``PrMergeStatus(None, None)``
    （unknown），**绝不抛异常**。调用方（心跳 pass）据此保持 due、下 tick 重试；心跳永不因本模块崩溃。
    ``gh`` 缺失仅在本进程首次观测时 WARN 一次，避免 25s 心跳刷屏。

子进程范式镜像 ``workspace._run_git`` / ``evaluator._run_gate``：``create_subprocess_exec`` +
独立进程组（``start_new_session=True``）+ 超时整组 SIGKILL，防止 ``gh``/``git-remote`` 子进程变孤儿。

参考文献：
[1] GitHub CLI Docs, *gh pr view --json*. PR state/merged 字段查询。
[2] workspace.py:_run_git — 子进程 + 进程组超时杀范式。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import signal
from contextlib import suppress
from dataclasses import dataclass

from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.routine.pr_status")

# 运行时探测一次 ``gh`` 是否在 PATH（进程内缓存；PATH 不随运行期变化）。None ⇒ 整特性关闭。
GH_BIN: str | None = shutil.which("gh")

# 合法 GitHub PR 链接形状（兼容 github.com 与 Enterprise 自建域；``.../pull/<n>``）。
# 仅做形状校验避免对垃圾 URL 起 ``gh`` 子进程；``gh pr view`` 自行处理鉴权与可达性。
_PR_URL_RE = re.compile(r"^https?://[^/\s]+/[^/\s]+/[^/\s]+/(?:pull|pulls)/\d+(?:[/?#].*)?$")

# ``gh`` 缺失只 WARN 一次的进程内闸门（防心跳刷屏）。
_warned_no_gh = False


@dataclass(frozen=True, slots=True)
class PrMergeStatus:
    """``gh pr view`` 的 best-effort 结果。

    Attributes:
        merged: ``True``=已 merge；``False``=已确认为未 merge（如 OPEN/CLOSED-without-merge）；
            ``None``=未知（``gh`` 缺失/未授权/超时/rc≠0/坏 JSON/坏 URL）。
        state: ``OPEN``|``CLOSED``|``MERGED`` 或 ``None``。``None`` 表示 ``gh`` 未给出有效应答
            （调用方据此决定是否节流——未应答则不推进 ``checked_at``，保持 due 下 tick 重试）。
    """

    merged: bool | None
    state: str | None


def gh_available() -> bool:
    """运行时是否检测到 ``gh``。供心跳 pass / 端点快速短路判断。"""
    return GH_BIN is not None


def is_valid_pr_url(url: str | None) -> bool:
    """PR 链接是否合法（``.../pull/<n>`` 形状，兼容 github.com 与 Enterprise 自建域）。"""
    return bool(url) and bool(_PR_URL_RE.match(url))


def apply_pr_merge_result(routine, st: PrMergeStatus, now) -> bool:
    """把检测结果回写到 routine 的 ``pr_merged`` / ``pr_merged_checked_at``（鸭子类型，复用于
    心跳 pass 与手动 ``sync-pr`` 端点，避免两处写回分支漂移）。

    回写语义：
    - ``merged is True`` → ``pr_merged=True`` + 推进 ``checked_at``；返回是否「新检出」合并
      （之前非 True）——调用方据此决定是否推 SSE。
    - ``merged is False``（OPEN / closed-without-merge）→ ``pr_merged=False`` + 推进 ``checked_at``
      （确认为未合并即停检：部分索引谓词 ``COALESCE(pr_merged,false)=false`` 会把 True/False 都排除）。
    - ``merged is None``：``state`` 非 None（gh 应答，如 OPEN 已被上面覆盖；此处防御）→ 仅推进
      ``checked_at`` 节流；``state is None``（gh 未应答）→ **不动** ``checked_at``，保持 due 下 tick 重试。
    """
    if st.merged is True:
        before = getattr(routine, "pr_merged", None)
        routine.pr_merged = True
        routine.pr_merged_checked_at = now
        return before is not True
    if st.merged is False:
        routine.pr_merged = False
        routine.pr_merged_checked_at = now
        return False
    # merged is None
    if st.state is not None:
        routine.pr_merged_checked_at = now
    return False


def _kill_process_group(proc) -> None:
    """杀掉子进程所在进程组；失败则降级单进程 kill（同 workspace._run_git）。"""
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except (ProcessLookupError, PermissionError, OSError):
        with suppress(Exception):
            proc.kill()


async def fetch_pr_merge_status(pr_url: str | None, *, timeout: float = 5.0) -> PrMergeStatus:
    """Best-effort 查询 PR 合并状态。**契约：绝不抛异常。**

    流程（任一失败即返回 ``PrMergeStatus(None, None)``）：
    1. ``gh`` 不在 PATH → unknown（首次 WARN 一次）。
    2. URL 形状不合法 → unknown（不起子进程）。
    3. 起 ``gh pr view <url> --json state,mergedAt`` 子进程，``timeout`` 超时整组 SIGKILL → unknown。
    4. rc≠0（未授权 / 不可达 / PR 不存在）→ unknown。
    5. stdout 空 / 非 JSON / 字段缺失 → unknown（rc=0 但 stdout 空常为 gh 误用 JSON 字段，记 stderr 便于排查）。
    6. 成功：``state=MERGED``（或 ``mergedAt`` 非空）→ merged=True；
       否则（OPEN/CLOSED，``mergedAt`` 为 null）→ merged=False。

    注：``gh pr view --json`` **无 ``merged`` 布尔字段**（误用会 rc=0 + 空输出，曾致本特性静默全失败）。
    合并态权威信号是 ``state == "MERGED"``；``mergedAt`` 非空作 belt-and-suspenders。
    """
    global _warned_no_gh

    if GH_BIN is None:
        if not _warned_no_gh:
            logger.warning(
                "routine_pr_sync_disabled_no_gh",
                reason="gh CLI not on PATH; PR merge status sync disabled (no-op)",
            )
            _warned_no_gh = True
        return PrMergeStatus(merged=None, state=None)

    if not pr_url or not _PR_URL_RE.match(pr_url):
        logger.debug("routine_pr_merge_bad_url", pr_url=pr_url)
        return PrMergeStatus(merged=None, state=None)

    try:
        proc = await asyncio.create_subprocess_exec(
            GH_BIN,
            "pr",
            "view",
            pr_url,
            "--json",
            "state,mergedAt",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            start_new_session=True,
        )
    except Exception as exc:  # spawn 失败（不应发生，GH_BIN 已探测）——兜底
        logger.warning("routine_pr_view_spawn_failed", error=str(exc))
        return PrMergeStatus(merged=None, state=None)

    try:
        stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except TimeoutError:
        _kill_process_group(proc)
        with suppress(Exception):
            await proc.communicate()
        logger.warning("routine_pr_view_timeout", timeout=timeout)
        return PrMergeStatus(merged=None, state=None)
    except Exception as exc:  # communicate 异常——兜底，绝不向上抛
        logger.warning("routine_pr_view_communicate_failed", error=str(exc))
        return PrMergeStatus(merged=None, state=None)

    if proc.returncode != 0:
        # 未授权 / PR 不存在 / 不可达等——unknown，保持 due 下 tick 重试。
        logger.debug("routine_pr_view_nonzero_rc", returncode=proc.returncode)
        return PrMergeStatus(merged=None, state=None)

    out = (stdout_b or b"").decode("utf-8", errors="replace").strip()
    if not out:
        # rc=0 但 stdout 空——通常是 gh 误用 JSON 字段（如旧版误用 merged）等，stderr 有线索；
        # 记 WARN 便于排查，避免静默 unknown（曾因 merged 字段不存在静默全失败）。
        err = (stderr_b or b"").decode("utf-8", errors="replace").strip()
        logger.warning("routine_pr_view_empty_stdout", returncode=proc.returncode, stderr_preview=err[:200])
        return PrMergeStatus(merged=None, state=None)
    try:
        raw = json.loads(out)
    except (json.JSONDecodeError, ValueError):
        logger.debug("routine_pr_view_bad_json", out_preview=out[:120])
        return PrMergeStatus(merged=None, state=None)

    if not isinstance(raw, dict):
        return PrMergeStatus(merged=None, state=None)

    state = raw.get("state")
    state_str = state if isinstance(state, str) else None
    # 合并态权威信号：state == "MERGED"；mergedAt 非空作 belt-and-suspenders（gh 无 merged 布尔字段）。
    merged_at = raw.get("mergedAt")
    if state_str == "MERGED" or (isinstance(merged_at, str) and merged_at):
        return PrMergeStatus(merged=True, state=state_str or "MERGED")
    # state 为 OPEN/CLOSED 且无 mergedAt → 确认为未合并（gh 已应答，调用方据此节流/停检）。
    return PrMergeStatus(merged=False, state=state_str)
