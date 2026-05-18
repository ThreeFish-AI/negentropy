"""
PostgresMemoryService 单元测试
覆盖 ADK BaseMemoryService 接口所有方法

验收项:
- #9: add_session_to_memory
- #10: search_memory 语义检索
- #11: list_memories 列出记忆
"""

import pytest
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from dataclasses import dataclass
from types import SimpleNamespace

# pytest-asyncio 配置
pytestmark = pytest.mark.asyncio


# 模拟 Session 对象
@dataclass
class MockSession:
    id: str
    app_name: str
    user_id: str
    events: list


class TestPostgresMemoryService:
    """MemoryService 单元测试套件"""

    @pytest.fixture
    def mock_db(self):
        """Mock DatabaseManager with repositories"""
        db = MagicMock()
        db.memories = AsyncMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        """Create test service instance"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService

        return PostgresMemoryService(db=mock_db)

    # ========== add_session_to_memory 测试 ==========

    async def test_add_session_to_memory(self, mock_db):
        """验收项 #9: 测试会话转化为可搜索记忆"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService

        service = PostgresMemoryService(db=mock_db)

        # 创建测试会话
        session = MockSession(
            id=str(uuid.uuid4()),
            app_name="test_app",
            user_id="user_001",
            events=[
                SimpleNamespace(author="user", content=SimpleNamespace(parts=[SimpleNamespace(text="我喜欢喝咖啡")])),
                SimpleNamespace(
                    author="agent", content=SimpleNamespace(parts=[SimpleNamespace(text="好的，我记住了")])
                ),
                SimpleNamespace(author="user", content=SimpleNamespace(parts=[SimpleNamespace(text="我住在北京")])),
            ],
        )

        # 执行
        await service.add_session_to_memory(session)

        # 验证: Reposistory insert 被调用
        mock_db.memories.insert.assert_called_once()
        call_args = mock_db.memories.insert.call_args
        assert call_args.kwargs["user_id"] == "user_001"
        assert "我喜欢喝咖啡" in call_args.kwargs["content"]
        assert "我住在北京" in call_args.kwargs["content"]

    async def test_add_session_to_memory_empty_events(self, mock_db):
        """测试空事件不产生记忆"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService

        service = PostgresMemoryService(db=mock_db)

        session = MockSession(
            id=str(uuid.uuid4()),
            app_name="test_app",
            user_id="user_002",
            events=[],  # 空事件列表
        )

        await service.add_session_to_memory(session)

        # 验证: 无消息时不应插入
        mock_db.memories.insert.assert_not_called()

    async def test_add_session_with_consolidation_worker(self, mock_db):
        """测试使用 Phase 2 consolidation_worker"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService

        mock_worker = AsyncMock()
        service = PostgresMemoryService(db=mock_db, consolidation_worker=mock_worker)

        session = MockSession(
            id=str(uuid.uuid4()),
            app_name="test_app",
            user_id="user_003",
            events=[{"author": "user", "content": {"text": "测试"}}],
        )

        await service.add_session_to_memory(session)

        # 验证: 使用 worker 而非简化实现
        mock_worker.consolidate.assert_called_once()
        mock_db.memories.insert.assert_not_called()

    # ========== search_memory 测试 ==========

    async def test_search_memory(self, mock_db):
        """验收项 #10: 测试语义检索"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService
        import json

        # 模拟 Repository 返回
        mock_db.memories.search_fulltext.return_value = [
            {
                "id": uuid.uuid4(),
                "content": "用户喜欢喝咖啡",
                "metadata": json.dumps({"source": "session"}),
                "relevance_score": 0.95,
                "created_at": datetime(2024, 1, 1, 12, 0, 0),
            },
            {
                "id": uuid.uuid4(),
                "content": "用户住在北京",
                "metadata": json.dumps({"source": "session"}),
                "relevance_score": 0.85,
                "created_at": datetime(2024, 1, 1, 12, 5, 0),
            },
        ]

        service = PostgresMemoryService(db=mock_db)

        # 执行搜索
        response = await service.search_memory(app_name="test_app", user_id="user_001", query="咖啡偏好")

        # 验证
        mock_db.memories.search_fulltext.assert_called_once()
        assert len(response.memories) == 2
        assert "咖啡" in response.memories[0].content.parts[0].text

    async def test_search_memory_empty_result(self, mock_db):
        """测试无匹配结果"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService

        mock_db.memories.search_fulltext.return_value = []
        service = PostgresMemoryService(db=mock_db)

        response = await service.search_memory(app_name="test_app", user_id="unknown_user", query="不存在的内容")

        assert len(response.memories) == 0

    async def test_search_memory_with_embedding(self, mock_db):
        """测试使用向量检索"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService
        import json

        # 模拟 embedding 函数
        mock_embedding_fn = AsyncMock(return_value=[0.1] * 384)

        mock_db.memories.search_vector.return_value = [
            {
                "id": uuid.uuid4(),
                "content": "向量检索结果",
                "metadata": json.dumps({"source": "session"}),
                "relevance_score": 0.99,
                "created_at": datetime(2024, 1, 1, 12, 0, 0),
            }
        ]

        service = PostgresMemoryService(db=mock_db, embedding_fn=mock_embedding_fn)

        response = await service.search_memory(app_name="test_app", user_id="user_004", query="测试向量")

        # 验证 embedding 被调用
        mock_embedding_fn.assert_called_once_with("测试向量")
        mock_db.memories.search_vector.assert_called_once()
        assert len(response.memories) == 1

    # ========== list_memories 测试 ==========

    async def test_list_memories(self, mock_db):
        """验收项 #11: 测试列出用户所有记忆"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService
        import json

        # 模拟 Repository 返回
        mock_db.memories.list_recent.return_value = [
            {
                "id": uuid.uuid4(),
                "content": "记忆1",
                "metadata": json.dumps({"source": "session"}),
                "retention_score": 0.9,
                "created_at": datetime(2024, 1, 1, 12, 0, 0),
            },
            {
                "id": uuid.uuid4(),
                "content": "记忆2",
                "metadata": json.dumps({"source": "session"}),
                "retention_score": 0.8,
                "created_at": datetime(2024, 1, 1, 12, 5, 0),
            },
        ]

        service = PostgresMemoryService(db=mock_db)

        memories = await service.list_memories(app_name="test_app", user_id="user_005")

        # 验证
        mock_db.memories.list_recent.assert_called_once()
        assert len(memories) == 2
        assert memories[0].content.parts[0].text == "记忆1"

    async def test_list_memories_with_limit(self, mock_db):
        """测试列出记忆带限制"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService

        mock_db.memories.list_recent.return_value = []
        service = PostgresMemoryService(db=mock_db)

        await service.list_memories(app_name="test_app", user_id="user_006", limit=50)

        # 验证
        mock_db.memories.list_recent.assert_called_with("user_006", "test_app", 50)
