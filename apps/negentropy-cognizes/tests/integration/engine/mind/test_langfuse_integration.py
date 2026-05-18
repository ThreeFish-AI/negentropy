"""
Langfuse 集成测试
验证 Trace ID 透传及 OTLP 导出逻辑
"""

import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from cognizes.adapters.postgres.tracing import TracingManager

pytestmark = [pytest.mark.asyncio, pytest.mark.integration]


class MockOTLPSpanExporter(SpanExporter):
    """模拟 OTLP Exporter，用于验证 Spans 是否正确被导出"""

    def __init__(self):
        self.exported_spans: list[ReadableSpan] = []

    def export(self, spans: list[ReadableSpan]) -> SpanExportResult:
        self.exported_spans.extend(spans)
        return SpanExportResult.SUCCESS

    def shutdown(self):
        pass


class TestLangfuseIntegration:
    """Langfuse 集成测试套件"""

    @pytest.fixture
    def mock_exporter(self):
        return MockOTLPSpanExporter()

    async def test_trace_id_propagation(self, mock_exporter):
        """验证 Trace ID 在嵌套 Span 中正确透传"""
        manager = TracingManager(service_name="langfuse_test", otlp_exporter=mock_exporter)

        async with manager.span("parent_span") as parent:
            parent_trace_id = parent.get_span_context().trace_id

            async with manager.span("child_span") as child:
                child_trace_id = child.get_span_context().trace_id

                # 核心验证: 同一个 Trace ID
                assert parent_trace_id == child_trace_id

        # 等待 BatchSpanProcessor导出 (默认延迟可能导致测试抖动，但在单元测试中通常很快，或需显式 flush)
        # 由于 BatchSpanProcessor 是异步的且有定时器，为了测试稳定，我们 force flush tracer provider
        # 但 TracingManager 没有暴露 provider，我们这里简单等待一下，或者并在 TracingManager 中暴露 shutdown

        # 修正: 使用 instance provider 进行 flush
        if hasattr(manager, "provider") and hasattr(manager.provider, "force_flush"):
            manager.provider.force_flush()

        spans = mock_exporter.exported_spans
        assert len(spans) >= 2

        child_span = next(s for s in spans if s.name == "child_span")
        parent_span = next(s for s in spans if s.name == "parent_span")

        assert child_span.context.trace_id == parent_trace_id
        assert child_span.parent.span_id == parent_span.context.span_id

    async def test_async_push_to_pipeline(self, mock_exporter):
        """验证异步推送到 OTLP Pipeline (模拟 Langfuse)"""
        manager = TracingManager(service_name="langfuse_async_test", otlp_exporter=mock_exporter)

        @manager.trace_llm_call("gpt-4")
        async def mock_llm_generate():
            await asyncio.sleep(0.01)
            return "Hello Langfuse"

        await mock_llm_generate()

        if hasattr(manager, "provider") and hasattr(manager.provider, "force_flush"):
            manager.provider.force_flush()

        spans = mock_exporter.exported_spans
        assert len(spans) > 0
        llm_span = spans[0]

        assert llm_span.name == "llm.generate"
        assert llm_span.attributes["llm.model"] == "gpt-4"
        assert llm_span.attributes["llm.response_length"] == len("Hello Langfuse")
