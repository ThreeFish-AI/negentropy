"""ISSUE-065: OAuth 重登录不再覆盖 DB 管理的角色。

角色权威源规则：
- 首次登录：使用 ``admin_emails`` 配置派生角色
- 后续登录：保留 DB ``user_states.state.roles``（管理面板 PATCH 设置的权威源）
"""

from typing import Any

import pytest

from negentropy.auth.service import AuthService, AuthUser
from negentropy.config import settings
from negentropy.config.auth import AuthSettings


def _make_user(
    *, user_id: str = "google:alice", email: str = "alice@example.com", roles: list[str] | None = None
) -> AuthUser:
    return AuthUser(
        user_id=user_id,
        email=email,
        name="Alice",
        picture=None,
        roles=roles or ["user"],
        provider="google",
        subject="sub-alice",
        domain="example.com",
    )


class _FakeUserState:
    def __init__(self, user_id: str, state: dict[str, Any]) -> None:
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

    def add(self, *_args: object, **_kwargs: object) -> None:
        return None

    async def commit(self) -> None:
        return None


def _patch_db(monkeypatch: pytest.MonkeyPatch, user_state: object | None) -> None:
    """替换 service 模块中已导入的 AsyncSessionLocal。"""
    monkeypatch.setattr(
        "negentropy.auth.service.AsyncSessionLocal",
        lambda: _FakeSession(user_state),
    )


def _claims(email: str = "alice@example.com") -> dict[str, Any]:
    return {"sub": "sub-alice", "email": email, "name": "Alice", "email_verified": True}


# ============================================================================
# 首次登录：config 派生角色
# ============================================================================


@pytest.mark.asyncio
async def test_new_user_gets_admin_role_from_config(monkeypatch: pytest.MonkeyPatch) -> None:
    """首次登录且 email 在 admin_emails 中 → 角色为 ["admin"]。"""
    _patch_db(monkeypatch, None)
    monkeypatch.setattr(settings, "auth", AuthSettings(admin_emails=["admin@example.com"]))

    service = AuthService()
    user = _make_user(email="admin@example.com", roles=["admin"])
    result = await service._upsert_user_state(user, _claims("admin@example.com"))

    assert result.roles == ["admin"]


@pytest.mark.asyncio
async def test_new_user_gets_user_role_when_not_in_config(monkeypatch: pytest.MonkeyPatch) -> None:
    """首次登录且 email 不在 admin_emails 中 → 角色为 ["user"]。"""
    _patch_db(monkeypatch, None)
    monkeypatch.setattr(settings, "auth", AuthSettings(admin_emails=["admin@example.com"]))

    service = AuthService()
    user = _make_user(email="alice@example.com", roles=["user"])
    result = await service._upsert_user_state(user, _claims("alice@example.com"))

    assert result.roles == ["user"]


# ============================================================================
# 已有用户重登录：保留 DB 角色（核心回归防护）
# ============================================================================


@pytest.mark.asyncio
async def test_existing_user_preserves_admin_role_on_relogin(monkeypatch: pytest.MonkeyPatch) -> None:
    """DB 中已设为 admin 的用户重登录 → 保留 admin 角色，不被 config 覆盖。"""
    db_state = _FakeUserState("google:alice", {"roles": ["admin"], "profile": {}, "auth": {}})
    _patch_db(monkeypatch, db_state)
    monkeypatch.setattr(settings, "auth", AuthSettings(admin_emails=[]))

    service = AuthService()
    user = _make_user(roles=["user"])
    result = await service._upsert_user_state(user, _claims())

    assert result.roles == ["admin"]


@pytest.mark.asyncio
async def test_config_admin_is_non_negotiable_over_db_user(monkeypatch: pytest.MonkeyPatch) -> None:
    """DB 中角色为 user、config 中为 admin → config 级 admin 不可被 DB 降级。"""
    db_state = _FakeUserState("google:alice", {"roles": ["user"], "profile": {}, "auth": {}})
    _patch_db(monkeypatch, db_state)
    monkeypatch.setattr(settings, "auth", AuthSettings(admin_emails=["alice@example.com"]))

    service = AuthService()
    user = _make_user(roles=["admin"])
    result = await service._upsert_user_state(user, _claims())

    assert result.roles == ["admin"]


# ============================================================================
# 边缘 Case
# ============================================================================


@pytest.mark.asyncio
async def test_corrupted_db_roles_falls_back_to_config(monkeypatch: pytest.MonkeyPatch) -> None:
    """DB state.roles 为非列表（损坏数据）→ 回退到 config 派生角色。"""
    db_state = _FakeUserState("google:alice", {"roles": "admin", "profile": {}, "auth": {}})
    _patch_db(monkeypatch, db_state)

    service = AuthService()
    user = _make_user(roles=["user"])
    result = await service._upsert_user_state(user, _claims())

    assert result.roles == ["user"]


@pytest.mark.asyncio
async def test_same_roles_returns_same_instance(monkeypatch: pytest.MonkeyPatch) -> None:
    """config 派生角色与 DB 角色一致 → 返回同一 AuthUser 实例。"""
    db_state = _FakeUserState("google:alice", {"roles": ["user"], "profile": {}, "auth": {}})
    _patch_db(monkeypatch, db_state)

    service = AuthService()
    user = _make_user(roles=["user"])
    result = await service._upsert_user_state(user, _claims())

    assert result is user


# ============================================================================
# Config 级 Admin 不可降级保护
# ============================================================================


@pytest.mark.asyncio
async def test_config_admin_protects_new_user_with_lost_db_record(monkeypatch: pytest.MonkeyPatch) -> None:
    """DB 记录丢失 + config admin → 新用户仍获得 admin（根因回归）。"""
    _patch_db(monkeypatch, None)
    monkeypatch.setattr(settings, "auth", AuthSettings(admin_emails=["admin@example.com"]))

    service = AuthService()
    user = _make_user(email="admin@example.com", roles=["admin"])
    result = await service._upsert_user_state(user, _claims("admin@example.com"))

    assert result.roles == ["admin"]


@pytest.mark.asyncio
async def test_config_admin_protects_against_corrupted_db_roles(monkeypatch: pytest.MonkeyPatch) -> None:
    """DB roles 损坏（非列表）+ config admin → config 级 admin 仍生效。"""
    db_state = _FakeUserState("google:alice", {"roles": "corrupted", "profile": {}, "auth": {}})
    _patch_db(monkeypatch, db_state)
    monkeypatch.setattr(settings, "auth", AuthSettings(admin_emails=["alice@example.com"]))

    service = AuthService()
    user = _make_user(roles=["admin"])
    result = await service._upsert_user_state(user, _claims())

    assert result.roles == ["admin"]
