"""单元测试：/interface/tools/{id} 与 /interface/tools/{id}:test 端点契约。

覆盖 ISSUE-095 (Test Connection 抛 PLUGINS_UPSTREAM_ERROR / Internal Server Error)
的核心防回归点：

1. **签名契约**：``permissions.check_plugin_access`` 必须保持 5 参数形态；任何调用
   方少传一个就会在运行时触发 ``TypeError`` 并被 Starlette 兜底为 plain-text 500，
   再被 UI 代理包装为 ``PLUGINS_UPSTREAM_ERROR``。本测试用 ``inspect.signature``
   锁定该契约，单边漂移即测试失败。

2. **调用点显式 5 参数**：直接 mock ``check_plugin_access`` 捕获 ``call_args``，
   断言 ``get_builtin_tool`` 与 ``test_builtin_tool`` 实参数 == 5 且最后一位
   == "view"。这是阻断本类回归的关键点位 —— 不依赖运行时是否 raise，永远
   立刻发现「调用方契约漂移」。

3. **业务路径**：mock httpx，覆盖 Google Search test 的 200 / 403 / 缺凭证 /
   非 google_search tool_type / 不支持 tool_type 五条正交分支，确保函数体的
   语义返回不被未来修改破坏。

mock 风格与同目录 ``test_stats.py`` / ``test_task_models_api.py`` 对齐，不引入
新的 helper 模块。
"""

from __future__ import annotations

import inspect
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from negentropy.auth.service import AuthUser
from negentropy.interface import api as interface_api
from negentropy.interface.permissions import check_plugin_access
from negentropy.models.plugin import BuiltinTool, PluginVisibility

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def _user() -> AuthUser:
    """普通用户 (非 admin、非 system)，用于走 owner / system-builtin view 分支。"""
    return AuthUser(
        user_id="alice@test.com",
        email="alice@test.com",
        name="Alice",
        picture=None,
        roles=["user"],
        provider="test",
        subject="alice@test.com",
        domain=None,
    )


def _make_tool(
    *,
    tool_id: UUID | None = None,
    name: str = "google_search",
    tool_type: str = "search",
    config: dict | None = None,
    credentials: dict | None = None,
    is_system: bool = True,
    owner_id: str = "system",
) -> BuiltinTool:
    """构造一个未持久化的 BuiltinTool 实例，仅用于函数体的语义测试。

    避免依赖真实 DB —— 端点函数只读取 ORM 属性，不调用 DB session 上的方法
    （除 ``db.get`` 我们也 mock）。
    """
    tool = BuiltinTool(
        owner_id=owner_id,
        visibility=PluginVisibility.PUBLIC,
        name=name,
        display_name=None,
        description=None,
        tool_type=tool_type,
        version="1.0.0",
        config=config or {},
        credentials=credentials or {},
        config_schema={},
        is_enabled=True,
        is_system=is_system,
    )
    # UUIDMixin 默认在 commit 时生成 id；测试里手动赋值即可。
    tool.id = tool_id or uuid4()
    return tool


def _mock_async_session(fake_db) -> MagicMock:
    """构造可被 ``async with AsyncSessionLocal() as db`` 使用的 mock。"""
    mock_session = MagicMock()
    mock_session.return_value.__aenter__ = AsyncMock(return_value=fake_db)
    mock_session.return_value.__aexit__ = AsyncMock(return_value=False)
    return mock_session


# ---------------------------------------------------------------------------
# 1) 签名契约：check_plugin_access 必须保持 5 参数
# ---------------------------------------------------------------------------


class TestCheckPluginAccessSignature:
    """ISSUE-095：调用方实参数 < 形参数 即触发 TypeError → 500 → PLUGINS_UPSTREAM_ERROR.

    若 ``permissions.check_plugin_access`` 签名变更，调用方必须同步更新。
    """

    def test_signature_has_5_params(self) -> None:
        sig = inspect.signature(check_plugin_access)
        # 期待参数：db, plugin_type, plugin_id, user, required_permission
        assert len(sig.parameters) == 5, (
            f"check_plugin_access 签名漂移：当前 {len(sig.parameters)} 参；"
            "若需要更新签名，请同步更新 api.py 中全部调用点（grep 应得 17+ 处）。"
        )
        assert "required_permission" in sig.parameters

    def test_required_permission_has_no_default(self) -> None:
        """required_permission 无默认值 —— 任何漏传都会立刻 TypeError，

        这是「调用方契约缺失即立即可见」的设计选择。若未来引入默认值，
        必须重新评估漏传是否会被隐藏 (silent fallback)。
        """
        sig = inspect.signature(check_plugin_access)
        param = sig.parameters["required_permission"]
        assert param.default is inspect.Parameter.empty


