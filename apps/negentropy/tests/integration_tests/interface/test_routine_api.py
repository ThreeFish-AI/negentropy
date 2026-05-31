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

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import delete

import negentropy.db.session as db_session
from negentropy.interface.routine_api import router
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
