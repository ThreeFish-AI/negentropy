"""Interface API 路由级集成测试 — 鉴权 sweep + 四域 CRUD 冒烟 + reorder 可达性。

背景：interface/api.py（拆分前 3197 行）的 MCP/Skills/Agents/Permissions CRUD
长期零路由测试。本文件在机械拆分前建立行为基线：
- 鉴权 sweep：全部 50 路由无凭证调用必须 401（鉴权在位性）；
- CRUD 冒烟：mcp_server / builtin_tool / skill / agent 四域 create→get→patch→delete
  生命周期 + 404 语义（真实 Postgres）；
- reorder 可达性：四域 PATCH reorder 空清单必须 200（历史缺陷：三域被 {id}
  路由遮蔽返回 422，handler 不可达——本组用例即该缺陷的暴露测试）。
"""

from __future__ import annotations

import uuid

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import delete

import negentropy.db.session as db_session
from negentropy.auth.deps import get_current_user
from negentropy.auth.service import AuthUser
from negentropy.interface.api import router
from negentropy.models.agent import Agent
from negentropy.models.builtin_tool import BuiltinTool
from negentropy.models.mcp import McpServer
from negentropy.models.skill import Skill

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def _patch_interface_api_session(patch_db_globals, monkeypatch):
    """api.py 以 `from negentropy.db.session import AsyncSessionLocal` 直绑名字，
    conftest 对 db.session 模块属性的 patch 影响不到它；这里把直绑名字同样指到
    函数级测试会话工厂，避免全局引擎连接池跨事件循环复用。"""
    import negentropy.interface.api as interface_api

    monkeypatch.setattr(interface_api, "AsyncSessionLocal", db_session.AsyncSessionLocal)


_DUMMY_UUID = "00000000-0000-0000-0000-000000000000"


def _user() -> AuthUser:
    return AuthUser(
        user_id="itest_ifc_user",
        email=None,
        name=None,
        picture=None,
        roles=["user"],
        provider="test",
        subject="itest_ifc_user",
        domain=None,
    )


def _app(*, authed: bool) -> FastAPI:
    app = FastAPI()
    app.include_router(router)
    if authed:
        app.dependency_overrides[get_current_user] = _user
    return app


def _client(app: FastAPI) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


def _tag() -> str:
    return f"itest_ifc_{uuid.uuid4().hex[:8]}"


async def _cleanup(tag: str) -> None:
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(Agent).where(Agent.name.like(f"{tag}%")))
        await db.execute(delete(Skill).where(Skill.name.like(f"{tag}%")))
        await db.execute(delete(BuiltinTool).where(BuiltinTool.name.like(f"{tag}%")))
        await db.execute(delete(McpServer).where(McpServer.name.like(f"{tag}%")))
        await db.commit()


# ── 鉴权 sweep：无凭证 → 401 ──────────────────────────────────────────────

