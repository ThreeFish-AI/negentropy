"""``negentropy.knowledge.revalidate`` 单元测试

覆盖：
- 未配置 ``url`` → 返回 "not_configured"
- 调用成功（2xx）→ 返回 "dispatched"
- 远端 5xx → 返回 "failed"（仅 WARN 不抛）
- httpx 抛异常 → 返回 "failed"（仅 WARN 不抛）
- 配置 secret 时附带 HMAC-SHA256 签名头

注：``KnowledgeSettings`` frozen=True 使直接 monkeypatch 属性失败；故测试通过
``_get_cfg`` 函数级注入实现配置隔离。
"""

from __future__ import annotations

from uuid import uuid4

import httpx
import pytest

from negentropy.config.knowledge import WikiRevalidateSettings
from negentropy.knowledge.lifecycle import revalidate


class _FakeSecret:
    def __init__(self, value: str):
        self._value = value

    def get_secret_value(self) -> str:
        return self._value


def _stub_cfg(*, url: str | None, secret_value: str | None = None) -> WikiRevalidateSettings:
    """构造测试 cfg，secret 走 SecretStr 兼容包装。"""
    if secret_value is None:
        return WikiRevalidateSettings(url=url, timeout_seconds=2.0)

    cfg = WikiRevalidateSettings(url=url, timeout_seconds=2.0)
    # SecretStr 通过 _FakeSecret 行为等价；直接赋值绕开 frozen 限制（测试沙箱内）。
    object.__setattr__(cfg, "secret", _FakeSecret(secret_value))  # type: ignore[arg-type]
    return cfg


@pytest.mark.asyncio
async def test_no_url_returns_not_configured(monkeypatch):
    monkeypatch.setattr(revalidate, "_get_cfg", lambda: _stub_cfg(url=None))
    result = await revalidate.trigger_wiki_revalidate(
        publication_id=uuid4(),
        pub_slug="wiki",
        app_name="negentropy",
        event="publish",
    )
    assert result == "not_configured"


@pytest.mark.asyncio
async def test_success_returns_dispatched(monkeypatch):
    monkeypatch.setattr(revalidate, "_get_cfg", lambda: _stub_cfg(url="http://wiki.test/api/revalidate"))
    captured: dict = {}

    class _StubClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, content=None, headers=None):
            captured["url"] = url
            captured["body"] = content
            captured["headers"] = dict(headers or {})
            return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _StubClient())
    result = await revalidate.trigger_wiki_revalidate(
        publication_id=uuid4(),
        pub_slug="wiki",
        app_name="negentropy",
        event="publish",
    )
    assert result == "dispatched"
    assert captured["url"] == "http://wiki.test/api/revalidate"
    assert b'"event":"publish"' in captured["body"]
    # 未配 secret 时不附签名头
    assert "x-negentropy-signature" not in captured["headers"]


@pytest.mark.asyncio
async def test_5xx_returns_failed_no_raise(monkeypatch):
    monkeypatch.setattr(revalidate, "_get_cfg", lambda: _stub_cfg(url="http://wiki.test/api/revalidate"))

    class _StubClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, content=None, headers=None):
            return httpx.Response(503, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _StubClient())
    result = await revalidate.trigger_wiki_revalidate(
        publication_id=uuid4(),
        pub_slug="wiki",
        app_name="negentropy",
        event="publish",
    )
    assert result == "failed"


@pytest.mark.asyncio
async def test_exception_returns_failed_no_raise(monkeypatch):
    monkeypatch.setattr(revalidate, "_get_cfg", lambda: _stub_cfg(url="http://wiki.test/api/revalidate"))

    class _StubClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, content=None, headers=None):
            raise httpx.ConnectError("simulated network error")

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _StubClient())
    result = await revalidate.trigger_wiki_revalidate(
        publication_id=uuid4(),
        pub_slug="wiki",
        app_name="negentropy",
        event="publish",
    )
    assert result == "failed"


@pytest.mark.asyncio
async def test_signature_header_present_when_secret_configured(monkeypatch):
    monkeypatch.setattr(
        revalidate,
        "_get_cfg",
        lambda: _stub_cfg(url="http://wiki.test/api/revalidate", secret_value="topsecret"),
    )
    captured: dict = {}

    class _StubClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, content=None, headers=None):
            captured["headers"] = dict(headers or {})
            return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _StubClient())
    await revalidate.trigger_wiki_revalidate(
        publication_id=uuid4(),
        pub_slug="wiki",
        app_name="negentropy",
        event="publish",
    )
    assert captured["headers"].get("x-negentropy-signature", "").startswith("sha256=")


def test_signature_header_format():
    """HMAC-SHA256：与 SSG route 中的算法保持一致格式。"""
    body = b'{"event":"publish"}'
    sig = revalidate._signature_header("topsecret", body)
    assert sig.startswith("sha256=")
    assert len(sig) == 7 + 64  # 64 hex chars after "sha256="