# ---------------------------------------------------------------------------
# 2) 调用点契约：get_builtin_tool / test_builtin_tool 必须传 5 参 + "view"
# ---------------------------------------------------------------------------


class TestCallSiteContract:
    """ISSUE-095 核心防回归：捕获实际 call_args，断言 5 参 + 最后一位 == "view"."""

    @pytest.mark.asyncio
    async def test_get_builtin_tool_passes_view_permission(self, _user) -> None:
        tool_id = uuid4()
        tool = _make_tool(tool_id=tool_id)

        fake_db = MagicMock()
        fake_db.get = AsyncMock(return_value=tool)

        with (
            patch.object(interface_api, "AsyncSessionLocal", _mock_async_session(fake_db)),
            patch.object(
                interface_api,
                "check_plugin_access",
                new=AsyncMock(return_value=(True, None)),
            ) as mock_check,
        ):
            await interface_api.get_builtin_tool(tool_id=tool_id, user=_user)

        assert mock_check.await_count == 1
        call = mock_check.await_args
        assert len(call.args) == 5, (
            f"get_builtin_tool 应传 5 个位置参数，实际 {len(call.args)}；"
            "缺失第 5 参数 'required_permission' 会触发 TypeError → 500。"
        )
        assert call.args[1] == "builtin_tool"
        assert call.args[2] == tool_id
        assert call.args[3] is _user
        assert call.args[4] == "view"

    @pytest.mark.asyncio
    async def test_test_builtin_tool_passes_view_permission(self, _user) -> None:
        tool_id = uuid4()
        # tool_type 用未支持的 "custom" 让函数走到末尾 fallback，无需 mock httpx
        tool = _make_tool(tool_id=tool_id, name="my_tool", tool_type="custom")

        fake_db = MagicMock()
        fake_db.get = AsyncMock(return_value=tool)

        with (
            patch.object(interface_api, "AsyncSessionLocal", _mock_async_session(fake_db)),
            patch.object(
                interface_api,
                "check_plugin_access",
                new=AsyncMock(return_value=(True, None)),
            ) as mock_check,
        ):
            await interface_api.test_builtin_tool(tool_id=tool_id, payload=None, user=_user)

        assert mock_check.await_count == 1
        call = mock_check.await_args
        assert len(call.args) == 5
        assert call.args[1] == "builtin_tool"
        assert call.args[2] == tool_id
        assert call.args[3] is _user
        assert call.args[4] == "view", (
            "test_builtin_tool 应使用 'view' 权限（只读语义），与 MCP 同类只读端点对齐；"
            "若改成 'edit'，非 admin 用户将无法测试系统内置工具 (is_system=True)。"
        )


# ---------------------------------------------------------------------------
# 3) get_builtin_tool 业务路径
# ---------------------------------------------------------------------------


class TestGetBuiltinTool:
    @pytest.mark.asyncio
    async def test_returns_response_when_authorized(self, _user) -> None:
        tool_id = uuid4()
        tool = _make_tool(tool_id=tool_id)
        fake_db = MagicMock()
        fake_db.get = AsyncMock(return_value=tool)

        with (
            patch.object(interface_api, "AsyncSessionLocal", _mock_async_session(fake_db)),
            patch.object(
                interface_api,
                "check_plugin_access",
                new=AsyncMock(return_value=(True, None)),
            ),
        ):
            resp = await interface_api.get_builtin_tool(tool_id=tool_id, user=_user)

        assert isinstance(resp, interface_api.BuiltinToolResponse)
        assert resp.id == tool_id
        assert resp.name == "google_search"

    @pytest.mark.asyncio
    async def test_raises_403_when_unauthorized(self, _user) -> None:
        tool_id = uuid4()
        fake_db = MagicMock()
        fake_db.get = AsyncMock(return_value=_make_tool(tool_id=tool_id))

        with (
            patch.object(interface_api, "AsyncSessionLocal", _mock_async_session(fake_db)),
            patch.object(
                interface_api,
                "check_plugin_access",
                new=AsyncMock(return_value=(False, "Permission denied")),
            ),
        ):
            with pytest.raises(HTTPException) as exc:
                await interface_api.get_builtin_tool(tool_id=tool_id, user=_user)

        assert exc.value.status_code == 403
        assert exc.value.detail == "Permission denied"


