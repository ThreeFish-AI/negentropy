"""Routine API 全链路集成测试 — 真实 Postgres + ASGI。

覆盖范围：
- CRUD：create / 重复 key 409 / detail / list 过滤 / update / delete
- 控制状态机：start / pause / resume / cancel + 非法转换 409
- 编辑运行中 routine 被拒（409）
- 审批门控：approve / reject 迭代
- 路由顺序：/stream 字面路径优先于 /{routine_id}
- KPIs 聚合

注意：SSE /stream 端点不在此测试（ASGITransport 下 is_disconnected 永不返回，会阻塞）；
其路由优先级通过 router.routes 声明顺序断言。
"""

from __future__ import annotations

import os
import subprocess
import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import delete, func, select

import negentropy.db.session as db_session
from negentropy.interface.routine_api import router
from negentropy.models.plugin_common import PluginVisibility
from negentropy.models.repository import Repository
from negentropy.models.routine import Routine, RoutineIteration, RoutineIterationEvent

pytestmark = pytest.mark.asyncio


def _key() -> str:
    return f"itest_api_{uuid.uuid4().hex[:8]}"


def _app() -> FastAPI:
    app = FastAPI()
    app.include_router(router)
    return app


def _client(app: FastAPI) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def _cleanup(key_prefix: str) -> None:
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(Routine).where(Routine.key.like(f"{key_prefix}%")))
        await db.commit()


@pytest.fixture(scope="module")
def git_repo(tmp_path_factory) -> str:
    """模块级临时 git 仓库（含 main 分支与初始提交），供可执行 routine 的 cwd + baseline 校验。"""
    repo = tmp_path_factory.mktemp("api_repo")
    p = str(repo)
    subprocess.run(["git", "init", "-q", p], check=True)
    subprocess.run(["git", "-C", p, "config", "user.email", "t@t.io"], check=True)
    subprocess.run(["git", "-C", p, "config", "user.name", "t"], check=True)
    (repo / "README.md").write_text("# repo\n")
    subprocess.run(["git", "-C", p, "add", "-A"], check=True)
    subprocess.run(["git", "-C", p, "commit", "-q", "-m", "init"], check=True)
    subprocess.run(["git", "-C", p, "branch", "-M", "main"], check=True)
    return p


async def test_stream_route_declared_before_id():
    """/routines/stream 必须在 /routines/{routine_id} 之前声明，否则被路径参数吞掉。"""
    paths = [r.path for r in router.routes]
    assert paths.index("/routines/stream") < paths.index("/routines/{routine_id}")


