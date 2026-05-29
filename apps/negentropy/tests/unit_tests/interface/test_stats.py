"""单元测试：/interface/stats Dashboard 统计端点。

覆盖修复 (Dashboard 模块统计恒为 0) 的核心契约：

1. ``_safe_plugin_stats`` helper 异常隔离 —— 单类 plugin 查询失败不再
   抛出，返回 ``{total: 0, enabled: 0}`` 且 ``logger.exception`` 被调用。
2. ``get_stats`` 端点使用 ``get_current_user_with_db_roles`` 依赖 ——
   与 ``/auth/me`` 对齐到 ISSUE-049 的 DB-roles 覆盖路径，避免 admin 用户被
   JWT 旧 roles 误判为 user。
3. ``StatsResponse`` schema 与 ``_safe_plugin_stats`` 返回值兼容 ——
   ``dict[str, int]`` 字段不会被破坏。
4. Migration 0037 文件包含 paper-hunter skills is_system 回填与幂等守卫。

使用 unittest.mock 绕过 DB 层，验证路由层与 helper 的纯逻辑。
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.auth.service import AuthUser


@pytest.fixture
def _admin_user() -> AuthUser:
    return AuthUser(
        user_id="admin-test",
        email="admin@test.com",
        name="Admin",
        picture=None,
        roles=["admin"],
        provider="test",
        subject="admin-test",
        domain=None,
    )


@pytest.fixture
def _non_admin_user() -> AuthUser:
    return AuthUser(
        user_id="user-test",
        email="user@test.com",
        name="User",
        picture=None,
        roles=["user"],
        provider="test",
        subject="user-test",
        domain=None,
    )


# ---------------------------------------------------------------------------
# 1) _safe_plugin_stats helper 异常隔离
# ---------------------------------------------------------------------------


class TestSafePluginStats:
    """单类 plugin 查询失败必须降级为 0/0，不抛出。"""

    @pytest.mark.asyncio
    async def test_visible_ids_failure_returns_zero(self, _non_admin_user) -> None:
        """``get_visible_plugin_ids`` 抛 SQLAlchemy 异常 → 返回 0/0 + 日志。"""
        from negentropy.interface import api as interface_api

        db = MagicMock()

        async def _raise(*_args, **_kwargs):
            raise RuntimeError("simulated SQL error in get_visible_plugin_ids")

        with (
            patch.object(interface_api, "get_visible_plugin_ids", side_effect=_raise),
            patch.object(interface_api.logger, "exception") as mock_log,
        ):
            result = await interface_api._safe_plugin_stats(db, "builtin_tool", MagicMock(), _non_admin_user)

        assert result == {"total": 0, "enabled": 0}
        assert mock_log.called, "must log.exception on failure for root-cause traceability"

    @pytest.mark.asyncio
    async def test_enabled_count_failure_returns_zero(self, _non_admin_user) -> None:
        """``db.scalar(count)`` 抛异常 → 返回 0/0（不让单段错误传染整张 Dashboard）。"""
        from negentropy.interface import api as interface_api

        db = MagicMock()
        db.scalar = AsyncMock(side_effect=RuntimeError("simulated count failure"))

        async def _ids(*_args, **_kwargs):
            from uuid import uuid4

            return [uuid4(), uuid4()]

        with (
            patch.object(interface_api, "get_visible_plugin_ids", side_effect=_ids),
            patch.object(interface_api.logger, "exception") as mock_log,
        ):
            result = await interface_api._safe_plugin_stats(db, "skill", MagicMock(), _non_admin_user)

        assert result == {"total": 0, "enabled": 0}
        assert mock_log.called

    @pytest.mark.asyncio
    async def test_empty_visible_ids_short_circuits(self, _non_admin_user) -> None:
        """visible_ids 为空时不应再发起 count 查询（性能）+ 返回 0/0。"""
        from negentropy.interface import api as interface_api

        db = MagicMock()
        db.scalar = AsyncMock(return_value=99)  # 不应被调用，否则下面断言失败

        async def _empty(*_args, **_kwargs):
            return []

        with patch.object(interface_api, "get_visible_plugin_ids", side_effect=_empty):
            result = await interface_api._safe_plugin_stats(db, "mcp_server", MagicMock(), _non_admin_user)

        assert result == {"total": 0, "enabled": 0}
        assert not db.scalar.called

    @pytest.mark.asyncio
    async def test_happy_path_returns_int(self, _non_admin_user) -> None:
        """正常路径：total = len(visible_ids), enabled = scalar(count) 转 int。

        用真实 ORM 模型（Agent）让 ``select().where()`` 表达式可构造；
        db.scalar 直接 mock 返回 enabled count，避免依赖真实 DB。
        """
        from uuid import uuid4

        from negentropy.interface import api as interface_api
        from negentropy.models.plugin import Agent

        db = MagicMock()
        db.scalar = AsyncMock(return_value=3)
        ids = [uuid4(), uuid4(), uuid4(), uuid4()]

        async def _ids(*_args, **_kwargs):
            return ids

        with patch.object(interface_api, "get_visible_plugin_ids", side_effect=_ids):
            result = await interface_api._safe_plugin_stats(db, "agent", Agent, _non_admin_user)

        assert result == {"total": 4, "enabled": 3}, (
            f"expected happy-path counts, got {result}; "
            "若 enabled=0 说明 helper 进入了 except 分支或 db.scalar 未被调用"
        )
        assert isinstance(result["total"], int)
        assert isinstance(result["enabled"], int)


# ---------------------------------------------------------------------------
# 2) get_stats 路由用 with_db_roles 依赖
# ---------------------------------------------------------------------------


def test_get_stats_uses_db_roles_dependency() -> None:
    """ISSUE-049：admin 端点必须用 ``get_current_user_with_db_roles``，避免 JWT 旧 roles 误判。

    通过 inspect 路由依赖签名验证：``get_stats`` 的 ``user`` 参数默认值是
    ``Depends(get_current_user_with_db_roles)`` 而非 ``Depends(get_current_user)``。
    """
    import inspect

    from negentropy.auth.deps import get_current_user_with_db_roles
    from negentropy.interface.api import get_stats

    sig = inspect.signature(get_stats)
    user_param = sig.parameters["user"]
    # FastAPI Depends 包装后，.dependency 字段指向原函数
    assert getattr(user_param.default, "dependency", None) is get_current_user_with_db_roles, (
        "get_stats must depend on get_current_user_with_db_roles (DB roles overlay)"
    )


# ---------------------------------------------------------------------------
# 3) StatsResponse schema 兼容 _safe_plugin_stats 返回值
# ---------------------------------------------------------------------------


class TestStatsResponseShape:
    def test_accepts_safe_stats_return(self) -> None:
        """StatsResponse 接受 dict[str, int] 字段，与 _safe_plugin_stats 输出契合。"""
        from negentropy.interface.api import StatsResponse

        resp = StatsResponse(
            mcp_servers={"total": 1, "enabled": 1},
            skills={"total": 3, "enabled": 3},
            agents={"total": 6, "enabled": 6},
            models={"total": 15, "enabled": 13, "vendors": 3},
            tools={"total": 1, "enabled": 1},
        )
        # 关键字段：5 张卡片 + models.vendors 三键复合
        assert resp.tools == {"total": 1, "enabled": 1}
        assert resp.models == {"total": 15, "enabled": 13, "vendors": 3}

    def test_accepts_all_zero_fallback(self) -> None:
        """全 0 兜底（极端故障路径）也必须能被序列化。"""
        from negentropy.interface.api import StatsResponse

        resp = StatsResponse(
            mcp_servers={"total": 0, "enabled": 0},
            skills={"total": 0, "enabled": 0},
            agents={"total": 0, "enabled": 0},
            models={"total": 0, "enabled": 0, "vendors": 0},
            tools={"total": 0, "enabled": 0},
        )
        # 所有值必须是 int
        for field in ("mcp_servers", "skills", "agents", "models", "tools"):
            assert all(isinstance(v, int) for v in getattr(resp, field).values())


# ---------------------------------------------------------------------------
# 4) Migration 0037 关键语句校验（静态文本断言，避免起 DB 依赖）
# ---------------------------------------------------------------------------


class TestMigration0037:
    """Migration 0037 必须包含 paper-hunter skills is_system 回填且具备幂等守卫。

    注：原工作分支曾在单条 0036 中同时承担 ``builtin_tools.visibility`` ENUM
    化与 paper-hunter 可见性扩散。前者已在 ``feature/1.x.x`` 上由独立迁移
    ``0036_builtin_tools_visibility_enum`` 完成（其测试覆盖归属该迁移），
    本测试只覆盖 0037 自身的增量职责。
    """

    @pytest.fixture
    def migration_module(self):
        """Migration 文件名以数字开头，无法直接 ``import``，用 importlib.util 加载。"""
        root = Path(__file__).resolve().parents[3]
        path = root / "src/negentropy/db/migrations/versions/0037_skills_paper_hunter_system.py"
        assert path.exists(), f"missing migration: {path}"
        spec = importlib.util.spec_from_file_location("migration_0037", path)
        mod = importlib.util.module_from_spec(spec)
        return mod, path

    def test_revision_metadata(self, migration_module) -> None:
        """down_revision=0036 链上当前 head；revision=0037。"""
        _, path = migration_module
        source = path.read_text()
        assert 'revision: str = "0037"' in source
        assert 'down_revision: str | None = "0036"' in source

    def test_upgrade_backfills_paper_hunter_skills(self, migration_module) -> None:
        """paper-hunter 系列 skills 标记为 is_system=TRUE，识别条件保守。"""
        _, path = migration_module
        source = path.read_text()
        assert "UPDATE" in source and "skills" in source
        assert "SET is_system = TRUE" in source
        # 幂等守卫：IS DISTINCT FROM TRUE
        assert "is_system IS DISTINCT FROM TRUE" in source
        # 识别条件：dev-admin 作者 + paper-hunter 命名前缀
        assert "owner_id = 'google:dev-admin'" in source
        assert "name LIKE 'ai-agent-paper-hunter%'" in source

    def test_downgrade_does_not_revert_skills(self, migration_module) -> None:
        """skills is_system 是可见性扩散，不能在 downgrade 中回滚（向后可见性单调）。"""
        _, path = migration_module
        source = path.read_text()
        # downgrade() 函数下不应有 "UPDATE … skills" + "is_system = FALSE"
        # 简单校验：downgrade 函数体不出现 skills + is_system = FALSE 组合
        downgrade_idx = source.index("def downgrade()")
        downgrade_src = source[downgrade_idx:]
        # 允许评论里有 skills 字眼（用于解释为何不回滚）；但不应有可执行的 UPDATE
        assert "SET is_system = FALSE" not in downgrade_src