_SWEEP_CASES = [
    ("GET", "/interface/stats"),
    ("GET", "/interface/mcp/servers"),
    ("POST", "/interface/mcp/servers"),
    ("GET", f"/interface/mcp/servers/{_DUMMY_UUID}"),
    ("PATCH", f"/interface/mcp/servers/{_DUMMY_UUID}"),
    ("DELETE", f"/interface/mcp/servers/{_DUMMY_UUID}"),
    ("PATCH", "/interface/mcp/servers/reorder"),
    ("POST", f"/interface/mcp/servers/{_DUMMY_UUID}/tools:load"),
    ("GET", f"/interface/mcp/servers/{_DUMMY_UUID}/tools"),
    ("GET", f"/interface/mcp/servers/{_DUMMY_UUID}/resource-templates"),
    ("PATCH", f"/interface/mcp/servers/{_DUMMY_UUID}/tools/{_DUMMY_UUID}"),
    ("POST", f"/interface/mcp/servers/{_DUMMY_UUID}/tools:execute"),
    ("GET", f"/interface/mcp/servers/{_DUMMY_UUID}/runs"),
    ("GET", f"/interface/mcp/runs/{_DUMMY_UUID}"),
    ("GET", "/interface/tools/available"),
    ("GET", "/interface/tools"),
    ("POST", "/interface/tools"),
    ("GET", f"/interface/tools/{_DUMMY_UUID}"),
    ("PATCH", f"/interface/tools/{_DUMMY_UUID}"),
    ("DELETE", f"/interface/tools/{_DUMMY_UUID}"),
    ("PATCH", "/interface/tools/reorder"),
    ("GET", "/interface/skills"),
    ("POST", "/interface/skills"),
    ("GET", "/interface/skills/templates"),
    ("POST", "/interface/skills/from-template"),
    ("GET", f"/interface/skills/{_DUMMY_UUID}"),
    ("PATCH", f"/interface/skills/{_DUMMY_UUID}"),
    ("GET", f"/interface/skills/{_DUMMY_UUID}/versions"),
    ("POST", f"/interface/skills/{_DUMMY_UUID}/versions"),
    ("GET", f"/interface/skills/{_DUMMY_UUID}/schedules"),
    ("POST", f"/interface/skills/{_DUMMY_UUID}/schedules"),
    ("DELETE", f"/interface/skills/{_DUMMY_UUID}/schedules/{_DUMMY_UUID}"),
    ("POST", f"/interface/skills/{_DUMMY_UUID}/schedules/{_DUMMY_UUID}/run"),
    ("DELETE", f"/interface/skills/{_DUMMY_UUID}"),
    ("PATCH", "/interface/skills/reorder"),
    ("POST", f"/interface/skills/{_DUMMY_UUID}/invoke"),
    ("GET", "/interface/agents"),
    ("PATCH", "/interface/agents/reorder"),
    ("GET", "/interface/agents/templates/negentropy"),
    ("POST", "/interface/agents/sync/negentropy"),
    ("POST", "/interface/agents"),
    ("GET", f"/interface/agents/{_DUMMY_UUID}"),
    ("PATCH", f"/interface/agents/{_DUMMY_UUID}"),
    ("DELETE", f"/interface/agents/{_DUMMY_UUID}"),
    ("GET", f"/interface/skill/{_DUMMY_UUID}/permissions"),  # plugin_type=skill 字面量
    ("POST", f"/interface/skill/{_DUMMY_UUID}/permissions"),
    ("DELETE", f"/interface/skill/{_DUMMY_UUID}/permissions/u1"),
]


@pytest.mark.parametrize(("method", "path"), _SWEEP_CASES)
async def test_routes_require_auth(method: str, path: str) -> None:
    app = _app(authed=False)
    async with _client(app) as c:
        resp = await c.request(method, path, json={})
        assert resp.status_code == 401, f"{method} {path} 无凭证应 401，实际 {resp.status_code}"


# ── CRUD 冒烟（真实 Postgres）──────────────────────────────────────────────


async def test_mcp_server_crud_lifecycle() -> None:
    tag = _tag()
    try:
        app = _app(authed=True)
        async with _client(app) as c:
            created = await c.post(
                "/interface/mcp/servers",
                json={"name": tag, "transport_type": "http", "url": "https://example.com/mcp"},
            )
            assert created.status_code == 201, created.text
            server_id = created.json()["id"]

            got = await c.get(f"/interface/mcp/servers/{server_id}")
            assert got.status_code == 200 and got.json()["name"] == tag

            patched = await c.patch(f"/interface/mcp/servers/{server_id}", json={"display_name": f"{tag}-d"})
            assert patched.status_code == 200 and patched.json()["display_name"] == f"{tag}-d"

            listed = await c.get("/interface/mcp/servers")
            assert listed.status_code == 200
            assert any(s["id"] == server_id for s in listed.json())

            deleted = await c.delete(f"/interface/mcp/servers/{server_id}")
            assert deleted.status_code == 204
            # 删除后不可见：可见性过滤先于 404 命中，返回 403（存在性隐藏语义）
            assert (await c.get(f"/interface/mcp/servers/{server_id}")).status_code == 403
    finally:
        await _cleanup(tag)


