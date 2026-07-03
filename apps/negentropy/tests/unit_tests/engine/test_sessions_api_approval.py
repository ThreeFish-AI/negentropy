"""submit_approval_response 端点单测（审批弹窗卡死修复）。

锁定契约：端点在记录决策的同一个 ``state_delta`` 内**权威清除** ``pending_approvals``
中对应的 ``action_id``。这是决策场景下的单一事实源清除点——无论是否有存活工具正在
``consume`` (工具可能已超时返回、run 已结束、NDJSON 流已关闭)，前端经
``scheduleSessionHydration`` 重取时都能拿到「已清除」的快照，弹窗随之关闭。

用假 session service（monkeypatch ``get_session_service``）隔离 DB，纯校验路由层对
``state_delta`` 的构造，不依赖 Postgres 写入链路。
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient


class _FakeSession:
    def __init__(self, state: dict[str, Any] | None) -> None:
        self.state = state
        self.id = "s1"
        self.app_name = "negentropy"
        self.user_id = "u1"


class _FakeSessionService:
    """最小 session service — 记录 append 的事件，供断言 state_delta。"""

    def __init__(self, session: _FakeSession | None) -> None:
        self._session = session
        self.appended: list[Any] = []

    async def get_session(self, *, app_name: str, user_id: str, session_id: str) -> Any:
        return self._session

    async def append_event(self, *, session: Any, event: Any) -> Any:
        self.appended.append(event)
        return event


def _client(monkeypatch, service: _FakeSessionService) -> TestClient:
    from negentropy.engine import sessions_api

    monkeypatch.setattr(sessions_api, "get_session_service", lambda: service)
    app = FastAPI()
    app.include_router(sessions_api.router)
    return TestClient(app)


def test_submit_approval_response_clears_pending_and_keeps_others(monkeypatch):
    aid = "approval:ingest_paper:abcd1234"
    other = "approval:write_file:eeee5678"
    state = {
        "pending_approvals": {aid: {"action_id": aid}, other: {"action_id": other}},
        "approval_responses": {},
    }
    service = _FakeSessionService(_FakeSession(state))
    client = _client(monkeypatch, service)

    resp = client.post(
        "/apps/negentropy/users/u1/sessions/s1/approval_response",
        json={"action_id": aid, "decision": "approved", "reason": "looks good"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["action_id"] == aid
    assert body["decision"] == "approved"

    # 恰好一个 append_event，delta 同时含决策与「过滤掉该 action_id」的 pending。
    assert len(service.appended) == 1
    delta = service.appended[0].actions.state_delta
    # 权威清除：目标 action_id 不再在 pending 中，其余项保留。
    assert delta["pending_approvals"] == {other: {"action_id": other}}
    # 决策写回 approval_responses（存活工具 consume 仍可读）。
    assert aid in delta["approval_responses"]
    assert delta["approval_responses"][aid]["decision"] == "approved"
    assert delta["approval_responses"][aid]["reason"] == "looks good"


def test_submit_approval_response_denied_also_clears_pending(monkeypatch):
    aid = "approval:send_email:c0ffee00"
    state = {"pending_approvals": {aid: {"action_id": aid}}}
    service = _FakeSessionService(_FakeSession(state))
    client = _client(monkeypatch, service)

    resp = client.post(
        "/apps/negentropy/users/u1/sessions/s1/approval_response",
        json={"action_id": aid, "decision": "denied"},
    )

    assert resp.status_code == 200
    delta = service.appended[0].actions.state_delta
    # 拒绝同样清除 pending（弹窗关闭），responses 记录 denied。
    assert delta["pending_approvals"] == {}
    assert delta["approval_responses"][aid]["decision"] == "denied"


def test_submit_approval_response_missing_pending_emits_empty(monkeypatch):
    """state 无 pending_approvals 时不报错，emit 空 dict（浅合并语义安全）。"""
    aid = "approval:write_file:11112222"
    service = _FakeSessionService(_FakeSession({}))
    client = _client(monkeypatch, service)

    resp = client.post(
        "/apps/negentropy/users/u1/sessions/s1/approval_response",
        json={"action_id": aid, "decision": "approved"},
    )

    assert resp.status_code == 200
    delta = service.appended[0].actions.state_delta
    assert delta["pending_approvals"] == {}
    assert aid in delta["approval_responses"]


def test_submit_approval_response_404_when_session_missing(monkeypatch):
    service = _FakeSessionService(None)
    client = _client(monkeypatch, service)

    resp = client.post(
        "/apps/negentropy/users/u1/sessions/missing/approval_response",
        json={"action_id": "approval:x:1", "decision": "approved"},
    )

    assert resp.status_code == 404
    assert service.appended == []


def test_submit_approval_response_rejects_invalid_decision(monkeypatch):
    """decision 非 approved/denied 时 Pydantic 校验返回 422（不写状态）。"""
    service = _FakeSessionService(_FakeSession({"pending_approvals": {}}))
    client = _client(monkeypatch, service)

    resp = client.post(
        "/apps/negentropy/users/u1/sessions/s1/approval_response",
        json={"action_id": "approval:x:1", "decision": "maybe"},
    )

    assert resp.status_code == 422
    assert service.appended == []
