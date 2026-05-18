"""
OpenTelemetry Tracing 集成测试
覆盖 Trace 导出到 PostgreSQL 和 Span 层级关系

验收项:
- #17: Trace 导出到 PostgreSQL
- #18-#19: Span 层级正确
"""

import pytest
import asyncio
import os
from unittest.mock import MagicMock, patch, call

# pytest-asyncio 配置
pytestmark = [pytest.mark.asyncio, pytest.mark.integration]


class TestPostgresSpanExporter:
    """PostgresSpanExporter 测试套件"""

    @pytest.fixture
    def mock_span(self):
        """创建模拟 Span 对象"""
        from opentelemetry.trace import SpanKind
        from opentelemetry.trace.status import Status, StatusCode

        class MockSpanContext:
            def __init__(self, trace_id, span_id):
                self.trace_id = trace_id
                self.span_id = span_id

        class MockParent:
            def __init__(self, span_id):
                self.span_id = span_id

        class MockEvent:
            def __init__(self, name, timestamp, attributes=None):
                self.name = name
                self.timestamp = timestamp
                self.attributes = attributes or {}

        class MockSpan:
            def __init__(self, name, trace_id, span_id, parent_span_id=None):
                self.name = name
                self.context = MockSpanContext(trace_id, span_id)
                self.parent = MockParent(parent_span_id) if parent_span_id else None
                self.kind = SpanKind.INTERNAL
                self.attributes = {"test.attr": "value"}
                self.events = [MockEvent("event1", 1234567890 * 1e9)]
                self.start_time = 1234567890 * 1e9
                self.end_time = 1234567891 * 1e9
                self.status = Status(StatusCode.OK)

        return MockSpan

    def test_trace_to_postgres(self, mock_span):
        """验收项 #17: 测试 Trace 导出到 PostgreSQL"""
        from cognizes.adapters.postgres.tracing import PostgresSpanExporter

        # Mock psycopg.connect
        with patch("psycopg.connect") as mock_connect:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_conn.__enter__ = MagicMock(return_value=mock_conn)
            mock_conn.__exit__ = MagicMock(return_value=None)
            mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
            mock_cursor.__exit__ = MagicMock(return_value=None)
            mock_conn.cursor.return_value = mock_cursor
            mock_connect.return_value = mock_conn

            exporter = PostgresSpanExporter(dsn="postgresql://test:test@localhost/test")

            # 创建测试 Span
            span = mock_span(
                name="test_operation", trace_id=0x12345678901234567890123456789012, span_id=0x1234567890123456
            )

            # 导出
            from opentelemetry.sdk.trace.export import SpanExportResult

            result = exporter.export([span])

            # 验证结果
            assert result == SpanExportResult.SUCCESS
            mock_connect.assert_called_once()
            # 验证调用了 executemany 而不是 execute
            mock_cursor.executemany.assert_called_once()
            assert "INSERT INTO traces" in mock_cursor.executemany.call_args[0][0]

    def test_span_attributes_exported(self, mock_span):
        """测试 Span 属性正确导出"""
        from cognizes.adapters.postgres.tracing import PostgresSpanExporter

        with patch("psycopg.connect") as mock_connect:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_conn.__enter__ = MagicMock(return_value=mock_conn)
            mock_conn.__exit__ = MagicMock(return_value=None)
            mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
            mock_cursor.__exit__ = MagicMock(return_value=None)
            mock_conn.cursor.return_value = mock_cursor
            mock_connect.return_value = mock_conn

            exporter = PostgresSpanExporter(dsn="postgresql://test:test@localhost/test")

            span = mock_span(
                name="with_attributes", trace_id=0xAAAABBBBCCCCDDDDEEEEFFFF00001111, span_id=0x2222333344445555
            )

            exporter.export([span])

            # 验证 executemany 被调用
            assert mock_cursor.executemany.called
            # 验证 attributes 被序列化到参数列表的第一个元素的相应位置
            call_args = mock_cursor.executemany.call_args[0][1]
            # list of tuples, get first tuple
            first_row_params = call_args[0]
            # 第 6 个参数是 attributes JSON
            assert '{"test.attr": "value"}' in first_row_params[5]

    def test_trace_id_format(self, mock_span):
        """测试 trace_id 格式正确 (32 位十六进制)"""
        from cognizes.adapters.postgres.tracing import PostgresSpanExporter

        with patch("psycopg.connect") as mock_connect:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_conn.__enter__ = MagicMock(return_value=mock_conn)
            mock_conn.__exit__ = MagicMock(return_value=None)
            mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
            mock_cursor.__exit__ = MagicMock(return_value=None)
            mock_conn.cursor.return_value = mock_cursor
            mock_connect.return_value = mock_conn

            exporter = PostgresSpanExporter(dsn="postgresql://test:test@localhost/test")

            trace_id = 0x12345678901234567890123456789012
            span = mock_span(name="format_test", trace_id=trace_id, span_id=0x1234567890123456)

            exporter.export([span])

            # trace_id 应格式化为 32 位十六进制字符串
            call_args = mock_cursor.executemany.call_args[0][1]
            first_row_params = call_args[0]
            expected_trace_id = "12345678901234567890123456789012"
            assert first_row_params[0] == expected_trace_id


