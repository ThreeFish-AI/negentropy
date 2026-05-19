"""
StateDebugService 单元测试

测试范围：纯逻辑测试
- 前缀分组逻辑 (prefix_breakdown)
- StateDebugInfo dataclass
"""

import pytest
from cognizes.engine.pulse.state_debug import StateDebugInfo


class TestStateDebugInfoDataclass:
    """StateDebugInfo dataclass 测试"""

    def test_basic_creation(self):
        """基本创建测试"""
        info = StateDebugInfo(
            thread_id="thread-123",
            current_state={"key": "value"},
            state_history=[],
            prefix_breakdown={"session": {}, "user": {}, "app": {}, "temp": {}},
        )
        assert info.thread_id == "thread-123"
        assert info.current_state["key"] == "value"

    def test_with_state_history(self):
        """带状态历史"""
        info = StateDebugInfo(
            thread_id="thread-456",
            current_state={},
            state_history=[
                {"time": "2024-01-01T00:00:00", "delta": {"counter": 1}},
                {"time": "2024-01-01T00:01:00", "delta": {"counter": 2}},
            ],
            prefix_breakdown={"session": {}, "user": {}, "app": {}, "temp": {}},
        )
        assert len(info.state_history) == 2


class TestPrefixBreakdownLogic:
    """前缀分组逻辑测试（模拟 StateDebugService 内部逻辑）"""

    def _parse_prefix_breakdown(self, state: dict) -> dict:
        """模拟 StateDebugService 的前缀分组逻辑"""
        prefix_breakdown = {"session": {}, "user": {}, "app": {}, "temp": {}}

        for key, value in state.items():
            if key.startswith("user:"):
                prefix_breakdown["user"][key[5:]] = value
            elif key.startswith("app:"):
                prefix_breakdown["app"][key[4:]] = value
            elif key.startswith("temp:"):
                prefix_breakdown["temp"][key[5:]] = value
            else:
                prefix_breakdown["session"][key] = value

        return prefix_breakdown

    def test_session_scope_keys(self):
        """无前缀键归入 session"""
        state = {"counter": 10, "status": "active"}
        breakdown = self._parse_prefix_breakdown(state)

        assert breakdown["session"]["counter"] == 10
        assert breakdown["session"]["status"] == "active"
        assert breakdown["user"] == {}

    def test_user_scope_keys(self):
        """user: 前缀键归入 user"""
        state = {"user:language": "zh-CN", "user:theme": "dark"}
        breakdown = self._parse_prefix_breakdown(state)

        assert breakdown["user"]["language"] == "zh-CN"
        assert breakdown["user"]["theme"] == "dark"
        assert breakdown["session"] == {}

    def test_app_scope_keys(self):
        """app: 前缀键归入 app"""
        state = {"app:max_retries": 3, "app:timeout": 30}
        breakdown = self._parse_prefix_breakdown(state)

        assert breakdown["app"]["max_retries"] == 3
        assert breakdown["app"]["timeout"] == 30

    def test_temp_scope_keys(self):
        """temp: 前缀键归入 temp"""
        state = {"temp:cache_key": "abc123"}
        breakdown = self._parse_prefix_breakdown(state)

        assert breakdown["temp"]["cache_key"] == "abc123"

    def test_mixed_scopes(self):
        """混合作用域"""
        state = {
            "counter": 5,
            "user:name": "Alice",
            "app:version": "1.0",
            "temp:token": "xyz",
        }
        breakdown = self._parse_prefix_breakdown(state)

        assert breakdown["session"]["counter"] == 5
        assert breakdown["user"]["name"] == "Alice"
        assert breakdown["app"]["version"] == "1.0"
        assert breakdown["temp"]["token"] == "xyz"

    def test_empty_state(self):
        """空状态"""
        breakdown = self._parse_prefix_breakdown({})

        assert breakdown["session"] == {}
        assert breakdown["user"] == {}
        assert breakdown["app"] == {}
        assert breakdown["temp"] == {}
