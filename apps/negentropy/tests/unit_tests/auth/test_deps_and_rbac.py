import pytest
from fastapi import HTTPException
from starlette.requests import Request

from negentropy.auth.deps import (
    _extract_bearer_token,
    get_current_user,
    get_optional_user,
    require_admin,
    resolve_user_with_db_roles,
)
from negentropy.auth.rbac import (
    _match_permission,
    get_all_permissions,
    get_all_roles,
    get_user_permissions,
    has_permission,
    has_role,
    require_permission,
    require_role,
)
from negentropy.auth.service import AuthUser
from negentropy.auth.tokens import TokenError
from negentropy.config import settings
from negentropy.config.auth import AuthSettings


def _request(headers: dict[str, str] | None = None, cookies: dict[str, str] | None = None) -> Request:
    headers = headers or {}
    cookie_header = "; ".join(f"{key}={value}" for key, value in (cookies or {}).items())
    if cookie_header:
        headers = {**headers, "cookie": cookie_header}
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(key.lower().encode(), value.encode()) for key, value in headers.items()],
    }
    return Request(scope)


def test_extract_bearer_token_prefers_authorization_header(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "auth", AuthSettings(cookie_name="session"))

    request = _request(headers={"authorization": "Bearer abc"}, cookies={"session": "cookie-value"})

    assert _extract_bearer_token(request) == "abc"


def test_extract_bearer_token_falls_back_to_cookie(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "auth", AuthSettings(cookie_name="session"))

    request = _request(cookies={"session": "cookie-value"})

    assert _extract_bearer_token(request) == "cookie-value"


def test_get_current_user_returns_decoded_user(monkeypatch: pytest.MonkeyPatch) -> None:
    user = AuthUser(
        user_id="google:user",
        email="user@example.com",
        name="User",
        picture=None,
        roles=["user"],
        provider="google",
        subject="user",
        domain="example.com",
    )
    monkeypatch.setattr(
        "negentropy.auth.deps.AuthService.decode_session",
        lambda self, token: user,
    )

    assert get_current_user(_request(headers={"authorization": "Bearer token"})) == user


def test_get_current_user_raises_unauthorized_without_token() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(_request())

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "missing auth token"


def test_get_optional_user_returns_none_when_token_invalid(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "negentropy.auth.deps.AuthService.decode_session",
        lambda self, token: (_ for _ in ()).throw(TokenError("bad token")),
    )

    assert get_optional_user(_request(headers={"authorization": "Bearer token"})) is None


def test_match_permission_supports_wildcard() -> None:
    assert _match_permission("admin:*", "admin:read") is True
    assert _match_permission("users:read", "users:write") is False


def test_has_permission_and_has_role() -> None:
    assert has_permission(["user"], "chat:write") is True
    assert has_permission(["user"], "admin:write") is False
    assert has_role(["admin", "user"], "admin") is True


def test_require_permission_raises_for_missing_permission() -> None:
    checker = require_permission("admin:write")
    user = AuthUser("google:user", None, None, None, ["user"], "google", "user", None)

    with pytest.raises(HTTPException) as exc_info:
        checker(user)

    assert exc_info.value.status_code == 403


def test_require_role_raises_for_missing_role() -> None:
    checker = require_role("admin")
    user = AuthUser("google:user", None, None, None, ["user"], "google", "user", None)

    with pytest.raises(HTTPException) as exc_info:
        checker(user)

    assert exc_info.value.status_code == 403


def test_permission_and_role_catalog_helpers_return_copies() -> None:
    permissions = get_all_permissions()
    roles = get_all_roles()

    permissions["custom"] = "mutated"
    roles["admin"] = []

    assert "custom" not in get_all_permissions()
    assert get_all_roles()["admin"]


def test_get_user_permissions_expands_wildcards_and_sorts() -> None:
    assert get_user_permissions(["admin"]) == sorted(get_all_permissions().keys())
    assert "interface:write" in get_user_permissions(["user"])


# ============================================================================
# ISSUE-049：DB ``user_states`` 是 admin 角色的权威源（覆盖 JWT 快照）
# ============================================================================


def _make_user(*, user_id: str, roles: list[str]) -> AuthUser:
    return AuthUser(
        user_id=user_id,
        email="dummy@example.com",
        name="dummy",
        picture=None,
        roles=roles,
        provider="google",
        subject=user_id,
        domain=None,
    )


class _FakeUserState:
    def __init__(self, user_id: str, state: object) -> None:
        self.user_id = user_id
        self.state = state