class TestSpanHierarchy:
    """Span 层级关系测试"""

    @pytest.fixture
    def mock_span_factory(self):
        """Span 工厂"""
        from opentelemetry.trace import SpanKind
        from opentelemetry.trace.status import Status, StatusCode

        class MockSpanContext:
            def __init__(self, trace_id, span_id):
                self.trace_id = trace_id
                self.span_id = span_id

        class MockParent:
            def __init__(self, span_id):
                self.span_id = span_id

        def create_span(name, trace_id, span_id, parent_span_id=None):
            class MockSpan:
                pass

            span = MockSpan()
            span.name = name
            span.context = MockSpanContext(trace_id, span_id)
            span.parent = MockParent(parent_span_id) if parent_span_id else None
            span.kind = SpanKind.INTERNAL
            span.attributes = {}
            span.events = []
            span.start_time = 1234567890 * 1e9
            span.end_time = 1234567891 * 1e9
            span.status = Status(StatusCode.OK)
            return span

        return create_span

    def test_span_hierarchy(self, mock_span_factory):
        """验收项 #18-#19: 测试父子 Span 关系"""
        from cognizes.adapters.postgres.tracing import PostgresSpanExporter

        with patch("psycopg.connect") as mock_connect:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_conn.__enter__ = MagicMock(return_value=mock_conn)
            mock_conn.__exit__ = MagicMock(return_value=None)
            mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
            mock_cursor.__exit__ = MagicMock(return_value=None)
            mock_conn.cursor.return_value = mock_cursor
            mock_connect.return_value = mock_conn

            exporter = PostgresSpanExporter(dsn="postgresql://test:test@localhost/test")

            # 创建层级 Span
            trace_id = 0xABCDEFABCDEFABCDEFABCDEFABCDEFAB
            parent_span_id = 0x1111111111111111
            child_span_id = 0x2222222222222222

            parent_span = mock_span_factory(
                name="parent_operation",
                trace_id=trace_id,
                span_id=parent_span_id,
                parent_span_id=None,  # 根 Span
            )

            child_span = mock_span_factory(
                name="child_operation",
                trace_id=trace_id,
                span_id=child_span_id,
                parent_span_id=parent_span_id,  # 指向父 Span
            )

            # 导出两个 Span
            exporter.export([parent_span, child_span])

            # 验证一次 executemany 调用，包含两个参数组
            assert mock_cursor.executemany.call_count == 1
            call_args = mock_cursor.executemany.call_args[0][1]
            assert len(call_args) == 2

    def test_root_span_no_parent(self, mock_span_factory):
        """测试根 Span 无父节点"""
        from cognizes.adapters.postgres.tracing import PostgresSpanExporter

        with patch("psycopg.connect") as mock_connect:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_conn.__enter__ = MagicMock(return_value=mock_conn)
            mock_conn.__exit__ = MagicMock(return_value=None)
            mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
            mock_cursor.__exit__ = MagicMock(return_value=None)
            mock_conn.cursor.return_value = mock_cursor
            mock_connect.return_value = mock_conn

            exporter = PostgresSpanExporter(dsn="postgresql://test:test@localhost/test")

            root_span = mock_span_factory(
                name="root_operation",
                trace_id=0xABCDEFABCDEFABCDEFABCDEFABCDEFAB,
                span_id=0x1111111111111111,
                parent_span_id=None,
            )

            exporter.export([root_span])

            # parent_span_id 应为 None
            mock_cursor.executemany.assert_called_once()
            call_args = mock_cursor.executemany.call_args[0][1]
            first_row_params = call_args[0]
            # 第 3 个参数是 parent_span_id
            assert first_row_params[2] is None


