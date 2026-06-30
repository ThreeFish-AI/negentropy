"""pr_status 单元测试——``fetch_pr_merge_status`` 可降级契约（绝不抛异常）。

覆盖：gh 缺失 / 坏 URL / MERGED / OPEN / CLOSED / rc≠0 / 坏 JSON / 超时（杀进程组）/ spawn 失败，
以及 ``apply_pr_merge_result`` 的三分支回写语义。子进程以 fake proc 替代，零真实 gh / GitHub 依赖。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from negentropy.engine.routine import pr_status

# 注：本模块混合 async（fetch_pr_merge_status）与同步（apply/is_valid）测试，故逐个标记
# async 用例，不用模块级 pytestmark，避免同步测试被误标 asyncio 触发 PytestWarning。
_asyncio = pytest.mark.asyncio

_GOOD_URL = "https://github.com/owner/repo/pull/123"
_BAD_URL = "not a url"


class _FakeProc:
    """模拟 ``asyncio.subprocess.Process``：可控 stdout / returncode / 超时 / kill。"""

    def __init__(
        self,
        *,
        stdout: bytes = b"",
        stderr: bytes = b"",
        returncode: int = 0,
        sleep: float = 0.0,
        pid: int = 999_999,
    ) -> None:
        self._stdout = stdout
        self._stderr = stderr
        self.returncode = returncode
        self.pid = pid
        self._sleep = sleep
        self._calls = 0
        self.killed = False

    async def communicate(self) -> tuple[bytes, bytes]:
        self._calls += 1
        # 仅首次 sleep 模拟慢子进程；超时被杀后第二次 communicate 立即返回（避免测试挂起）。
        if self._sleep and self._calls == 1:
            await asyncio.sleep(self._sleep)
        return self._stdout, self._stderr

    def kill(self) -> None:
        self.killed = True


def _patch_exec(monkeypatch, proc: _FakeProc | BaseException) -> None:
    """把 ``asyncio.create_subprocess_exec`` 替换为返回 ``proc``（或抛 ``proc``）的协程。"""

    async def _fake(*_args: Any, **_kwargs: Any) -> _FakeProc:
        if isinstance(proc, BaseException):
            raise proc
        return proc

    monkeypatch.setattr(asyncio, "create_subprocess_exec", _fake)


async def _fetch(url: str = _GOOD_URL, *, timeout: float = 5.0) -> pr_status.PrMergeStatus:
    """包裹一层，强调「绝不抛」：任何异常在此处都算契约违反。"""
    return await pr_status.fetch_pr_merge_status(url, timeout=timeout)


# ---------------------------------------------------------------------------
# fetch_pr_merge_status：各路径均返回 PrMergeStatus 且不抛
# ---------------------------------------------------------------------------


@_asyncio
async def test_gh_missing_returns_unknown_without_spawn(monkeypatch):
    monkeypatch.setattr(pr_status, "GH_BIN", None)
    spawned = False

    async def _should_not_spawn(*_a: Any, **_k: Any) -> _FakeProc:  # pragma: no cover - 断言不调用
        nonlocal spawned
        spawned = True
        raise RuntimeError("must not spawn")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", _should_not_spawn)
    st = await _fetch()
    assert st == pr_status.PrMergeStatus(merged=None, state=None)
    assert not spawned


@_asyncio
async def test_bad_url_returns_unknown_without_spawn(monkeypatch):
    monkeypatch.setattr(pr_status, "GH_BIN", "/fake/gh")
    spawned = False

    async def _should_not_spawn(*_a: Any, **_k: Any) -> _FakeProc:  # pragma: no cover
        nonlocal spawned
        spawned = True
        raise RuntimeError("must not spawn")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", _should_not_spawn)
    st = await _fetch(_BAD_URL)
    assert st.merged is None
    assert not spawned


@_asyncio
async def test_merged_state_returns_true(monkeypatch):
    """真实 gh 输出：state=MERGED + mergedAt 时间戳 → merged=True。"""
    monkeypatch.setattr(pr_status, "GH_BIN", "/fake/gh")
    _patch_exec(
        monkeypatch,
        _FakeProc(stdout=b'{"state":"MERGED","mergedAt":"2026-06-30T02:34:16Z","mergedBy":{"login":"x"}}'),
    )
    st = await _fetch()
    assert st.merged is True
    assert st.state == "MERGED"


@_asyncio
async def test_merged_inferred_from_state_only(monkeypatch):
    """state=MERGED 即判已合并（权威信号；即便缺 mergedAt）。"""
    monkeypatch.setattr(pr_status, "GH_BIN", "/fake/gh")
    _patch_exec(monkeypatch, _FakeProc(stdout=b'{"state":"MERGED"}'))
    st = await _fetch()
    assert st.merged is True


@_asyncio
async def test_merged_inferred_from_merged_at_only(monkeypatch):
    """belt-and-suspenders：mergedAt 非空即判已合并（即便 state 异常缺失）。"""
    monkeypatch.setattr(pr_status, "GH_BIN", "/fake/gh")
    _patch_exec(monkeypatch, _FakeProc(stdout=b'{"mergedAt":"2026-06-30T02:34:16Z"}'))
    st = await _fetch()
    assert st.merged is True


@_asyncio
async def test_open_state_returns_false(monkeypatch):
    """OPEN + mergedAt=null → merged=False（gh 已应答，调用方据此节流）。"""
    monkeypatch.setattr(pr_status, "GH_BIN", "/fake/gh")
    _patch_exec(monkeypatch, _FakeProc(stdout=b'{"state":"OPEN","mergedAt":null}'))
    st = await _fetch()
    assert st.merged is False
    assert st.state == "OPEN"


@_asyncio
async def test_closed_state_returns_false(monkeypatch):
    """CLOSED-without-merge → merged=False（停检）。"""
    monkeypatch.setattr(pr_status, "GH_BIN", "/fake/gh")
    _patch_exec(monkeypatch, _FakeProc(stdout=b'{"state":"CLOSED","mergedAt":null}'))
    st = await _fetch()
    assert st.merged is False
    assert st.state == "CLOSED"


@_asyncio
async def test_empty_stdout_with_rc0_returns_unknown(monkeypatch):
    """rc=0 但 stdout 空 → unknown（曾因 gh 误用 merged 字段静默全失败；现记 WARN stderr）。

    回归 503 根因：旧代码请求不存在的 ``--json state,merged``，gh rc=0 + stderr 报
    ``Unknown JSON field`` + stdout 空 → json.loads 失败 → unknown → 前端 503。
    """
    monkeypatch.setattr(pr_status, "GH_BIN", "/fake/gh")
    _patch_exec(monkeypatch, _FakeProc(stdout=b"", stderr=b'Unknown JSON field: "merged"', returncode=0))
    st = await _fetch()
    assert st == pr_status.PrMergeStatus(merged=None, state=None)


@_asyncio
async def test_nonzero_returncode_returns_unknown(monkeypatch):
    """rc≠0（未授权 / 不可达 / PR 不存在）→ unknown（保持 due 下 tick 重试）。"""
    monkeypatch.setattr(pr_status, "GH_BIN", "/fake/gh")
    _patch_exec(monkeypatch, _FakeProc(stdout=b"", stderr=b"authentication required", returncode=1))
    st = await _fetch()
    assert st == pr_status.PrMergeStatus(merged=None, state=None)


@_asyncio
async def test_bad_json_returns_unknown(monkeypatch):
    monkeypatch.setattr(pr_status, "GH_BIN", "/fake/gh")
    _patch_exec(monkeypatch, _FakeProc(stdout=b"not json at all"))
    st = await _fetch()
    assert st == pr_status.PrMergeStatus(merged=None, state=None)


@_asyncio
async def test_timeout_returns_unknown_and_kills_process_group(monkeypatch):
    """超时 → unknown 且进程组被杀（_kill_process_group 兜底 proc.kill）。"""
    monkeypatch.setattr(pr_status, "GH_BIN", "/fake/gh")
    proc = _FakeProc(stdout=b'{"state":"OPEN","mergedAt":null}', sleep=1.0)
    _patch_exec(monkeypatch, proc)
    st = await _fetch(timeout=0.05)
    assert st == pr_status.PrMergeStatus(merged=None, state=None)
    assert proc.killed is True


@_asyncio
async def test_spawn_failure_returns_unknown(monkeypatch):
    monkeypatch.setattr(pr_status, "GH_BIN", "/fake/gh")
    _patch_exec(monkeypatch, RuntimeError("spawn boom"))
    st = await _fetch()
    assert st == pr_status.PrMergeStatus(merged=None, state=None)


# ---------------------------------------------------------------------------
# apply_pr_merge_result：三分支回写语义（鸭子类型 routine）
# ---------------------------------------------------------------------------


class _RoutineLike:
    """最小鸭子类型：仅携带 pr_merged / pr_merged_checked_at 两个属性。"""

    def __init__(self, *, pr_merged=None, checked_at=None) -> None:
        self.pr_merged = pr_merged
        self.pr_merged_checked_at = checked_at


def test_apply_merged_true_sets_true_and_advances_checked_at():
    r = _RoutineLike()
    now = "2026-06-30T00:00:00Z"
    newly = pr_status.apply_pr_merge_result(r, pr_status.PrMergeStatus(merged=True, state="MERGED"), now)
    assert newly is True
    assert r.pr_merged is True
    assert r.pr_merged_checked_at == now


def test_apply_already_true_is_not_newly_detected():
    r = _RoutineLike(pr_merged=True, checked_at="old")
    newly = pr_status.apply_pr_merge_result(r, pr_status.PrMergeStatus(merged=True, state="MERGED"), "new")
    assert newly is False  # 之前已是 True → 非新检出（不重复推 SSE）
    assert r.pr_merged is True


def test_apply_false_records_false_and_advances_checked_at():
    """closed-without-merge：记 False 并推进 checked_at → 停检（退出 due 集）。"""
    r = _RoutineLike()
    newly = pr_status.apply_pr_merge_result(r, pr_status.PrMergeStatus(merged=False, state="CLOSED"), "now")
    assert newly is False
    assert r.pr_merged is False
    assert r.pr_merged_checked_at == "now"


def test_apply_unknown_with_state_advances_checked_at_only():
    """gh 应答但 merged 未定（如 OPEN 已被 False 分支覆盖；此处防御 state 非 None）→ 仅节流。"""
    r = _RoutineLike()
    pr_status.apply_pr_merge_result(r, pr_status.PrMergeStatus(merged=None, state="OPEN"), "now")
    assert r.pr_merged is None
    assert r.pr_merged_checked_at == "now"


def test_apply_unknown_without_state_leaves_checked_at_untouched():
    """gh 未应答 → 不动 checked_at，保持 due 下 tick 重试。"""
    r = _RoutineLike()
    pr_status.apply_pr_merge_result(r, pr_status.PrMergeStatus(merged=None, state=None), "now")
    assert r.pr_merged is None
    assert r.pr_merged_checked_at is None


def test_is_valid_pr_url_accepts_github_and_enterprise():
    assert pr_status.is_valid_pr_url("https://github.com/o/r/pull/1")
    assert pr_status.is_valid_pr_url("https://github.com/o/r/pull/123/files")
    assert pr_status.is_valid_pr_url("https://gh.example.com/o/r/pulls/7")
    assert not pr_status.is_valid_pr_url("https://github.com/o/r/issues/1")
    assert not pr_status.is_valid_pr_url(None)
    assert not pr_status.is_valid_pr_url("not a url")
