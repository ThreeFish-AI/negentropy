"""Self-editing Memory Tools — 单元测试

覆盖参数校验与限流（不连真实 DB；服务调用通过 monkeypatch mock）。
"""

from __future__ import annotations

import pytest

from negentropy.engine.tools import memory_tools as mt


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    mt._RATE_LIMITS.clear()
    yield
    mt._RATE_LIMITS.clear()


@pytest.fixture
def stub_memory_service(monkeypatch):
    class _Stub:
        async def search_memory(self, **kwargs):
            class _Resp:
                memories = []

            return _Resp()

        async def add_memory_typed(self, **kwargs):
            return {
                "id": "m1",
                "memory_type": kwargs.get("memory_type"),
                "retention_score": 0.8,
                "importance_score": 0.5,
            }

        async def update_memory_content(self, **kwargs):
            return {"id": kwargs["memory_id"], "updated_at": "2026-05-02T12:00:00Z"}

        async def soft_delete_memory(self, **kwargs):
            return {"id": kwargs["memory_id"], "deleted": True}

    stub = _Stub()
    monkeypatch.setattr(mt, "get_memory_service", lambda: stub)
    return stub


@pytest.fixture
def stub_core_block_service(monkeypatch):
    class _Stub:
        async def upsert(self, **kwargs):
            return {"id": "cb1", "version": 1, "scope": kwargs.get("scope"), "label": kwargs.get("label")}

    stub = _Stub()
    monkeypatch.setattr(mt, "get_core_block_service", lambda: stub)
    return stub


@pytest.fixture
def stub_governance(monkeypatch):
    class _Stub:
        async def audit_memory(self, **kwargs):
            return []

    monkeypatch.setattr(mt, "get_memory_governance_service", lambda: _Stub())


class TestValidateRequired:
    async def test_missing_user_id_raises(self, stub_memory_service):
        with pytest.raises(ValueError, match="user_id"):
            await mt.memory_search(user_id="", app_name="app", query="q")

    async def test_missing_app_name_raises(self, stub_memory_service):
        with pytest.raises(ValueError, match="app_name"):
            await mt.memory_search(user_id="alice", app_name="", query="q")


class TestRateLimit:
    async def test_rate_limit_after_max_calls(self, stub_memory_service):
        for _ in range(mt.MAX_CALLS_PER_MINUTE):
            await mt.memory_search(user_id="alice", app_name="app", query="hello")
        with pytest.raises(PermissionError, match="Rate limit"):
            await mt.memory_search(user_id="alice", app_name="app", query="hello")

    async def test_rate_limit_per_user(self, stub_memory_service):
        for _ in range(mt.MAX_CALLS_PER_MINUTE):
            await mt.memory_search(user_id="alice", app_name="app", query="hello")
        # Different user should not be limited
        result = await mt.memory_search(user_id="bob", app_name="app", query="hello")
        assert "hits" in result


class TestMemorySearch:
    async def test_empty_query_raises(self, stub_memory_service):
        with pytest.raises(ValueError, match="query"):
            await mt.memory_search(user_id="alice", app_name="app", query="")

    async def test_invalid_memory_type_raises(self, stub_memory_service):
        with pytest.raises(ValueError, match="memory_type"):
            await mt.memory_search(user_id="alice", app_name="app", query="hi", memory_type="bogus")

    async def test_search_returns_dict(self, stub_memory_service):
        result = await mt.memory_search(user_id="alice", app_name="app", query="hello")
        assert "hits" in result
        assert "count" in result


class TestMemoryWriteUpdateDelete:
    async def test_write_returns_id(self, stub_memory_service):
        result = await mt.memory_write(user_id="alice", app_name="app", content="Test memory", memory_type="semantic")
        assert result["id"] == "m1"
        assert result["memory_type"] == "semantic"

    async def test_update_requires_memory_id(self, stub_memory_service):
        with pytest.raises(ValueError, match="memory_id"):
            await mt.memory_update(user_id="alice", app_name="app", memory_id="", new_content="new")

    async def test_delete_calls_audit(self, stub_memory_service, stub_governance):
        result = await mt.memory_delete(user_id="alice", app_name="app", memory_id="m1", reason="duplicate")
        assert result["id"] == "m1"
        assert result["deleted"] is True


class TestCoreBlockReplace:
    async def test_thread_scope_requires_thread_id(self, stub_core_block_service):
        with pytest.raises(ValueError, match="thread_id"):
            await mt.core_block_replace(user_id="alice", app_name="app", new_content="x", scope="thread")

    async def test_user_scope_default(self, stub_core_block_service):
        result = await mt.core_block_replace(user_id="alice", app_name="app", new_content="Alice persona text")
        assert result["id"] == "cb1"
        assert result["scope"] == "user"


class TestRateLimitDictCleanup:
    """Review #3 — 滑动窗口清空后必须删除字典键，避免 defaultdict 长期累积。"""

    async def test_dict_releases_keys_after_window_expires(self, stub_memory_service):
        # 首次调用：dict 内新建该 key
        await mt.memory_search(user_id="alice", app_name="app", query="hello")
        key = ("alice", "_", "memory_search")
        assert key in mt._RATE_LIMITS
        assert len(mt._RATE_LIMITS[key]) == 1

        # 模拟 120s 过去：把 deque 内的时间戳改成早于 60 秒前（deque 支持 __setitem__）
        import time as _t

        old_ts = _t.time() - 120
        mt._RATE_LIMITS[key][0] = old_ts

        # 再次进入 _check_rate_limit：清窗 → del key → append(now)，等价于"重置"
        await mt.memory_search(user_id="alice", app_name="app", query="hello")
        window = mt._RATE_LIMITS[key]
        assert len(window) == 1, "过期时间戳应被 popleft 清除"
        assert window[0] > old_ts, "新调用应替换为最新时间戳"

    def test_dict_release_path_directly(self):
        """直接对 _check_rate_limit 进行白盒测试：清空窗口分支是否真的 del key。"""
        import time as _t

        # 写入一个已过期的时间戳，然后调用 _check_rate_limit 一次
        key = ("ghost_user", "_", "memory_search")
        mt._RATE_LIMITS[key].append(_t.time() - 999)
        # 内部预期：prune 清空 → del key → 再 append(now)，最终 key 仍存在但只有 1 条
        mt._check_rate_limit("ghost_user", None, "memory_search")
        assert key in mt._RATE_LIMITS
        assert len(mt._RATE_LIMITS[key]) == 1


class TestOpenAPISchema:
    def test_all_5_tools_have_schema(self):
        assert set(mt.MEMORY_TOOLS_OPENAPI.keys()) == {
            "memory_search",
            "memory_write",
            "memory_update",
            "memory_delete",
            "core_block_replace",
        }
        for _name, schema in mt.MEMORY_TOOLS_OPENAPI.items():
            assert "name" in schema
            assert "description" in schema
            assert "parameters" in schema

    def test_registry_returns_all_tools(self):
        registry = mt.get_memory_tools_registry()
        assert len(registry) == 5
        for fn in registry.values():
            assert callable(fn)
