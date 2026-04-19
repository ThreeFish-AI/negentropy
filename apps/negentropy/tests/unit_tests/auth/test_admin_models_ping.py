"""`/auth/admin/models/ping` 端点行为单元测试。

覆盖：
- OpenAI / Anthropic / Gemini 三家 vendor 的 kwargs 透传（drop_params / thinking / api_base / api_key）；
- 表单覆盖 vs vendor_configs DB 回退优先级；
- api_base 末尾 `/chat/completions` 等冗余后缀在传入 LiteLLM 前被规范化；
- 异常路径的中文文案分类（401 / 404 / timeout / 其他）；
- 非 admin 角色的 403 拦截。

litellm.acompletion 被 monkeypatch 为 async mock，避免真实网络出口。
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from negentropy.auth.api import router as auth_router
from negentropy.auth.deps import get_current_user
from negentropy.auth.service import AuthUser


def _user(roles: list[str]) -> AuthUser:
    return AuthUser(
        user_id="google:user",
        email="user@example.com",
        name="User",
        picture=None,
        roles=roles,
        provider="google",
        subject="user",
        domain="example.com",
    )


def _build_app(user: AuthUser) -> FastAPI:
    app = FastAPI()
    app.include_router(auth_router)

    def _dep() -> AuthUser:
        return user

    app.dependency_overrides[get_current_user] = _dep
    return app


def _mock_response(content: str = "pong hello") -> MagicMock:
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = content
    return response


class _SuccessAcompletion:
    """异步 mock：记录每次 kwargs 并返回固定 pong 响应。"""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def __call__(self, *args: Any, **kwargs: Any) -> MagicMock:
        self.calls.append({"args": args, "kwargs": kwargs})
        return _mock_response()


class _RaisingAcompletion:
    def __init__(self, exc: BaseException) -> None:
        self._exc = exc

    async def __call__(self, *args: Any, **kwargs: Any) -> MagicMock:
        raise self._exc


def _patch_acompletion(monkeypatch: pytest.MonkeyPatch, impl: Callable[..., Any]) -> None:
    import litellm

    monkeypatch.setattr(litellm, "acompletion", impl)


def _patch_no_db_vendor_config(monkeypatch: pytest.MonkeyPatch) -> None:
    """令 DB 回退路径总是返回 None —— 用于确保当表单提供 api_key 时 DB 不被命中。

    保险起见，把 AsyncSessionLocal 替换为一个会抛异常的哑对象；
    端点内有 try/except 会静默吞掉，表现为「DB 无记录」。
    """

    class _Boom:
        def __call__(self) -> Any:
            raise RuntimeError("DB disabled in unit test")

    monkeypatch.setattr("negentropy.auth.api.AsyncSessionLocal", _Boom())


# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------


class TestPingOpenAI:
    def test_success_passes_drop_params_and_credentials(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _patch_no_db_vendor_config(monkeypatch)
        mock = _SuccessAcompletion()
        _patch_acompletion(monkeypatch, mock)

        app = _build_app(_user(["admin"]))
        with TestClient(app) as client:
            resp = client.post(
                "/auth/admin/models/ping",
                json={
                    "vendor": "openai",
                    "model_name": "gpt-5-mini",
                    "api_key": "sk-test",
                    "api_base": "http://llms.as-in.io/v1",
                },
            )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "ok"
        assert "Pong!" in body["message"]
        assert "latency_ms" in body

        assert len(mock.calls) == 1
        kwargs = mock.calls[0]["kwargs"]
        assert kwargs["model"] == "openai/gpt-5-mini"
        assert kwargs["drop_params"] is True
        assert kwargs["api_key"] == "sk-test"
        assert kwargs["api_base"] == "http://llms.as-in.io/v1"
        assert kwargs["max_tokens"] == 20
        assert "temperature" not in kwargs
        assert "reasoning_effort" not in kwargs

    def test_api_base_suffix_is_normalized(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _patch_no_db_vendor_config(monkeypatch)
        mock = _SuccessAcompletion()
        _patch_acompletion(monkeypatch, mock)

        app = _build_app(_user(["admin"]))
        with TestClient(app) as client:
            resp = client.post(
                "/auth/admin/models/ping",
                json={
                    "vendor": "openai",
                    "model_name": "gpt-5-mini",
                    "api_key": "sk",
                    "api_base": "http://llms.as-in.io/v1/chat/completions",
                },
            )

        assert resp.status_code == 200
        assert mock.calls[0]["kwargs"]["api_base"] == "http://llms.as-in.io/v1"

    def test_404_maps_to_chinese_model_not_found(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _patch_no_db_vendor_config(monkeypatch)
        exc = RuntimeError("litellm.NotFoundError: OpenAIException - Error code: 404 - resource not found")
        _patch_acompletion(monkeypatch, _RaisingAcompletion(exc))

        app = _build_app(_user(["admin"]))
        with TestClient(app) as client:
            resp = client.post(
                "/auth/admin/models/ping",
                json={
                    "vendor": "openai",
                    "model_name": "gpt-5-mini",
                    "api_key": "sk",
                    "api_base": "http://x/v1",
                },
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "error"
        assert "模型未找到" in body["message"]

    def test_401_maps_to_chinese_auth_failure(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _patch_no_db_vendor_config(monkeypatch)
        exc = RuntimeError("AuthenticationError: 401 unauthorized key")
        _patch_acompletion(monkeypatch, _RaisingAcompletion(exc))

        app = _build_app(_user(["admin"]))
        with TestClient(app) as client:
            resp = client.post(
                "/auth/admin/models/ping",
                json={
                    "vendor": "openai",
                    "model_name": "gpt-5-mini",
                    "api_key": "sk-bad",
                },
            )

        body = resp.json()
        assert body["status"] == "error"
        assert "认证失败" in body["message"]

    def test_timeout_maps_to_chinese_timeout(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _patch_no_db_vendor_config(monkeypatch)
        _patch_acompletion(monkeypatch, _RaisingAcompletion(TimeoutError()))

        app = _build_app(_user(["admin"]))
        with TestClient(app) as client:
            resp = client.post(
                "/auth/admin/models/ping",
                json={
                    "vendor": "openai",
                    "model_name": "gpt-5-mini",
                    "api_key": "sk",
                },
            )

        body = resp.json()
        assert body["status"] == "error"
        assert "连接超时" in body["message"]


# ---------------------------------------------------------------------------
# Anthropic
# ---------------------------------------------------------------------------


class TestPingAnthropic:
    def test_thinking_disabled_passed_to_litellm(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _patch_no_db_vendor_config(monkeypatch)
        mock = _SuccessAcompletion()
        _patch_acompletion(monkeypatch, mock)

        app = _build_app(_user(["admin"]))
        with TestClient(app) as client:
            resp = client.post(
                "/auth/admin/models/ping",
                json={
                    "vendor": "anthropic",
                    "model_name": "claude-sonnet-4",
                    "api_key": "sk-ant",
                },
            )

        assert resp.status_code == 200
        kwargs = mock.calls[0]["kwargs"]
        assert kwargs["model"] == "anthropic/claude-sonnet-4"
        assert kwargs["thinking"] == {"type": "disabled"}
        assert kwargs["drop_params"] is True
        assert kwargs["api_key"] == "sk-ant"
        assert "temperature" not in kwargs


# ---------------------------------------------------------------------------
# Gemini
# ---------------------------------------------------------------------------


class TestPingGemini:
    def test_drop_params_true_without_vendor_specific_kwargs(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _patch_no_db_vendor_config(monkeypatch)
        mock = _SuccessAcompletion()
        _patch_acompletion(monkeypatch, mock)

        app = _build_app(_user(["admin"]))
        with TestClient(app) as client:
            resp = client.post(
                "/auth/admin/models/ping",
                json={
                    "vendor": "gemini",
                    "model_name": "gemini-2.5-flash",
                    "api_key": "g-key",
                },
            )

        assert resp.status_code == 200
        kwargs = mock.calls[0]["kwargs"]
        assert kwargs["model"] == "gemini/gemini-2.5-flash"
        assert kwargs["drop_params"] is True
        assert kwargs["api_key"] == "g-key"
        assert "thinking" not in kwargs
        assert "reasoning_effort" not in kwargs
        assert "temperature" not in kwargs


# ---------------------------------------------------------------------------
# Fallback & RBAC
# ---------------------------------------------------------------------------


class TestPingDbFallback:
    def test_vendor_config_fallback_populates_credentials(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """当表单未提供 api_key 时，DB 中的 VendorConfig 记录应被透传。"""

        class _FakeVendorConfig:
            api_key = "sk-from-db"
            api_base = "http://db-host/v1"

        class _FakeResult:
            def scalar_one_or_none(self) -> _FakeVendorConfig:
                return _FakeVendorConfig()

        class _FakeSession:
            async def __aenter__(self) -> _FakeSession:
                return self

            async def __aexit__(self, *_exc: Any) -> None:
                return None

            async def execute(self, _stmt: Any) -> _FakeResult:
                return _FakeResult()

        def _fake_session_factory() -> _FakeSession:
            return _FakeSession()

        monkeypatch.setattr("negentropy.auth.api.AsyncSessionLocal", _fake_session_factory)

        mock = _SuccessAcompletion()
        _patch_acompletion(monkeypatch, mock)

        app = _build_app(_user(["admin"]))
        with TestClient(app) as client:
            resp = client.post(
                "/auth/admin/models/ping",
                json={
                    "vendor": "openai",
                    "model_name": "gpt-5-mini",
                },
            )

        assert resp.status_code == 200, resp.text
        kwargs = mock.calls[0]["kwargs"]
        assert kwargs["api_key"] == "sk-from-db"
        assert kwargs["api_base"] == "http://db-host/v1"


class TestPingRbac:
    def test_non_admin_role_is_forbidden(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _patch_no_db_vendor_config(monkeypatch)
        mock = _SuccessAcompletion()
        _patch_acompletion(monkeypatch, mock)

        app = _build_app(_user(["user"]))
        with TestClient(app) as client:
            resp = client.post(
                "/auth/admin/models/ping",
                json={
                    "vendor": "openai",
                    "model_name": "gpt-5-mini",
                    "api_key": "sk",
                },
            )

        assert resp.status_code == 403
        assert mock.calls == []