# ---------------------------------------------------------------------------
# 4) test_builtin_tool 业务路径
# ---------------------------------------------------------------------------


class TestTestBuiltinToolGoogleSearch:
    """google_search 工具的连通性测试路径覆盖。"""

    @pytest.mark.asyncio
    async def test_success_with_valid_credentials(self, _user) -> None:
        """Google API 返回 200 → success=True, 带 latency_ms."""
        tool_id = uuid4()
        tool = _make_tool(
            tool_id=tool_id,
            config={"cx_id": "fake-cx"},
            credentials={"api_key": "fake-key"},
        )

        fake_db = MagicMock()
        fake_db.get = AsyncMock(return_value=tool)

        # httpx.AsyncClient -> async context manager -> .get()
        fake_response = MagicMock()
        fake_response.status_code = 200
        fake_client = MagicMock()
        fake_client.get = AsyncMock(return_value=fake_response)
        fake_client.__aenter__ = AsyncMock(return_value=fake_client)
        fake_client.__aexit__ = AsyncMock(return_value=False)

        with (
            patch.object(interface_api, "AsyncSessionLocal", _mock_async_session(fake_db)),
            patch.object(
                interface_api,
                "check_plugin_access",
                new=AsyncMock(return_value=(True, None)),
            ),
            patch("httpx.AsyncClient", return_value=fake_client),
        ):
            resp = await interface_api.test_builtin_tool(tool_id=tool_id, payload=None, user=_user)

        assert resp.success is True
        assert "successful" in resp.message.lower()
        assert resp.latency_ms is not None and resp.latency_ms >= 0

    @pytest.mark.asyncio
    async def test_missing_credentials_returns_business_error_not_500(self, _user) -> None:
        """ISSUE-095 case B：凭证为空时返回业务错误而非 PLUGINS_UPSTREAM_ERROR.

        关键回归断言：函数返回 BuiltinToolTestResponse(success=False, ...) 而不是
        raise HTTPException — 这正是 Test Connection 在「凭证未配」场景下的预期
        用户可见行为（toast.error 显示具体业务文案，而不是上游错误）。
        """
        tool_id = uuid4()
        tool = _make_tool(
            tool_id=tool_id,
            config={},  # 缺 cx_id
            credentials={},  # 缺 api_key
        )

        fake_db = MagicMock()
        fake_db.get = AsyncMock(return_value=tool)

        with (
            patch.object(interface_api, "AsyncSessionLocal", _mock_async_session(fake_db)),
            patch.object(
                interface_api,
                "check_plugin_access",
                new=AsyncMock(return_value=(True, None)),
            ),
            patch("httpx.AsyncClient") as mock_client_cls,
        ):
            resp = await interface_api.test_builtin_tool(tool_id=tool_id, payload=None, user=_user)

        assert resp.success is False
        assert "API Key" in resp.message or "CX ID" in resp.message
        # 缺凭证时不应向外网发请求
        mock_client_cls.assert_not_called()

    @pytest.mark.asyncio
    async def test_inline_payload_overrides_db_credentials(self, _user) -> None:
        """payload 优先于 DB 存储 —— 「未保存即可测试」契约."""
        tool_id = uuid4()
        # DB 中存的凭证是空的
        tool = _make_tool(
            tool_id=tool_id,
            config={},
            credentials={},
        )

        fake_db = MagicMock()
        fake_db.get = AsyncMock(return_value=tool)

        fake_response = MagicMock()
        fake_response.status_code = 200
        fake_client = MagicMock()
        fake_client.get = AsyncMock(return_value=fake_response)
        fake_client.__aenter__ = AsyncMock(return_value=fake_client)
        fake_client.__aexit__ = AsyncMock(return_value=False)

        payload = interface_api.BuiltinToolTestRequest(
            config={"cx_id": "inline-cx"},
            credentials={"api_key": "inline-key"},
        )

        with (
            patch.object(interface_api, "AsyncSessionLocal", _mock_async_session(fake_db)),
            patch.object(
                interface_api,
                "check_plugin_access",
                new=AsyncMock(return_value=(True, None)),
            ),
            patch("httpx.AsyncClient", return_value=fake_client),
        ):
            resp = await interface_api.test_builtin_tool(tool_id=tool_id, payload=payload, user=_user)

        assert resp.success is True
        # 验证 inline 凭证被实际用于请求
        call_kwargs = fake_client.get.await_args.kwargs
        assert call_kwargs["params"]["key"] == "inline-key"
        assert call_kwargs["params"]["cx"] == "inline-cx"


