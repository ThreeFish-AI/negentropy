"""``cli._install_uvicorn_graceful_shutdown_patch`` 单元测试。

覆盖 plan §测试方案 §3：
- patch 安装后 ``uvicorn.Config(app, host, port)`` 缺省 ``timeout_graceful_shutdown=25``；
- 显式传 ``timeout_graceful_shutdown=5`` 不被覆盖；
- 环境变量 ``NEGENTROPY_SHUTDOWN_TIMEOUT_SECONDS=10`` 生效；
- patch 幂等（重复调用不嵌套）。
"""

from __future__ import annotations

import importlib

import pytest


@pytest.fixture
def reset_uvicorn_patch(monkeypatch):
    """重置 uvicorn.Config.__init__ 与 cli 模块的 patch flag，让每个测试独立。"""
    import uvicorn

    import negentropy.cli as cli_mod

    original_init = uvicorn.Config.__init__
    original_flag = cli_mod._UVICORN_PATCH_INSTALLED

    yield

    uvicorn.Config.__init__ = original_init  # type: ignore[method-assign]
    cli_mod._UVICORN_PATCH_INSTALLED = original_flag


def _make_minimal_app():
    """uvicorn.Config 必须传入一个可识别的 app 才能完整构造，给一个最小 ASGI。"""

    async def app(scope, receive, send):  # pragma: no cover — 仅用于构造
        return None

    return app


def test_default_timeout_injected(reset_uvicorn_patch, monkeypatch):
    monkeypatch.delenv("NEGENTROPY_SHUTDOWN_TIMEOUT_SECONDS", raising=False)
    import uvicorn

    import negentropy.cli as cli_mod

    cli_mod._install_uvicorn_graceful_shutdown_patch()

    config = uvicorn.Config(_make_minimal_app(), host="127.0.0.1", port=0)
    assert config.timeout_graceful_shutdown == 25


def test_explicit_timeout_not_overridden(reset_uvicorn_patch):
    import uvicorn

    import negentropy.cli as cli_mod

    cli_mod._install_uvicorn_graceful_shutdown_patch()

    config = uvicorn.Config(
        _make_minimal_app(),
        host="127.0.0.1",
        port=0,
        timeout_graceful_shutdown=7,
    )
    assert config.timeout_graceful_shutdown == 7


def test_env_var_overrides_default(reset_uvicorn_patch, monkeypatch):
    monkeypatch.setenv("NEGENTROPY_SHUTDOWN_TIMEOUT_SECONDS", "10")
    # 需要重新 import 以让 _resolve_shutdown_timeout 在 install 时读到 env
    import negentropy.cli as cli_mod

    importlib.reload(cli_mod)
    cli_mod._install_uvicorn_graceful_shutdown_patch()

    import uvicorn

    config = uvicorn.Config(_make_minimal_app(), host="127.0.0.1", port=0)
    assert config.timeout_graceful_shutdown == 10


def test_patch_is_idempotent(reset_uvicorn_patch):
    import uvicorn

    import negentropy.cli as cli_mod

    cli_mod._install_uvicorn_graceful_shutdown_patch()
    first_init = uvicorn.Config.__init__
    cli_mod._install_uvicorn_graceful_shutdown_patch()
    second_init = uvicorn.Config.__init__
    assert first_init is second_init