async def test_full_crud_and_control_lifecycle(git_repo):
    app = _app()
    key = _key()
    try:
        async with _client(app) as c:
            # CREATE（可执行 routine：cwd=git 仓库根 + baseline 必备，方可 start）
            r = await c.post(
                "/routines",
                json={
                    "key": key,
                    "title": "API Test",
                    "goal": "实现功能 X",
                    "acceptance_criteria": "测试通过",
                    "cwd": git_repo,
                    "baseline_branch": "main",
                    "max_iterations": 5,
                    "approval_mode": "first",
                    "verification_command": "echo ok",
                },
            )
            assert r.status_code == 200, r.text
            rid = r.json()["id"]
            assert r.json()["status"] == "pending"
            assert r.json()["approval_mode"] == "first"

            # 重复 key → 409
            dup = await c.post(
                "/routines",
                json={"key": key, "title": "x", "goal": "g", "acceptance_criteria": "a"},
            )
            assert dup.status_code == 409

            # detail 带 iterations
            detail = await c.get(f"/routines/{rid}")
            assert detail.status_code == 200 and "iterations" in detail.json()

            # list 过滤
            lst = await c.get("/routines", params={"q": "API Test"})
            assert lst.status_code == 200 and any(x["id"] == rid for x in lst.json()["items"])

            # KPIs
            kpi = await c.get("/routines/kpis")
            assert kpi.status_code == 200 and kpi.json()["total"] >= 1

            # update（pending 可改）
            upd = await c.put(f"/routines/{rid}", json={"max_iterations": 10})
            assert upd.status_code == 200 and upd.json()["max_iterations"] == 10

            # start → running
            st = await c.post(f"/routines/{rid}/start")
            assert st.status_code == 200 and st.json()["status"] == "running"

            # 运行中不可编辑 unsafe 字段 → 409
            assert (await c.put(f"/routines/{rid}", json={"goal": "x"})).status_code == 409

            # 运行中可编辑 runtime-safe 字段（success_score_threshold）→ 200
            safe_upd = await c.put(f"/routines/{rid}", json={"success_score_threshold": 70})
            assert safe_upd.status_code == 200 and safe_upd.json()["success_score_threshold"] == 70

            # 运行中混合 safe/unsafe → 409（整体被拒）
            assert (
                await c.put(f"/routines/{rid}", json={"success_score_threshold": 60, "goal": "y"})
            ).status_code == 409

            # pause → resume
            assert (await c.post(f"/routines/{rid}/pause")).json()["status"] == "paused"
            assert (await c.post(f"/routines/{rid}/resume")).json()["status"] == "running"

            # cancel → cancelled
            cancel = await c.post(f"/routines/{rid}/cancel")
            assert cancel.json()["status"] == "cancelled"
            assert cancel.json()["termination_reason"] == "user_cancelled"

            # 重复 cancel（已终态）→ 409
            assert (await c.post(f"/routines/{rid}/cancel")).status_code == 409

            # delete（终态可删）
            assert (await c.delete(f"/routines/{rid}")).status_code == 200
            # 删后 404
            assert (await c.get(f"/routines/{rid}")).status_code == 404
    finally:
        await _cleanup("itest_api_")


async def test_list_offset_pagination_and_cursor_compat():
    """offset 分页：翻页三段不重叠/连续、total 无上限、has_more/next_cursor 正确；cursor 路径兼容；二者同传 400。

    历史脉络：#1023 前前端「客户端拉全量」受后端默认 limit=50 限制只能见最近 50 条；本次为
    「纯翻页」新增 offset 随机访问，并以 (updated_at, id) 稳定排序消除跨页漂移。
    """
    app = _app()
    prefix = f"itest_off_{uuid.uuid4().hex[:8]}"
    base = datetime(2026, 1, 1, tzinfo=UTC)
    try:
        # 直接入库造 25 条（不同 updated_at、非模板），避免 25 次 POST；前缀唯一以相对化 total。
        async with db_session.AsyncSessionLocal() as db:
            for i in range(25):
                db.add(
                    Routine(
                        key=f"{prefix}_{i:02d}",
                        title=f"{prefix} {i}",
                        goal="g",
                        acceptance_criteria="ac",
                        status="pending",
                        is_template=False,
                        updated_at=base + timedelta(minutes=i),
                    )
                )
            await db.commit()

        async with _client(app) as c:
            common = {"q": prefix, "is_template": "false"}
            # offset 分页：每页 10，共 3 页（10 / 10 / 5）
            p1 = (await c.get("/routines", params={**common, "limit": 10, "offset": 0})).json()
            assert p1["total"] == 25  # 无上限全量计数（不受 limit 影响）
            assert p1["has_more"] is True
            assert p1["next_cursor"] is None  # offset 模式不产 cursor
            assert len(p1["items"]) == 10

            p2 = (await c.get("/routines", params={**common, "limit": 10, "offset": 10})).json()
            assert len(p2["items"]) == 10
            assert p2["has_more"] is True

            p3 = (await c.get("/routines", params={**common, "limit": 10, "offset": 20})).json()
            assert len(p3["items"]) == 5
            assert p3["has_more"] is False

            # 三页互不重叠、合并去重为 25；updated_at 倒序 → 第 1 页恰为最新 10 条（key 15..24）。
            all_ids = [it["id"] for it in p1["items"] + p2["items"] + p3["items"]]
            assert len(set(all_ids)) == 25
            assert {it["key"] for it in p1["items"]} == {f"{prefix}_{i:02d}" for i in range(15, 25)}

            # offset 越界 → 空页，total 不变
            p4 = (await c.get("/routines", params={"q": prefix, "limit": 10, "offset": 999})).json()
            assert p4["items"] == []
            assert p4["has_more"] is False
            assert p4["total"] == 25

            # cursor 路径（无 offset）仍兼容：has_more 时返回 next_cursor（ISO）
            bc = (await c.get("/routines", params={"q": prefix, "limit": 10})).json()
            assert len(bc["items"]) == 10
            assert bc["has_more"] is True
            assert bc["next_cursor"] is not None

            # cursor + offset 同传 → 400 互斥
            bad = await c.get("/routines", params={"q": prefix, "cursor": bc["next_cursor"], "offset": 0})
            assert bad.status_code == 400
    finally:
        async with db_session.AsyncSessionLocal() as db:
            await db.execute(delete(Routine).where(Routine.key.like(f"{prefix}%")))
            await db.commit()


