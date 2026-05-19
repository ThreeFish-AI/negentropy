"""
ContextAssembler 单元测试

覆盖:
- Token 估算逻辑
- 上下文格式化
- 预算分配
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from cognizes.engine.hippocampus.context_assembler import (
    ContextAssembler,
    ContextItem,
    ContextWindow,
)


class TestContextItemDataclass:
    """ContextItem 数据类测试"""

    def test_context_item_creation(self):
        """验证 ContextItem 创建"""
        item = ContextItem(
            context_type="memory",
            content="测试记忆内容",
            relevance_score=0.85,
            token_estimate=50,
            metadata={"memory_id": "mem-1"},
        )
        assert item.context_type == "memory"
        assert item.content == "测试记忆内容"
        assert item.relevance_score == 0.85
        assert item.token_estimate == 50
        assert item.metadata["memory_id"] == "mem-1"

    def test_context_item_defaults(self):
        """验证默认值"""
        item = ContextItem(
            context_type="system",
            content="System prompt",
        )
        assert item.relevance_score == 1.0
        assert item.token_estimate == 0
        assert item.metadata == {}


class TestContextWindowDataclass:
    """ContextWindow 数据类测试"""

    def test_context_window_creation(self):
        """验证 ContextWindow 创建"""
        items = [
            ContextItem(context_type="system", content="System", token_estimate=100),
            ContextItem(context_type="memory", content="Memory", token_estimate=200),
        ]
        window = ContextWindow(
            items=items,
            total_tokens=300,
            budget_used=0.0375,  # 300/8000
        )
        assert len(window.items) == 2
        assert window.total_tokens == 300
        assert window.budget_used == 0.0375


class TestContextAssemblerUnit:
    """ContextAssembler 单元测试"""

    @pytest.fixture
    def mock_pool(self):
        """创建 Mock 连接池"""
        return MagicMock()

    @pytest.fixture
    def assembler(self, mock_pool):
        """创建 Assembler 实例"""
        return ContextAssembler(
            pool=mock_pool,
            max_tokens=8000,
            system_ratio=0.1,
            memory_ratio=0.3,
            history_ratio=0.4,
            fact_ratio=0.2,
        )

    def test_default_ratios(self, mock_pool):
        """验证默认比例"""
        assembler = ContextAssembler(mock_pool)
        assert assembler.system_ratio == 0.1
        assert assembler.memory_ratio == 0.3
        assert assembler.history_ratio == 0.4
        assert assembler.fact_ratio == 0.2
        # 总和应该 = 1.0
        total = assembler.system_ratio + assembler.memory_ratio + assembler.history_ratio + assembler.fact_ratio
        assert total == 1.0

    def test_token_estimation(self, assembler):
        """验证 Token 估算 (4 字符 ≈ 1 token)"""
        # 8 个字符 → 3 tokens
        assert assembler._estimate_tokens("12345678") == 3
        # 0 个字符 → 1 token (最小值)
        assert assembler._estimate_tokens("") == 1
        # 100 个字符 → 26 tokens
        assert assembler._estimate_tokens("x" * 100) == 26

    def test_format_context_structure(self, assembler):
        """验证上下文格式化结构"""
        window = ContextWindow(
            items=[
                ContextItem(context_type="system", content="你是一个助手"),
                ContextItem(context_type="fact", content="[preference] food: sushi"),
                ContextItem(context_type="memory", content="用户之前讨论过旅行"),
                ContextItem(context_type="history", content="[user]: 你好"),
            ],
            total_tokens=100,
            budget_used=0.0125,
        )

        formatted = assembler.format_context(window)

        assert "你是一个助手" in formatted
        assert "## 用户偏好" in formatted
        assert "[preference] food: sushi" in formatted
        assert "## 相关记忆" in formatted
        assert "## 对话历史" in formatted


class TestBudgetAllocation:
    """预算分配测试"""

    def test_budget_calculation(self):
        """验证预算计算"""
        max_tokens = 8000
        system_ratio = 0.1
        memory_ratio = 0.3
        history_ratio = 0.4
        fact_ratio = 0.2

        system_budget = int(max_tokens * system_ratio)
        memory_budget = int(max_tokens * memory_ratio)
        history_budget = int(max_tokens * history_ratio)
        fact_budget = int(max_tokens * fact_ratio)

        assert system_budget == 800
        assert memory_budget == 2400
        assert history_budget == 3200
        assert fact_budget == 1600