async def test_builtin_tool_crud_lifecycle() -> None:
    tag = _tag()
    try:
        app = _app(authed=True)
        async with _client(app) as c:
            created = await c.post("/interface/tools", json={"name": tag, "tool_type": "search"})
            assert created.status_code == 201, created.text
            tool_id = created.json()["id"]

            got = await c.get(f"/interface/tools/{tool_id}")
            assert got.status_code == 200 and got.json()["name"] == tag

            patched = await c.patch(f"/interface/tools/{tool_id}", json={"description": "d"})
            assert patched.status_code == 200

            deleted = await c.delete(f"/interface/tools/{tool_id}")
            assert deleted.status_code == 204
            # 删除后不可见：可见性过滤先于 404 命中，返回 403（存在性隐藏语义）
            assert (await c.get(f"/interface/tools/{tool_id}")).status_code == 403
    finally:
        await _cleanup(tag)


async def test_skill_crud_lifecycle() -> None:
    tag = _tag()
    try:
        app = _app(authed=True)
        async with _client(app) as c:
            created = await c.post("/interface/skills", json={"name": tag, "prompt_template": "做一件小事"})
            assert created.status_code == 201, created.text
            skill_id = created.json()["id"]

            got = await c.get(f"/interface/skills/{skill_id}")
            assert got.status_code == 200 and got.json()["name"] == tag

            patched = await c.patch(f"/interface/skills/{skill_id}", json={"description": "d"})
            assert patched.status_code == 200

            deleted = await c.delete(f"/interface/skills/{skill_id}")
            assert deleted.status_code == 204
            # 删除后不可见：可见性过滤先于 404 命中，返回 403（存在性隐藏语义）
            assert (await c.get(f"/interface/skills/{skill_id}")).status_code == 403
    finally:
        await _cleanup(tag)


async def test_agent_crud_lifecycle() -> None:
    tag = _tag()
    try:
        app = _app(authed=True)
        async with _client(app) as c:
            created = await c.post("/interface/agents", json={"name": tag, "agent_type": "llm_agent"})
            assert created.status_code == 201, created.text
            agent_id = created.json()["id"]

            got = await c.get(f"/interface/agents/{agent_id}")
            assert got.status_code == 200 and got.json()["name"] == tag

            patched = await c.patch(f"/interface/agents/{agent_id}", json={"description": "d"})
            assert patched.status_code == 200

            deleted = await c.delete(f"/interface/agents/{agent_id}")
            assert deleted.status_code == 204
            # 删除后不可见：可见性过滤先于 404 命中，返回 403（存在性隐藏语义）
            assert (await c.get(f"/interface/agents/{agent_id}")).status_code == 403
    finally:
        await _cleanup(tag)


# ── reorder 可达性（历史缺陷暴露组）───────────────────────────────────────
# B5 交付时 mcp/tools/skills 三组为红（422 遮蔽），B6 修复后全绿。


async def test_mcp_servers_reorder_reachable() -> None:
    app = _app(authed=True)
    async with _client(app) as c:
        resp = await c.patch("/interface/mcp/servers/reorder", json={"items": []})
        assert resp.status_code == 200, (
            f"reorder 请求异常（可能被 {'server_id'} 类参数路由遮蔽）：{resp.status_code} {resp.text}"
        )


async def test_builtin_tools_reorder_reachable() -> None:
    app = _app(authed=True)
    async with _client(app) as c:
        resp = await c.patch("/interface/tools/reorder", json={"items": []})
        assert resp.status_code == 200, f"{resp.status_code} {resp.text}"


async def test_skills_reorder_reachable() -> None:
    app = _app(authed=True)
    async with _client(app) as c:
        resp = await c.patch("/interface/skills/reorder", json={"items": []})
        assert resp.status_code == 200, f"{resp.status_code} {resp.text}"


async def test_agents_reorder_reachable() -> None:
    app = _app(authed=True)
    async with _client(app) as c:
        resp = await c.patch("/interface/agents/reorder", json={"items": []})
        assert resp.status_code == 200, f"{resp.status_code} {resp.text}"