async def test_iteration_approve_reject():
    app = _app()
    key = _key()
    try:
        async with _client(app) as c:
            r = await c.post(
                "/routines",
                json={"key": key, "title": "Approve Test", "goal": "g", "acceptance_criteria": "a"},
            )
            rid = r.json()["id"]

        # 直接在 DB 造两个 pending_approval 迭代
        async with db_session.AsyncSessionLocal() as db:
            it1 = RoutineIteration(routine_id=uuid.UUID(rid), seq=1, status="pending_approval", prompt="p1")
            it2 = RoutineIteration(routine_id=uuid.UUID(rid), seq=2, status="pending_approval", prompt="p2")
            db.add_all([it1, it2])
            await db.commit()
            iid1, iid2 = str(it1.id), str(it2.id)

        async with _client(app) as c:
            # approve → dispatched
            ap = await c.post(f"/routines/{rid}/iterations/{iid1}/approve")
            assert ap.status_code == 200 and ap.json()["status"] == "dispatched"
            # 重复 approve（非 pending）→ 409
            assert (await c.post(f"/routines/{rid}/iterations/{iid1}/approve")).status_code == 409
            # reject → aborted
            rj = await c.post(f"/routines/{rid}/iterations/{iid2}/reject")
            assert rj.status_code == 200 and rj.json()["status"] == "aborted"
    finally:
        await _cleanup("itest_api_")


async def test_iteration_events_endpoint_pagination_and_404():
    """GET /routines/{id}/iterations/{iid}/events：升序分页 + 404 校验。"""
    app = _app()
    key = _key()
    try:
        async with _client(app) as c:
            r = await c.post(
                "/routines",
                json={"key": key, "title": "Events Test", "goal": "g", "acceptance_criteria": "a"},
            )
            rid = r.json()["id"]

        # DB 造一个迭代 + 5 条动作事件（seq 0..4）
        async with db_session.AsyncSessionLocal() as db:
            it = RoutineIteration(routine_id=uuid.UUID(rid), seq=1, status="executed", summary="done")
            db.add(it)
            await db.flush()
            iid = str(it.id)
            for i, et in enumerate(["system", "tool_use", "tool_result", "result", "evaluation"]):
                db.add(
                    RoutineIterationEvent(
                        iteration_id=it.id,
                        routine_id=uuid.UUID(rid),
                        seq=i,
                        event_type=et,
                        title=f"e{i}",
                        payload={"i": i},
                    )
                )
            await db.commit()

        async with _client(app) as c:
            # 全量升序
            full = await c.get(f"/routines/{rid}/iterations/{iid}/events")
            assert full.status_code == 200
            body = full.json()
            assert [e["seq"] for e in body["items"]] == [0, 1, 2, 3, 4]
            assert body["items"][1]["event_type"] == "tool_use"
            assert body["has_more"] is False

            # 分页：limit=2 → has_more + next_after_seq
            page = await c.get(f"/routines/{rid}/iterations/{iid}/events", params={"limit": 2})
            pb = page.json()
            assert [e["seq"] for e in pb["items"]] == [0, 1]
            assert pb["has_more"] is True and pb["next_after_seq"] == 1

            # after_seq 翻页
            nxt = await c.get(f"/routines/{rid}/iterations/{iid}/events", params={"limit": 2, "after_seq": 1})
            assert [e["seq"] for e in nxt.json()["items"]] == [2, 3]

            # 未知 iteration → 404
            bad = await c.get(f"/routines/{rid}/iterations/{uuid.uuid4()}/events")
            assert bad.status_code == 404
    finally:
        await _cleanup("itest_api_")


