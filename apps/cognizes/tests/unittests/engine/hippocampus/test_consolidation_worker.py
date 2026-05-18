"""
MemoryConsolidationWorker 单元测试

覆盖:
- 任务创建和状态管理
- 对话格式化
- 摘要生成 (Mock LLM)
- Facts 提取 (Mock LLM)
"""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cognizes.engine.hippocampus.consolidation_worker import (
    MemoryConsolidationWorker,
    JobType,
    JobStatus,
    ConsolidationJob,
    Memory,
    Fact,
)


class TestConsolidationWorkerUnit:
    """Consolidation Worker 单元测试 (Mock 外部依赖)"""

    @pytest.fixture
    def mock_pool(self):
        """创建 Mock 数据库连接池"""
        pool = MagicMock()
        pool.acquire = MagicMock(return_value=AsyncMock())
        return pool

    @pytest.fixture
    def worker(self, mock_pool):
        """创建 Worker 实例"""
        with patch("cognizes.engine.hippocampus.consolidation_worker.genai"):
            return MemoryConsolidationWorker(mock_pool)

    def test_job_type_enum_values(self):
        """验证 JobType 枚举值"""
        assert JobType.FAST_REPLAY.value == "fast_replay"
        assert JobType.DEEP_REFLECTION.value == "deep_reflection"
        assert JobType.FULL_CONSOLIDATION.value == "full_consolidation"

    def test_job_status_enum_values(self):
        """验证 JobStatus 枚举值"""
        assert JobStatus.PENDING.value == "pending"
        assert JobStatus.RUNNING.value == "running"
        assert JobStatus.COMPLETED.value == "completed"
        assert JobStatus.FAILED.value == "failed"

    def test_consolidation_job_dataclass(self):
        """验证 ConsolidationJob dataclass"""
        job = ConsolidationJob(
            id="test-id",
            thread_id="thread-id",
            job_type=JobType.FAST_REPLAY,
            status=JobStatus.PENDING,
        )
        assert job.id == "test-id"
        assert job.thread_id == "thread-id"
        assert job.job_type == JobType.FAST_REPLAY
        assert job.status == JobStatus.PENDING
        assert job.result == {}
        assert job.error is None

    def test_memory_dataclass(self):
        """验证 Memory dataclass"""
        memory = Memory(
            id="mem-id",
            thread_id="thread-id",
            user_id="user-1",
            app_name="app-1",
            memory_type="summary",
            content="测试内容",
        )
        assert memory.id == "mem-id"
        assert memory.memory_type == "summary"
        assert memory.retention_score == 1.0
        assert memory.access_count == 0

    def test_fact_dataclass(self):
        """验证 Fact dataclass"""
        fact = Fact(
            id="fact-id",
            thread_id="thread-id",
            user_id="user-1",
            app_name="app-1",
            fact_type="preference",
            key="food_preference",
            value={"food": "sushi"},
        )
        assert fact.id == "fact-id"
        assert fact.fact_type == "preference"
        assert fact.confidence == 1.0

    def test_format_conversation(self, worker):
        """验证对话格式化逻辑"""
        events = [
            {"author": "user", "content": {"text": "你好"}},
            {"author": "agent", "content": {"text": "你好，有什么可以帮助你的？"}},
            {"author": "user", "content": {"text": "帮我查天气"}},
        ]

        result = worker._format_conversation(events)

        assert "用户: 你好" in result
        assert "助手: 你好，有什么可以帮助你的？" in result
        assert "用户: 帮我查天气" in result

    def test_format_conversation_with_tool(self, worker):
        """验证工具调用的格式化"""
        events = [
            {"author": "tool", "content": {"result": "晴天，25度"}},
        ]

        result = worker._format_conversation(events)

        assert "工具:" in result


class TestConsolidationWorkerPrompts:
    """测试 Prompt 模板"""

    def test_fast_replay_prompt_contains_placeholder(self):
        """验证 Fast Replay Prompt 包含占位符"""
        from cognizes.engine.hippocampus.consolidation_worker import FAST_REPLAY_PROMPT

        assert "{conversation}" in FAST_REPLAY_PROMPT
        assert "摘要" in FAST_REPLAY_PROMPT

    def test_deep_reflection_prompt_contains_placeholder(self):
        """验证 Deep Reflection Prompt 包含占位符"""
        from cognizes.engine.hippocampus.consolidation_worker import DEEP_REFLECTION_PROMPT

        assert "{conversation}" in DEEP_REFLECTION_PROMPT
        assert "JSON" in DEEP_REFLECTION_PROMPT
        assert "facts" in DEEP_REFLECTION_PROMPT
