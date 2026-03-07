import pytest
from fastapi import HTTPException
from starlette.requests import Request

from negentropy.auth.deps import _extract_bearer_token, get_current_user, get_optional_user
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
from negentropy.config.auth import AuthSettings
from negentropy.config import settings


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
    assert "plugins:write" in get_user_permissions(["user"])