async def test_restart_failed_resets_run_state_and_sets_floor(git_repo):
    """失败 routine 重启：复位运行态计数器，抬高 eval_floor_seq=MAX(seq)，保留既往迭代与反思。"""
    app = _app()
    key = _key()
    try:
        async with _client(app) as c:
            r = await c.post(
                "/routines",
                json={
                    "key": key,
                    "title": "Restart Reset",
                    "goal": "g",
                    "acceptance_criteria": "a",
                    "max_cost_usd": 10,
                    # cwd + baseline 满足 #829 restart 端点的 worktree 隔离守卫。
                    "cwd": git_repo,
                    "baseline_branch": "main",
                },
            )
            rid = r.json()["id"]

        # 造 failed 终态 + 累积运行态 + 两条 evaluated 迭代（seq 1,2）
        async with db_session.AsyncSessionLocal() as db:
            ro = await db.get(Routine, uuid.UUID(rid))
            ro.status = "failed"
            ro.termination_reason = "max_cost"
            ro.iteration_count = 3
            ro.total_cost_usd = 9.9
            ro.best_score = 55
            ro.last_score = 50
            ro.claude_session_id = "sess-old"
            ro.pr_url = "https://github.com/o/r/pull/1"
            ro.reflections = {"items": ["lesson A", "lesson B"]}
            db.add_all(
                [
                    RoutineIteration(routine_id=ro.id, seq=1, status="evaluated", score=40, verdict="progressing"),
                    RoutineIteration(routine_id=ro.id, seq=2, status="evaluated", score=55, verdict="progressing"),
                ]
            )
            await db.commit()

        async with _client(app) as c:
            res = await c.post(f"/routines/{rid}/restart", json={"keep_reflections": True})
            assert res.status_code == 200, res.text
            body = res.json()
            assert body["status"] == "running"
            assert body["termination_reason"] is None
            assert body["iteration_count"] == 0
            assert body["total_cost_usd"] == 0.0
            assert body["best_score"] is None
            assert body["last_score"] is None
            assert body["claude_session_id"] is None
            assert body["pr_url"] is None
            assert body["reflections"] == ["lesson A", "lesson B"]  # keep_reflections=True 保留

        async with db_session.AsyncSessionLocal() as db:
            ro = await db.get(Routine, uuid.UUID(rid))
            assert ro.eval_floor_seq == 2  # = MAX(seq)，新一轮决策窗口隔离旧迭代
            # 旧迭代行保留供审计（未删除）
            cnt = (
                await db.execute(
                    select(func.count()).select_from(RoutineIteration).where(RoutineIteration.routine_id == ro.id)
                )
            ).scalar_one()
            assert cnt == 2
    finally:
        await _cleanup("itest_api_")