class _FakeResult:
    def __init__(self, value: object | None) -> None:
        self._value = value

    def scalar_one_or_none(self) -> object | None:
        return self._value


class _FakeSession:
    def __init__(self, value: object | None) -> None:
        self._value = value

    async def __aenter__(self) -> "_FakeSession":
        return self

    async def __aexit__(self, *args: object) -> None:
        return None

    async def execute(self, *_args: object, **_kwargs: object) -> _FakeResult:
        return _FakeResult(self._value)


def _patch_db(monkeypatch: pytest.MonkeyPatch, user_state: object | None) -> None:
    """让 ``resolve_user_with_db_roles`` 看到指定的 UserState（或 None）。"""
    import negentropy.db.session as db_session

    monkeypatch.setattr(db_session, "AsyncSessionLocal", lambda: _FakeSession(user_state))


@pytest.mark.asyncio
async def test_resolve_user_with_db_roles_promotes_via_db(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """JWT roles=["user"] + DB roles=["user", "admin"] → 解析结果含 admin。

    覆盖核心修复：登录后管理员通过 PATCH /auth/users/{id}/roles 提升角色，但
    JWT 不会自动刷新；admin 端点必须以 DB 为权威否则 admin 调用持续 403。
    """
    state = _FakeUserState("alice", {"roles": ["user", "admin"]})
    _patch_db(monkeypatch, state)
    jwt_user = _make_user(user_id="alice", roles=["user"])

    resolved = await resolve_user_with_db_roles(jwt_user)
    assert "admin" in resolved.roles
    assert resolved.user_id == "alice"


@pytest.mark.asyncio
async def test_resolve_user_with_db_roles_falls_back_when_state_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """DB 中无 UserState 时保留 JWT roles，避免数据库故障误降权。"""
    _patch_db(monkeypatch, None)
    jwt_user = _make_user(user_id="bob", roles=["admin"])

    resolved = await resolve_user_with_db_roles(jwt_user)
    assert resolved.roles == ["admin"]


@pytest.mark.asyncio
async def test_resolve_user_with_db_roles_falls_back_on_db_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """DB 抛异常时保留 JWT roles（防御性兜底，避免临时故障让所有 admin 端点失败）。"""

    class _ExplodingSession:
        async def __aenter__(self) -> "_ExplodingSession":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def execute(self, *_args: object, **_kwargs: object) -> _FakeResult:
            raise RuntimeError("db down")

    import negentropy.db.session as db_session

    monkeypatch.setattr(db_session, "AsyncSessionLocal", lambda: _ExplodingSession())
    jwt_user = _make_user(user_id="alice", roles=["admin"])

    resolved = await resolve_user_with_db_roles(jwt_user)
    assert resolved.roles == ["admin"]


@pytest.mark.asyncio
async def test_require_admin_accepts_user_promoted_via_db(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """``require_admin`` 依赖应允许 JWT=user 但 DB=admin 的用户通过。"""
    state = _FakeUserState("alice", {"roles": ["user", "admin"]})
    _patch_db(monkeypatch, state)
    jwt_user = _make_user(user_id="alice", roles=["user"])

    resolved = await require_admin(jwt_user)
    assert "admin" in resolved.roles


@pytest.mark.asyncio
async def test_require_admin_rejects_when_neither_jwt_nor_db_admin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """JWT 与 DB 都不含 admin → 403。"""
    state = _FakeUserState("alice", {"roles": ["user"]})
    _patch_db(monkeypatch, state)
    jwt_user = _make_user(user_id="alice", roles=["user"])

    with pytest.raises(HTTPException) as exc_info:
        await require_admin(jwt_user)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_resolve_user_with_db_roles_handles_non_list_state_roles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """state.roles 不是 list（损坏的 state）→ 保留 JWT roles。"""
    state = _FakeUserState("alice", {"roles": "admin"})  # 字符串而非列表
    _patch_db(monkeypatch, state)
    jwt_user = _make_user(user_id="alice", roles=["user"])

    resolved = await resolve_user_with_db_roles(jwt_user)
    assert resolved.roles == ["user"]


@pytest.mark.asyncio
async def test_resolve_user_with_db_roles_returns_same_instance_when_unchanged(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """DB roles 与 JWT roles 完全一致时直接返回原 user，避免不必要分配。"""
    state = _FakeUserState("alice", {"roles": ["admin"]})
    _patch_db(monkeypatch, state)
    jwt_user = _make_user(user_id="alice", roles=["admin"])

    resolved = await resolve_user_with_db_roles(jwt_user)
    assert resolved is jwt_user
