from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from negentropy.auth.middleware import AuthMiddleware
from negentropy.auth.service import AuthUser
from negentropy.auth.tokens import TokenError
from negentropy.config import settings
from negentropy.config.auth import AuthMode, AuthSettings


def _build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(AuthMiddleware)

    @app.get("/secure")
    async def secure(request: Request) -> JSONResponse:
        user = getattr(request.state, "user", None)
        return JSONResponse({"user_id": getattr(user, "user_id", None)})

    @app.post("/users/{user_id}/sync")
    async def sync_user(user_id: str, request: Request) -> JSONResponse:
        user = getattr(request.state, "user", None)
        body = await request.json()
        return JSONResponse(
            {
                "route_user_id": user_id,
                "body_user_id": body.get("user_id"),
                "auth_user_id": getattr(user, "user_id", None),
            }
        )

    @app.get("/health")
    async def health() -> JSONResponse:
        return JSONResponse({"status": "ok"})

    return app


def _user(user_id: str, roles: list[str] | None = None) -> AuthUser:
    return AuthUser(
        user_id=user_id,
        email="user@example.com",
        name="User",
        picture=None,
        roles=roles or ["user"],
        provider="google",
        subject=user_id,
        domain="example.com",
    )


def test_middleware_bypasses_when_auth_disabled(monkeypatch) -> None:
    monkeypatch.setattr(settings, "auth", AuthSettings(enabled=False, mode=AuthMode.STRICT))

    with TestClient(_build_app()) as client:
        response = client.get("/secure")

    assert response.status_code == 200
    assert response.json() == {"user_id": None}


def test_middleware_returns_401_in_strict_mode_without_token(monkeypatch) -> None:
    monkeypatch.setattr(settings, "auth", AuthSettings(enabled=True, mode=AuthMode.STRICT))

    with TestClient(_build_app()) as client:
        response = client.get("/secure")

    assert response.status_code == 401
    assert response.json() == {"error": "missing auth token"}


def test_middleware_allows_missing_token_in_optional_mode(monkeypatch) -> None:
    monkeypatch.setattr(settings, "auth", AuthSettings(enabled=True, mode=AuthMode.OPTIONAL))

    with TestClient(_build_app()) as client:
        response = client.get("/secure")

    assert response.status_code == 200
    assert response.json() == {"user_id": None}


def test_middleware_sets_request_user_when_token_valid(monkeypatch) -> None:
    monkeypatch.setattr(settings, "auth", AuthSettings(enabled=True, mode=AuthMode.STRICT))
    monkeypatch.setattr(
        "negentropy.auth.middleware.AuthService.decode_session",
        lambda self, token: _user("google:user"),
    )

    with TestClient(_build_app()) as client:
        response = client.get("/secure", headers={"authorization": "Bearer token"})

    assert response.status_code == 200
    assert response.json() == {"user_id": "google:user"}


def test_middleware_rejects_invalid_token_in_strict_mode(monkeypatch) -> None:
    monkeypatch.setattr(settings, "auth", AuthSettings(enabled=True, mode=AuthMode.STRICT))
    monkeypatch.setattr(
        "negentropy.auth.middleware.AuthService.decode_session",
        lambda self, token: (_ for _ in ()).throw(TokenError("invalid auth token")),
    )

    with TestClient(_build_app()) as client:
        response = client.get("/secure", headers={"authorization": "Bearer token"})

    assert response.status_code == 401
    assert response.json() == {"error": "invalid auth token"}


def test_middleware_rejects_user_id_mismatch_for_non_admin(monkeypatch) -> None:
    monkeypatch.setattr(settings, "auth", AuthSettings(enabled=True, mode=AuthMode.STRICT))
    monkeypatch.setattr(
        "negentropy.auth.middleware.AuthService.decode_session",
        lambda self, token: _user("google:owner", ["user"]),
    )

    with TestClient(_build_app()) as client:
        response = client.post(
            "/users/google:other/sync",
            headers={"authorization": "Bearer token", "content-type": "application/json"},
            json={"user_id": "google:other"},
        )

    assert response.status_code == 403
    assert response.json() == {"error": "user_id mismatch"}


def test_middleware_allows_user_id_mismatch_for_admin(monkeypatch) -> None:
    monkeypatch.setattr(settings, "auth", AuthSettings(enabled=True, mode=AuthMode.STRICT))
    monkeypatch.setattr(
        "negentropy.auth.middleware.AuthService.decode_session",
        lambda self, token: _user("google:admin", ["admin"]),
    )

    with TestClient(_build_app()) as client:
        response = client.post(
            "/users/google:other/sync",
            headers={"authorization": "Bearer token", "content-type": "application/json"},
            json={"user_id": "google:other"},
        )

    assert response.status_code == 200
    assert response.json()["auth_user_id"] == "google:admin"


def test_middleware_allows_allowlist_paths(monkeypatch) -> None:
    monkeypatch.setattr(settings, "auth", AuthSettings(enabled=True, mode=AuthMode.STRICT))

    with TestClient(_build_app()) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