async def test_restart_closes_leftover_nonterminal_iterations(git_repo):
    """回归（code review）：cancel 保留 executed 迭代；restart 须闭合全部遗留非终态迭代，

    否则重启后 _find_routines_pending_eval/_has_active_iteration 会拾取旧迭代污染新尝试。
    """
    app = _app()
    key = _key()
    try:
        async with _client(app) as c:
            r = await c.post(
                "/routines",
                json={
                    "key": key,
                    "title": "Restart Leftover",
                    "goal": "g",
                    "acceptance_criteria": "a",
                    # cwd + baseline 满足 #829 restart 端点的 worktree 隔离守卫。
                    "cwd": git_repo,
                    "baseline_branch": "main",
                },
            )
            rid = r.json()["id"]

        # cancelled 终态 + 遗留一条未评估的 executed 迭代（cancel 不会中止 executed）+ 一条 pending_approval
        async with db_session.AsyncSessionLocal() as db:
            ro = await db.get(Routine, uuid.UUID(rid))
            ro.status = "cancelled"
            db.add_all(
                [
                    RoutineIteration(routine_id=ro.id, seq=1, status="executed", exec_status="success", summary="old"),
                    RoutineIteration(routine_id=ro.id, seq=2, status="pending_approval", prompt="p"),
                ]
            )
            await db.commit()

        async with _client(app) as c:
            res = await c.post(f"/routines/{rid}/restart", json={"keep_reflections": True})
            assert res.status_code == 200 and res.json()["status"] == "running"

        # 遗留迭代须全部闭合为 aborted（无任何非终态行残留），eval_floor_seq=MAX(seq)=2
        async with db_session.AsyncSessionLocal() as db:
            its = (
                (await db.execute(select(RoutineIteration).where(RoutineIteration.routine_id == uuid.UUID(rid))))
                .scalars()
                .all()
            )
            assert {it.seq: it.status for it in its} == {1: "aborted", 2: "aborted"}
            ro = await db.get(Routine, uuid.UUID(rid))
            assert ro.eval_floor_seq == 2
    finally:
        await _cleanup("itest_api_")


async def test_restart_guards_and_reflection_reset(git_repo):
    """重启守卫：仅 failed/cancelled 可重启；keep_reflections=False 清空反思；过期 deadline → 409。"""
    app = _app()
    key = _key()
    try:
        async with _client(app) as c:
            r = await c.post(
                "/routines",
                json={
                    "key": key,
                    "title": "Restart Guard",
                    "goal": "g",
                    "acceptance_criteria": "a",
                    "cwd": git_repo,
                    "baseline_branch": "main",
                },
            )
            rid = r.json()["id"]
            # pending → 409
            assert (await c.post(f"/routines/{rid}/restart")).status_code == 409
            # running → 409
            assert (await c.post(f"/routines/{rid}/start")).status_code == 200
            assert (await c.post(f"/routines/{rid}/restart")).status_code == 409

        # cancelled + 既往反思
        async with db_session.AsyncSessionLocal() as db:
            ro = await db.get(Routine, uuid.UUID(rid))
            ro.status = "cancelled"
            ro.reflections = {"items": ["old lesson"]}
            await db.commit()

        async with _client(app) as c:
            # cancelled 可重启 + keep_reflections=False → 清空反思
            res = await c.post(f"/routines/{rid}/restart", json={"keep_reflections": False})
            assert res.status_code == 200 and res.json()["status"] == "running"
            assert res.json()["reflections"] == []

        # failed + 过期 deadline → 409（绝对时间无法靠归零复活）
        async with db_session.AsyncSessionLocal() as db:
            ro = await db.get(Routine, uuid.UUID(rid))
            ro.status = "failed"
            ro.termination_reason = "deadline"
            ro.deadline_at = datetime(2000, 1, 1, tzinfo=UTC)
            await db.commit()

        async with _client(app) as c:
            past = await c.post(f"/routines/{rid}/restart")
            assert past.status_code == 409
            assert "deadline" in past.json()["detail"]
    finally:
        await _cleanup("itest_api_")


# ---------------------------------------------------------------------------
# 隔离 worktree：baseline 校验 / 序列化 / start 守卫
# ---------------------------------------------------------------------------


