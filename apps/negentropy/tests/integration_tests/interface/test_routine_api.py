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

import uuid
from datetime import UTC, datetime

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import delete, func, select

import negentropy.db.session as db_session
from negentropy.interface.routine_api import router
from negentropy.models.routine import Routine, RoutineIteration

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


async def test_stream_route_declared_before_id():
    """/routines/stream 必须在 /routines/{routine_id} 之前声明，否则被路径参数吞掉。"""
    paths = [r.path for r in router.routes]
    assert paths.index("/routines/stream") < paths.index("/routines/{routine_id}")


async def test_full_crud_and_control_lifecycle():
    app = _app()
    key = _key()
    try:
        async with _client(app) as c:
            # CREATE
            r = await c.post(
                "/routines",
                json={
                    "key": key,
                    "title": "API Test",
                    "goal": "实现功能 X",
                    "acceptance_criteria": "测试通过",
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

            # 运行中不可编辑 → 409
            assert (await c.put(f"/routines/{rid}", json={"goal": "x"})).status_code == 409

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


async def test_restart_failed_resets_run_state_and_sets_floor():
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


async def test_restart_closes_leftover_nonterminal_iterations():
    """回归（code review）：cancel 保留 executed 迭代；restart 须闭合全部遗留非终态迭代，

    否则重启后 _find_routines_pending_eval/_has_active_iteration 会拾取旧迭代污染新尝试。
    """
    app = _app()
    key = _key()
    try:
        async with _client(app) as c:
            r = await c.post(
                "/routines",
                json={"key": key, "title": "Restart Leftover", "goal": "g", "acceptance_criteria": "a"},
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


async def test_restart_guards_and_reflection_reset():
    """重启守卫：仅 failed/cancelled 可重启；keep_reflections=False 清空反思；过期 deadline → 409。"""
    app = _app()
    key = _key()
    try:
        async with _client(app) as c:
            r = await c.post(
                "/routines",
                json={"key": key, "title": "Restart Guard", "goal": "g", "acceptance_criteria": "a"},
            )
            rid = r.json()["id"]
            # pending → 409
            assert (await c.post(f"/routines/{rid}/restart")).status_code == 409
            # running → 409
            await c.post(f"/routines/{rid}/start")
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
