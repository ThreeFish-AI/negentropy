"""
ToolRegistry 单元测试
覆盖动态工具注册、获取、调用和热更新功能

验收项:
- #13: register_tool 注册工具
- #14: get_available_tools 获取列表
- #15: invoke_tool 调用与统计
- #16: 热更新 (无需重启)
"""

import pytest
import uuid
import json
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

# pytest-asyncio 配置
pytestmark = pytest.mark.asyncio


class TestToolRegistry:
    """ToolRegistry 单元测试套件"""

    @pytest.fixture
    def mock_pool(self):
        """创建模拟数据库连接池"""
        pool = MagicMock()
        conn = AsyncMock()

        # acquire() 返回一个 AsyncContextManager
        # context manager 的 __aenter__ 返回 conn
        acm = AsyncMock()
        acm.__aenter__.return_value = conn
        acm.__aexit__.return_value = None

        pool.acquire.return_value = acm

        conn.execute = AsyncMock()
        conn.fetch = AsyncMock(return_value=[])

        return pool, conn

    @pytest.fixture
    def registry(self, mock_pool):
        """创建测试工具注册表实例"""
        from cognizes.adapters.postgres.tool_registry import ToolRegistry

        pool, _ = mock_pool
        return ToolRegistry(pool=pool)

    # ========== register_tool 测试 ==========

    async def test_register_tool(self, mock_pool):
        """验收项 #13: 测试工具注册到数据库"""
        from cognizes.adapters.postgres.tool_registry import ToolRegistry

        pool, conn = mock_pool
        registry = ToolRegistry(pool=pool)

        # 定义测试工具函数
        def calculator(x: int, y: int) -> int:
            return x + y

        # 注册工具
        tool_def = await registry.register_tool(
            name="calculator",
            func=calculator,
            display_name="计算器",
            openapi_schema={
                "type": "function",
                "name": "calculator",
                "parameters": {"type": "object", "properties": {"x": {"type": "integer"}, "y": {"type": "integer"}}},
            },
        )

        # 验证
        assert tool_def.name == "calculator"
        assert tool_def.display_name == "计算器"

        # 验证数据库插入被调用
        conn.execute.assert_called_once()
        call_sql = conn.execute.call_args[0][0]
        assert "INSERT INTO tools" in call_sql

    async def test_register_tool_with_permissions(self, mock_pool):
        """测试带权限的工具注册"""
        from cognizes.adapters.postgres.tool_registry import ToolRegistry

        pool, conn = mock_pool
        registry = ToolRegistry(pool=pool)

        async def admin_tool():
            return "admin only"

        tool_def = await registry.register_tool(
            name="admin_tool", func=admin_tool, permissions={"allowed_roles": ["admin"]}
        )

        assert tool_def.permissions == {"allowed_roles": ["admin"]}

    async def test_register_tool_upsert(self, mock_pool):
        """测试重复注册更新 (UPSERT)"""
        from cognizes.adapters.postgres.tool_registry import ToolRegistry

        pool, conn = mock_pool
        registry = ToolRegistry(pool=pool)

        def my_tool():
            return "v1"

        # 第一次注册
        await registry.register_tool(name="my_tool", func=my_tool)

        # 第二次注册 (更新)
        def my_tool_v2():
            return "v2"

        await registry.register_tool(name="my_tool", func=my_tool_v2, display_name="我的工具 v2")

        # 验证 ON CONFLICT DO UPDATE 被调用
        assert conn.execute.call_count == 2
        call_sql = conn.execute.call_args[0][0]
        assert "ON CONFLICT" in call_sql

    # ========== get_available_tools 测试 ==========

    async def test_get_available_tools(self, mock_pool):
        """验收项 #14: 测试获取可用工具列表"""
        from cognizes.adapters.postgres.tool_registry import ToolRegistry

        pool, conn = mock_pool

        # 模拟数据库返回
        conn.fetch.return_value = [
            {
                "id": uuid.uuid4(),
                "name": "calculator",
                "display_name": "计算器",
                "description": "数学计算",
                "openapi_schema": json.dumps({"type": "function"}),
                "permissions": json.dumps({"allowed_users": ["*"]}),
                "is_active": True,
                "call_count": 10,
                "avg_latency_ms": 5.5,
            },
            {
                "id": uuid.uuid4(),
                "name": "translator",
                "display_name": "翻译器",
                "description": "语言翻译",
                "openapi_schema": json.dumps({"type": "function"}),
                "permissions": json.dumps({}),
                "is_active": True,
                "call_count": 20,
                "avg_latency_ms": 100.0,
            },
        ]

        registry = ToolRegistry(pool=pool)
        tools = await registry.get_available_tools()

        # 验证
        assert len(tools) == 2
        assert tools[0].name == "calculator"
        assert tools[0].call_count == 10
        assert tools[1].name == "translator"

    async def test_get_available_tools_empty(self, mock_pool):
        """测试无注册工具"""
        from cognizes.adapters.postgres.tool_registry import ToolRegistry

        pool, conn = mock_pool
        conn.fetch.return_value = []

        registry = ToolRegistry(pool=pool)
        tools = await registry.get_available_tools()

        assert tools == []

    # ========== invoke_tool 测试 ==========

    async def test_invoke_tool(self, mock_pool):
        """验收项 #15: 测试调用工具并统计"""
        from cognizes.adapters.postgres.tool_registry import ToolRegistry

        pool, conn = mock_pool
        registry = ToolRegistry(pool=pool)

        # 注册同步工具
        def add(x, y):
            return x + y

        await registry.register_tool(name="add", func=add)

        # 调用工具
        result = await registry.invoke_tool(name="add", params={"x": 3, "y": 5})

        # 验证结果
        assert result == 8

        # 验证统计更新被调用
        update_call = conn.execute.call_args
        assert "UPDATE tools" in update_call[0][0]
        assert "call_count" in update_call[0][0]

    async def test_invoke_tool_async(self, mock_pool):
        """测试调用异步工具"""
        from cognizes.adapters.postgres.tool_registry import ToolRegistry

        pool, conn = mock_pool
        registry = ToolRegistry(pool=pool)

        # 注册异步工具
        async def async_tool(msg):
            await asyncio.sleep(0.01)
            return f"Processed: {msg}"

        await registry.register_tool(name="async_tool", func=async_tool)

        result = await registry.invoke_tool(name="async_tool", params={"msg": "hello"})

        assert result == "Processed: hello"

    async def test_invoke_tool_not_found(self, mock_pool):
        """测试调用不存在的工具"""
        from cognizes.adapters.postgres.tool_registry import ToolRegistry

        pool, _ = mock_pool
        registry = ToolRegistry(pool=pool)

        with pytest.raises(ValueError, match="not found"):
            await registry.invoke_tool(name="nonexistent_tool", params={})

    async def test_invoke_tool_with_run_id(self, mock_pool):
        """测试带 run_id 的工具调用"""
        from cognizes.adapters.postgres.tool_registry import ToolRegistry

        pool, conn = mock_pool
        registry = ToolRegistry(pool=pool)

        def simple_tool():
            return "done"

        await registry.register_tool(name="simple_tool", func=simple_tool)

        await registry.invoke_tool(name="simple_tool", params={}, run_id="run_12345")

        # run_id 可用于追踪
        conn.execute.assert_called()

    # ========== 热更新测试 ==========

    async def test_hot_update(self, mock_pool):
        """验收项 #16: 测试运行时注册新工具立即可用"""
        from cognizes.adapters.postgres.tool_registry import ToolRegistry

        pool, conn = mock_pool
        registry = ToolRegistry(pool=pool)

        # 初始状态: 无工具
        assert "new_tool" not in registry._function_registry

        # 运行时注册新工具
        def new_tool(data):
            return f"New: {data}"

        await registry.register_tool(name="new_tool", func=new_tool)

        # 立即可用 (无需重启)
        assert "new_tool" in registry._function_registry

        # 可以直接调用
        result = await registry.invoke_tool(name="new_tool", params={"data": "test"})
        assert result == "New: test"

    async def test_hot_update_replace_function(self, mock_pool):
        """测试运行时替换工具函数"""
        from cognizes.adapters.postgres.tool_registry import ToolRegistry

        pool, conn = mock_pool
        registry = ToolRegistry(pool=pool)

        # 注册 v1
        def tool_v1():
            return "v1"

        await registry.register_tool(name="my_tool", func=tool_v1)
        result1 = await registry.invoke_tool(name="my_tool", params={})
        assert result1 == "v1"

        # 热更新为 v2
        def tool_v2():
            return "v2"

        await registry.register_tool(name="my_tool", func=tool_v2)
        result2 = await registry.invoke_tool(name="my_tool", params={})
        assert result2 == "v2"


class TestFrontendTool:
    """前端工具注册测试"""

    @pytest.fixture
    def mock_pool(self):
        pool = AsyncMock()
        pool.execute = AsyncMock()
        return pool

    async def test_register_frontend_tool(self, mock_pool):
        """测试前端工具注册"""
        from cognizes.adapters.postgres.tool_registry import FrontendTool

        # 注意: 第二个 ToolRegistry 类使用不同的构造函数
        # 此测试验证 FrontendTool 数据类
        tool = FrontendTool(
            name="confirm_booking",
            description="确认预订",
            parameters={"type": "object", "properties": {"booking_id": {"type": "string"}}},
            render_component="BookingConfirmDialog",
            requires_confirmation=True,
        )

        assert tool.name == "confirm_booking"
        assert tool.requires_confirmation is True
        assert tool.render_component == "BookingConfirmDialog"
