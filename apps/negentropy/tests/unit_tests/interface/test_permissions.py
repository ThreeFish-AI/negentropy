"""单元测试：interface.permissions 模块。

覆盖系统内置可见性扩展与 ``_is_plugin_builtin`` helper 的正交边界，
对应 ISSUE: Dashboard 与子模块统计未含系统内置 / Negentropy Perceive Permission Denied。

只验证纯函数语义；DB 相关路径在 integration_tests 中走真实 PG round-trip。
"""

from __future__ import annotations

import types

import pytest

from negentropy.interface.permissions import (
    PLUGIN_TYPE_MODEL_MAP,
    _is_plugin_builtin,
)
from negentropy.models.plugin import (
    BuiltinTool,
    McpServer,
    Skill,
    SubAgent,
)


def _stub(is_system=None, owner_id: str = "alice"):
    """构造一个 duck-typed plugin 对象，仅暴露 _is_plugin_builtin 关心的属性。"""
    attrs: dict[str, object] = {"owner_id": owner_id}
    if is_system is not None:
        attrs["is_system"] = is_system
    return types.SimpleNamespace(**attrs)


class TestPluginTypeModelMap:
    """``PLUGIN_TYPE_MODEL_MAP`` 是 5 类 plugin 的单一事实源。"""

    def test_includes_builtin_tool(self) -> None:
        """ISSUE: 历史上 model_map 漏掉 builtin_tool 键，导致 stats.tools 永远 0/0。"""
        assert PLUGIN_TYPE_MODEL_MAP["builtin_tool"] is BuiltinTool

    def test_full_coverage(self) -> None:
        assert PLUGIN_TYPE_MODEL_MAP["mcp_server"] is McpServer
        assert PLUGIN_TYPE_MODEL_MAP["skill"] is Skill
        assert PLUGIN_TYPE_MODEL_MAP["sub_agent"] is SubAgent
        assert set(PLUGIN_TYPE_MODEL_MAP.keys()) == {
            "mcp_server",
            "skill",
            "sub_agent",
            "builtin_tool",
        }


class TestIsPluginBuiltin:
    """显式 ``is_system`` 列优先；列缺失时回退 owner_id 前缀。"""

    def test_explicit_true(self) -> None:
        assert _is_plugin_builtin(_stub(is_system=True)) is True

    def test_explicit_false_overrides_owner_prefix(self) -> None:
        """显式列为 False 时不再回退 owner_id —— 列是权威。"""
        plugin = _stub(is_system=False, owner_id="system:legacy")
        assert _is_plugin_builtin(plugin) is False

    def test_fallback_when_column_missing(self) -> None:
        """旧 schema（迁移 0033 之前）回退 owner_id 前缀。"""
        plugin = _stub(is_system=None, owner_id="system:negentropy-perceives-preset")
        assert _is_plugin_builtin(plugin) is True

    def test_fallback_regular_owner(self) -> None:
        plugin = _stub(is_system=None, owner_id="alice@example.com")
        assert _is_plugin_builtin(plugin) is False

    def test_no_attributes_at_all(self) -> None:
        plugin = types.SimpleNamespace()
        assert _is_plugin_builtin(plugin) is False


class TestModelHasIsSystem:
    """5 类 plugin 模型都已绑定 is_system 列（迁移 0033 + builtin_tool 历史已有）。"""

    @pytest.mark.parametrize("model", [McpServer, Skill, SubAgent, BuiltinTool])
    def test_column_exists(self, model) -> None:
        assert hasattr(model, "is_system"), f"{model.__name__} missing is_system column"