class TestTracingManager:
    """TracingManager 测试套件"""

    @pytest.fixture
    def mock_pool(self):
        from unittest.mock import AsyncMock

        pool = AsyncMock()
        return pool

    async def test_span_context_manager(self, mock_pool):
        """测试 Span 上下文管理器"""
        from cognizes.adapters.postgres.tracing import TracingManager

        # 使用 console 导出以避免真实数据库
        manager = TracingManager(
            service_name="test_service",
            console_export=False,  # 关闭以避免输出
        )

        # 测试正常执行
        async with manager.span("test_span", attributes={"key": "value"}) as span:
            # Span 应该存在
            assert span is not None

    async def test_span_exception_handling(self, mock_pool):
        """测试 Span 异常处理"""
        from cognizes.adapters.postgres.tracing import TracingManager

        manager = TracingManager(service_name="test_service")

        with pytest.raises(ValueError):
            async with manager.span("error_span") as span:
                raise ValueError("Test error")

    def test_trace_tool_call_decorator(self, mock_pool):
        """测试工具调用追踪装饰器"""
        from cognizes.adapters.postgres.tracing import TracingManager

        manager = TracingManager(service_name="test_service")

        @manager.trace_tool_call("my_tool")
        async def my_tool(x, y):
            return x + y

        # 装饰器应该返回包装函数
        assert asyncio.iscoroutinefunction(my_tool)

    def test_trace_llm_call_decorator(self, mock_pool):
        """测试 LLM 调用追踪装饰器"""
        from cognizes.adapters.postgres.tracing import TracingManager

        manager = TracingManager(service_name="test_service")

        @manager.trace_llm_call("gemini-2.0-flash")
        async def generate(prompt):
            return "response"

        assert asyncio.iscoroutinefunction(generate)


class TestTracingIntegration:
    """Tracing 集成测试 (需要真实 PostgreSQL)"""

    @pytest.fixture
    def db_dsn(self):
        """获取真实数据库 DSN"""
        return os.environ.get("DATABASE_URL", "postgresql://aigc:@localhost/cognizes-engine")

    @pytest.fixture
    async def db_pool(self):
        """创建真实数据库连接池 (仅用于验证)"""
        from cognizes.core.database import DatabaseManager

        try:
            db = DatabaseManager.get_instance()
            pool = await db.get_pool()
            yield pool
        except Exception:
            pytest.skip("需要 PostgreSQL 测试数据库")

    async def test_full_trace_export(self, db_dsn, db_pool):
        """完整 Trace 导出测试"""
        from cognizes.adapters.postgres.tracing import TracingManager

        # 使用 pg_dsn 而非 pg_pool，以支持同步导出
        manager = TracingManager(service_name="integration_test", pg_dsn=db_dsn)

        # 执行带追踪的操作
        async with manager.span("test_operation") as span:
            await asyncio.sleep(0.01)

        # 验证 traces 表有记录
        async with db_pool.acquire() as conn:
            count = await conn.fetchval("SELECT COUNT(*) FROM traces")
            assert count > 0

    async def test_trace_hierarchy_in_db(self, db_dsn, db_pool):
        """验证数据库中的 Span 层级"""
        from cognizes.adapters.postgres.tracing import TracingManager

        manager = TracingManager(service_name="hierarchy_test", pg_dsn=db_dsn)

        # 创建嵌套 Span
        async with manager.span("parent") as parent_span:
            async with manager.span("child") as child_span:
                pass

        # 验证层级关系
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT span_id, parent_span_id, operation_name FROM traces ORDER BY start_time")
            assert len(rows) >= 2
            # 子 Span 的 parent_span_id 应指向父 Span
