"""knowledge 写端点鉴权覆盖门（I-245）。

两层断言：
1. 覆盖门：全部写方法端点要么挂 ``require_knowledge_write``，要么在 ``WRITE_GUARD_EXEMPT`` 显式豁免；
   新增写端点忘挂守卫即失败（默认拒绝）。
2. 守卫行为：optional 模式下匿名 401、user 角色 403、admin 放行、service token 放行、mode=off 放行。
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from negentropy.auth import deps as auth_deps
from negentropy.auth.service import AuthUser
from negentropy.config.auth import AuthMode
from negentropy.knowledge import api as knowledge_api

_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _write_routes() -> list[APIRoute]:
    return [r for r in knowledge_api.router.routes if isinstance(r, APIRoute) and r.methods & _WRITE_METHODS]


def _has_guard(route: APIRoute) -> bool:
    return any(dep.call is auth_deps.require_knowledge_write for dep in route.dependant.dependencies)


def test_every_write_route_is_guarded_or_explicitly_exempt() -> None:
    unguarded = []
    for route in _write_routes():
        for method in route.methods & _WRITE_METHODS:
            if (method, route.path) in knowledge_api.WRITE_GUARD_EXEMPT:
                continue
            if not _has_guard(route):
                unguarded.append(f"{method} {route.path}")
    assert not unguarded, f"写端点未挂 knowledge:write 守卫且不在豁免清单：{unguarded}"


def test_exempt_entries_all_exist_and_carry_reason() -> None:
    present = {(m, r.path) for r in _write_routes() for m in r.methods & _WRITE_METHODS}
    stale = [key for key in knowledge_api.WRITE_GUARD_EXEMPT if key not in present]
    assert not stale, f"豁免清单含已不存在的端点：{stale}"
    assert all(reason.strip() for reason in knowledge_api.WRITE_GUARD_EXEMPT.values())


def test_exempt_routes_are_not_guarded() -> None:
    for route in _write_routes():
        if all((m, route.path) in knowledge_api.WRITE_GUARD_EXEMPT for m in route.methods & _WRITE_METHODS):
            assert not _has_guard(route), f"豁免端点被误挂守卫：{route.path}"


def test_guard_injected_once_per_route() -> None:
    for route in _write_routes():
        count = sum(dep.call is auth_deps.require_knowledge_write for dep in route.dependant.dependencies)
        assert count <= 1, f"守卫重复注入：{route.path}"


# ---------------------------------------------------------------------------
# 守卫行为
# ---------------------------------------------------------------------------


def _user(roles: list[str]) -> AuthUser:
    return AuthUser(
        user_id="u-1",
        email="u@example.com",
        name="U",
        picture=None,
        roles=roles,
        provider="google",
        subject="u-1",
        domain=None,
    )


@pytest.fixture
def guarded_client(monkeypatch):
    monkeypatch.setattr(
        auth_deps,
        "settings",
        SimpleNamespace(auth=SimpleNamespace(enabled=True, mode=AuthMode.OPTIONAL, cookie_name="ne_sso")),
    )

    async def _db_roles_passthrough(user: AuthUser) -> AuthUser:
        return user

    monkeypatch.setattr(auth_deps, "resolve_user_with_db_roles", _db_roles_passthrough)

    app = FastAPI()

    from fastapi import Depends

    @app.post("/probe")
    async def probe(_=Depends(auth_deps.require_knowledge_write)) -> dict[str, bool]:
        return {"ok": True}

    return app, monkeypatch


def _set_token_user(monkeypatch, roles: list[str] | None) -> None:
    def _fake_current_user(request):
        if roles is None:
            raise auth_deps.HTTPException(status_code=401, detail="missing auth token")
        return _user(roles)

    monkeypatch.setattr(auth_deps, "get_current_user", _fake_current_user)


def test_anonymous_write_is_rejected_401(guarded_client) -> None:
    app, mp = guarded_client
    _set_token_user(mp, None)
    assert TestClient(app).post("/probe").status_code == 401


def test_user_role_write_is_forbidden_403(guarded_client) -> None:
    app, mp = guarded_client
    _set_token_user(mp, ["user"])
    resp = TestClient(app).post("/probe")
    assert resp.status_code == 403
    assert "knowledge:write" in resp.json()["detail"]


def test_admin_write_is_allowed(guarded_client) -> None:
    app, mp = guarded_client
    _set_token_user(mp, ["admin"])
    assert TestClient(app).post("/probe").status_code == 200


def test_service_token_write_is_allowed(guarded_client) -> None:
    app, mp = guarded_client
    _set_token_user(mp, None)
    headers = {auth_deps.SERVICE_TOKEN_HEADER: auth_deps.get_knowledge_service_token()}
    assert TestClient(app).post("/probe", headers=headers).status_code == 200


def test_wrong_service_token_is_rejected(guarded_client) -> None:
    app, mp = guarded_client
    _set_token_user(mp, None)
    headers = {auth_deps.SERVICE_TOKEN_HEADER: "forged"}
    assert TestClient(app).post("/probe", headers=headers).status_code == 401


@pytest.mark.parametrize("enabled,mode", [(False, AuthMode.OPTIONAL), (True, AuthMode.OFF)])
def test_auth_disabled_allows_write(guarded_client, enabled, mode) -> None:
    app, mp = guarded_client
    mp.setattr(
        auth_deps,
        "settings",
        SimpleNamespace(auth=SimpleNamespace(enabled=enabled, mode=mode, cookie_name="ne_sso")),
    )
    _set_token_user(mp, None)
    assert TestClient(app).post("/probe").status_code == 200


def test_guarded_knowledge_route_rejects_anonymous_end_to_end(monkeypatch) -> None:
    """真实 knowledge 路由（DELETE corpus）经聚合 router：匿名在业务逻辑前即被 401 拦截。"""
    monkeypatch.setattr(
        auth_deps,
        "settings",
        SimpleNamespace(auth=SimpleNamespace(enabled=True, mode=AuthMode.OPTIONAL, cookie_name="ne_sso")),
    )
    _set_token_user(monkeypatch, None)
    app = FastAPI()
    app.include_router(knowledge_api.router)
    resp = TestClient(app).delete("/knowledge/base/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 401
