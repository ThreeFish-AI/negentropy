import pytest
import asyncio
from unittest.mock import MagicMock
from negentropy.engine.adapters.postgres.tool_registry import ToolRegistry, FrontendTool
from negentropy.engine.adapters.postgres.tracing import TracingManager, PostgresSpanExporter
import negentropy.db.session as db_session
from negentropy.models.mind import Tool, Trace
from sqlalchemy import select, delete


@pytest.mark.asyncio
async def test_tool_registry_lifecycle():
    app_name = "test_tool_app"
    registry = ToolRegistry(app_name=app_name)

    # Clean up before test
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(Tool).where(Tool.app_name == app_name))
        await db.commit()

    # 1. Register Tool
    async def dummy_tool(x: int):
        return x * 2

    tool_def = await registry.register_tool("dummy_tool", dummy_tool, display_name="Dummy Tool")
    assert tool_def.name == "dummy_tool"
    assert tool_def.display_name == "Dummy Tool"
    assert tool_def.call_count == 0

    # 2. Get Available Tools
    tools = await registry.get_available_tools()
    assert len(tools) == 1
    assert tools[0].name == "dummy_tool"

    # 3. Invoke Tool
    result = await registry.invoke_tool("dummy_tool", {"x": 21})
    assert result == 42

    # 4. Check Stats Update
    # Latency update is async and immediate in current implementation
    # We might need to query DB to check
    async with db_session.AsyncSessionLocal() as db:
        stmt = select(Tool).where(Tool.app_name == app_name, Tool.name == "dummy_tool")
        result = await db.execute(stmt)
        tool = result.scalar_one()
        assert tool.call_count == 1
        assert tool.avg_latency_ms >= 0

    # 5. Register Frontend Tool
    frontend_tool = FrontendTool(
        name="fe_tool", description="A frontend tool", parameters={"type": "object"}, render_component="TestComp"
    )
    await registry.register_frontend_tool(app_name, frontend_tool)

    fe_tools = registry.get_frontend_tools(app_name)
    assert len(fe_tools) == 1
    assert fe_tools[0].name == "fe_tool"

    # Clean up
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(Tool).where(Tool.app_name == app_name))
        await db.commit()


@pytest.mark.asyncio
async def test_tracing_export():
    # Setup Tracing
    # We use explicit export for testing
    exporter = PostgresSpanExporter()

    # Create a mock Span
    mock_span = MagicMock()
    mock_span.context.trace_id = 0x12345678123456781234567812345678
    mock_span.context.span_id = 0x1234567812345678
    mock_span.parent = None
    mock_span.name = "test_span"
    mock_span.kind.name = "INTERNAL"
    mock_span.attributes = {"key": "value"}
    mock_span.events = []
    mock_span.start_time = 1700000000000000000  # ns
    mock_span.end_time = 1700000001000000000  # ns
    mock_span.status.status_code.name = "OK"
    mock_span.status.description = None

    # Test export
    # export() is sync wrapper around _async_export
    # BUT we are in an async loop here (pytest-asyncio).
    # The current implementation of export() tries to handle loop detection.
    # Let's call _async_export directly to avoid nested loop issues in test environment
    # or rely on the implementation's loop detection if robust.
    # Our implementation: loops.create_task if running.
    # But for verification we want to await it.

    await exporter._async_export([mock_span])

    # Verify DB
    async with db_session.AsyncSessionLocal() as db:
        from negentropy.models.mind import Trace

        stmt = select(Trace).where(Trace.operation_name == "test_span")
        result = await db.execute(stmt)
        traces = result.scalars().all()

        assert len(traces) >= 1
        t = traces[0]
        assert t.trace_id == "12345678123456781234567812345678"
        assert t.attributes["key"] == "value"

        # Cleanup
        await db.delete(t)
        await db.commit()