class TestTestBuiltinToolGeneric:
    @pytest.mark.asyncio
    async def test_unsupported_tool_type_returns_business_error(self, _user) -> None:
        """非 google_search / claude_code 的工具类型返回业务错误，不抛 500。"""
        tool_id = uuid4()
        tool = _make_tool(tool_id=tool_id, name="my_custom", tool_type="custom")

        fake_db = MagicMock()
        fake_db.get = AsyncMock(return_value=tool)

        with (
            patch.object(interface_api, "AsyncSessionLocal", _mock_async_session(fake_db)),
            patch.object(
                interface_api,
                "check_plugin_access",
                new=AsyncMock(return_value=(True, None)),
            ),
        ):
            resp = await interface_api.test_builtin_tool(tool_id=tool_id, payload=None, user=_user)

        assert resp.success is False
        assert "Test not supported" in resp.message

    @pytest.mark.asyncio
    async def test_raises_403_when_unauthorized(self, _user) -> None:
        tool_id = uuid4()
        fake_db = MagicMock()
        fake_db.get = AsyncMock(return_value=_make_tool(tool_id=tool_id))

        with (
            patch.object(interface_api, "AsyncSessionLocal", _mock_async_session(fake_db)),
            patch.object(
                interface_api,
                "check_plugin_access",
                new=AsyncMock(return_value=(False, "Permission denied")),
            ),
        ):
            with pytest.raises(HTTPException) as exc:
                await interface_api.test_builtin_tool(tool_id=tool_id, payload=None, user=_user)

        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_raises_404_when_tool_missing(self, _user) -> None:
        tool_id = uuid4()
        fake_db = MagicMock()
        fake_db.get = AsyncMock(return_value=None)

        with (
            patch.object(interface_api, "AsyncSessionLocal", _mock_async_session(fake_db)),
            patch.object(
                interface_api,
                "check_plugin_access",
                new=AsyncMock(return_value=(True, None)),
            ),
        ):
            with pytest.raises(HTTPException) as exc:
                await interface_api.test_builtin_tool(tool_id=tool_id, payload=None, user=_user)

        assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# 5) 凭证脱敏回传：_merge_masked_credentials 辅助函数 + 端点集成
# ---------------------------------------------------------------------------


class TestIsMaskedValue:
    """_is_masked_value 脱敏占位检测。"""

    def test_masked_long_value(self) -> None:
        assert interface_api._is_masked_value("AIza****1234") is True

    def test_masked_short_value(self) -> None:
        assert interface_api._is_masked_value("****") is True

    def test_normal_string_not_masked(self) -> None:
        assert interface_api._is_masked_value("AIzaSyB-abc123") is False

    def test_empty_string_not_masked(self) -> None:
        assert interface_api._is_masked_value("") is False

    def test_non_string_not_masked(self) -> None:
        assert interface_api._is_masked_value(42) is False
        assert interface_api._is_masked_value(None) is False
        assert interface_api._is_masked_value({}) is False

    def test_single_star_not_masked(self) -> None:
        assert interface_api._is_masked_value("AIza*1234") is False

    def test_three_stars_not_masked(self) -> None:
        assert interface_api._is_masked_value("AIza***1234") is False