async def test_create_persists_and_serializes_worktree_fields(git_repo):
    """create 带合法 cwd + baseline → 序列化回带 baseline_branch；运行期句柄初始为 null。"""
    app = _app()
    key = _key()
    try:
        async with _client(app) as c:
            r = await c.post(
                "/routines",
                json={
                    "key": key,
                    "title": "WT",
                    "goal": "g",
                    "acceptance_criteria": "a",
                    "cwd": git_repo,
                    "baseline_branch": "main",
                },
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["baseline_branch"] == "main"
            assert body["work_branch"] is None
            assert body["worktree_path"] is None
    finally:
        await _cleanup("itest_api_")


async def test_create_invalid_baseline_returns_422(git_repo):
    """create 提供 cwd + 不可解析 baseline → 422（早反馈）。"""
    app = _app()
    key = _key()
    try:
        async with _client(app) as c:
            r = await c.post(
                "/routines",
                json={
                    "key": key,
                    "title": "WT bad",
                    "goal": "g",
                    "acceptance_criteria": "a",
                    "cwd": git_repo,
                    "baseline_branch": "nope/does-not-exist",
                },
            )
            assert r.status_code == 422
    finally:
        await _cleanup("itest_api_")


async def test_start_requires_worktree_fields_409():
    """create 不带 cwd/baseline（草稿，200）→ start 被 worktree 守卫拒（409）。"""
    app = _app()
    key = _key()
    try:
        async with _client(app) as c:
            r = await c.post(
                "/routines",
                json={"key": key, "title": "Draft", "goal": "g", "acceptance_criteria": "a"},
            )
            assert r.status_code == 200  # 草稿创建宽松
            rid = r.json()["id"]
            st = await c.post(f"/routines/{rid}/start")
            assert st.status_code == 409  # 执行前提缺失 → 拒绝启动
    finally:
        await _cleanup("itest_api_")


# ---------------------------------------------------------------------------
# Running 状态运行时安全字段编辑
# ---------------------------------------------------------------------------


async def test_runtime_safe_fields_update_while_running(git_repo):
    """Running 状态下允许调整运行时安全字段（阈值 / 预算 / 元数据），拒绝语义敏感字段。"""
    app = _app()
    key = _key()
    try:
        async with _client(app) as c:
            r = await c.post(
                "/routines",
                json={
                    "key": key,
                    "title": "Runtime Safe",
                    "goal": "实现功能 X",
                    "acceptance_criteria": "测试通过",
                    "cwd": git_repo,
                    "baseline_branch": "main",
                    "success_score_threshold": 90,
                    "max_iterations": 10,
                },
            )
            rid = r.json()["id"]
            await c.post(f"/routines/{rid}/start")
            assert r.json()["success_score_threshold"] == 90

            # 1) 安全字段：success_score_threshold → 200
            res = await c.put(f"/routines/{rid}", json={"success_score_threshold": 75})
            assert res.status_code == 200
            assert res.json()["success_score_threshold"] == 75

            # 2) 多个安全字段同时更新 → 200
            res = await c.put(
                f"/routines/{rid}",
                json={"success_score_threshold": 70, "max_iterations": 20, "title": "Updated Title"},
            )
            assert res.status_code == 200
            body = res.json()
            assert body["success_score_threshold"] == 70
            assert body["max_iterations"] == 20
            assert body["title"] == "Updated Title"

            # 3) unsafe 字段：goal → 409
            res = await c.put(f"/routines/{rid}", json={"goal": "new goal"})
            assert res.status_code == 409
            assert "goal" in res.json()["detail"]

            # 4) unsafe 字段：cwd → 409
            res = await c.put(f"/routines/{rid}", json={"cwd": "/tmp"})
            assert res.status_code == 409
            assert "cwd" in res.json()["detail"]

            # 5) 混合 safe + unsafe → 409（整体被拒）
            res = await c.put(f"/routines/{rid}", json={"success_score_threshold": 80, "acceptance_criteria": "x"})
            assert res.status_code == 409
            assert "acceptance_criteria" in res.json()["detail"]

            # 6) 空 body → 200（无变更）
            res = await c.put(f"/routines/{rid}", json={})
            assert res.status_code == 200

            # 7) 非 running 状态（pause 后）全字段可编辑（回归）
            await c.post(f"/routines/{rid}/pause")
            res = await c.put(f"/routines/{rid}", json={"goal": "paused goal", "success_score_threshold": 85})
            assert res.status_code == 200
            assert res.json()["goal"] == "paused goal"
    finally:
        await _cleanup("itest_api_")


# ---------------------------------------------------------------------------
# cleanup-worktree：Repository 型 routine 须 hydrate 仓库根才能真正清理（回归）
# ---------------------------------------------------------------------------


async def test_cleanup_worktree_hydrates_repository_and_removes_branch(git_repo, tmp_path):
    """Repository 型 routine（cwd 列 NULL）的 cleanup-worktree 须 hydrate 仓库根，真正执行
    git worktree remove + 删本地工作分支。

    回归：修复前 ``remove_worktree`` 读 ``routine.cwd``（DB 列）= NULL → git 块整段被跳过，
    worktree 仍在 repo 注册、工作分支残留（即"没清理干净"）。
    """
    key = _key()
    work_branch = f"routine/itest-{uuid.uuid4().hex[:8]}"
    wt_path = str(tmp_path / "wt")
    # 预置真实 worktree + 工作分支（模拟引擎派发产物）
    subprocess.run(["git", "-C", git_repo, "worktree", "add", "-b", work_branch, wt_path, "main"], check=True)
    assert (
        subprocess.run(
            ["git", "-C", git_repo, "rev-parse", "--verify", "--quiet", f"refs/heads/{work_branch}"]
        ).returncode
        == 0
    )

    app = _app()
    repo_id = None
    try:
        # Repository（local_path=git_repo）+ 终态 Routine（repository_id 指针；cwd 列 NULL，复现 bug 条件）
        async with db_session.AsyncSessionLocal() as db:
            repo = Repository(
                owner_id="itest",
                visibility=PluginVisibility.PRIVATE,
                name=key,
                github_url="https://example.invalid/itest",
                local_path=git_repo,
                baseline_branch="main",
            )
            db.add(repo)
            await db.commit()
            await db.refresh(repo)
            repo_id = repo.id
            r = Routine(
                key=key,
                title="T",
                goal="g",
                acceptance_criteria="a",
                status="succeeded",
                repository_id=repo.id,
                cwd=None,
                baseline_branch=None,
                worktree_path=wt_path,
                work_branch=work_branch,
            )
            db.add(r)
            await db.commit()
            rid = str(r.id)

        async with _client(app) as c:
            resp = await c.post(f"/routines/{rid}/cleanup-worktree")
            assert resp.status_code == 200, resp.text

        # worktree 目录已删
        assert not os.path.isdir(wt_path)
        # git worktree 注册已清除（修复前残留）
        wt_list = subprocess.run(["git", "-C", git_repo, "worktree", "list"], capture_output=True, text=True).stdout
        assert wt_path not in wt_list
        # 本地工作分支已删（修复前残留）
        rc = subprocess.run(
            ["git", "-C", git_repo, "rev-parse", "--verify", "--quiet", f"refs/heads/{work_branch}"]
        ).returncode
        assert rc != 0
    finally:
        await _cleanup("itest_api_")
        if repo_id is not None:
            async with db_session.AsyncSessionLocal() as db:
                await db.execute(delete(Repository).where(Repository.id == repo_id))
                await db.commit()
        subprocess.run(["git", "-C", git_repo, "worktree", "prune"], capture_output=True)
        subprocess.run(["git", "-C", git_repo, "branch", "-D", work_branch], capture_output=True)