class TestMergeMaskedCredentials:
    """_merge_masked_credentials 脱敏值替换为 DB 真实值。"""

    def test_masked_replaced_with_stored(self) -> None:
        result = interface_api._merge_masked_credentials(
            {"api_key": "AIza****1234"},
            {"api_key": "AIzaSyB-real-key"},
        )
        assert result == {"api_key": "AIzaSyB-real-key"}

    def test_new_value_preserved(self) -> None:
        result = interface_api._merge_masked_credentials(
            {"api_key": "brand-new-key"},
            {"api_key": "old-key"},
        )
        assert result == {"api_key": "brand-new-key"}

    def test_mixed_masked_and_new(self) -> None:
        result = interface_api._merge_masked_credentials(
            {"api_key": "AIza****1234", "secret": "new-secret"},
            {"api_key": "real-key", "secret": "old-secret"},
        )
        assert result == {"api_key": "real-key", "secret": "new-secret"}

    def test_masked_without_stored_kept_as_is(self) -> None:
        result = interface_api._merge_masked_credentials(
            {"api_key": "****"},
            {},
        )
        assert result == {"api_key": "****"}

    def test_empty_incoming_returns_empty(self) -> None:
        result = interface_api._merge_masked_credentials({}, {"api_key": "real"})
        assert result == {}

    def test_empty_stored_masked_preserved(self) -> None:
        result = interface_api._merge_masked_credentials({"k": "****"}, {})
        assert result == {"k": "****"}


class TestTestBuiltinToolMaskedCredentials:
    """前端回传脱敏凭证时，test 端点用 DB 真实值调用 Google API。"""

    @pytest.mark.asyncio
    async def test_masked_api_key_replaced_with_stored(self, _user) -> None:
        """前端回传脱敏 api_key，test 端点用 DB 真实 key 调 Google API。"""
        tool_id = uuid4()
        tool = _make_tool(
            tool_id=tool_id,
            config={"cx_id": "real-cx"},
            credentials={"api_key": "AIzaSyB-real-api-key-12345"},
        )

        fake_db = MagicMock()
        fake_db.get = AsyncMock(return_value=tool)

        fake_response = MagicMock()
        fake_response.status_code = 200
        fake_client = MagicMock()
        fake_client.get = AsyncMock(return_value=fake_response)
        fake_client.__aenter__ = AsyncMock(return_value=fake_client)
        fake_client.__aexit__ = AsyncMock(return_value=False)

        # 模拟前端：cx_id 未脱敏，api_key 是 GET 返回的脱敏值
        payload = interface_api.BuiltinToolTestRequest(
            config={"cx_id": "real-cx"},
            credentials={"api_key": "AIza****2345"},
        )

        with (
            patch.object(interface_api, "AsyncSessionLocal", _mock_async_session(fake_db)),
            patch.object(
                interface_api,
                "check_plugin_access",
                new=AsyncMock(return_value=(True, None)),
            ),
            patch("httpx.AsyncClient", return_value=fake_client),
        ):
            resp = await interface_api.test_builtin_tool(tool_id=tool_id, payload=payload, user=_user)

        assert resp.success is True
        call_kwargs = fake_client.get.await_args.kwargs
        assert call_kwargs["params"]["key"] == "AIzaSyB-real-api-key-12345"
        assert call_kwargs["params"]["cx"] == "real-cx"

    @pytest.mark.asyncio
    async def test_new_api_key_not_replaced(self, _user) -> None:
        """用户输入全新 API Key（非脱敏），test 端点使用新值。"""
        tool_id = uuid4()
        tool = _make_tool(
            tool_id=tool_id,
            config={"cx_id": "my-cx"},
            credentials={"api_key": "old-key"},
        )

        fake_db = MagicMock()
        fake_db.get = AsyncMock(return_value=tool)

        fake_response = MagicMock()
        fake_response.status_code = 200
        fake_client = MagicMock()
        fake_client.get = AsyncMock(return_value=fake_response)
        fake_client.__aenter__ = AsyncMock(return_value=fake_client)
        fake_client.__aexit__ = AsyncMock(return_value=False)

        payload = interface_api.BuiltinToolTestRequest(
            config={"cx_id": "my-cx"},
            credentials={"api_key": "brand-new-key"},
        )

        with (
            patch.object(interface_api, "AsyncSessionLocal", _mock_async_session(fake_db)),
            patch.object(
                interface_api,
                "check_plugin_access",
                new=AsyncMock(return_value=(True, None)),
            ),
            patch("httpx.AsyncClient", return_value=fake_client),
        ):
            resp = await interface_api.test_builtin_tool(tool_id=tool_id, payload=payload, user=_user)

        assert resp.success is True
        call_kwargs = fake_client.get.await_args.kwargs
        assert call_kwargs["params"]["key"] == "brand-new-key"
