"""
类型系统单元测试

测试 Knowledge 模块的类型定义、配置验证和不可变性。
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from negentropy.knowledge.types import (
    ChunkingConfig,
    CorpusRecord,
    CorpusSpec,
    KnowledgeChunk,
    KnowledgeMatch,
    KnowledgeRecord,
    SearchConfig,
)
from negentropy.knowledge.constants import (
    DEFAULT_CHUNK_SIZE,
    DEFAULT_OVERLAP,
)


class TestCorpusTypes:
    """Corpus 相关类型测试"""

    def test_corpus_spec_creation(self) -> None:
        """CorpusSpec 应正确创建"""
        spec = CorpusSpec(
            app_name="test_app",
            name="test_corpus",
            description="Test description",
            config={"key": "value"},
        )
        assert spec.app_name == "test_app"
        assert spec.name == "test_corpus"
        assert spec.description == "Test description"
        assert spec.config == {"key": "value"}

    def test_corpus_spec_defaults(self) -> None:
        """CorpusSpec 默认值应正确"""
        spec = CorpusSpec(app_name="test_app", name="test_corpus")
        assert spec.description is None
        assert spec.config == {}

    def test_corpus_record_complete(self) -> None:
        """CorpusRecord 应包含所有必需字段"""
        from datetime import datetime
        from uuid import uuid4

        now = datetime.now()
        record = CorpusRecord(
            id=uuid4(),
            app_name="test_app",
            name="test_corpus",
            description="desc",
            config={},
            created_at=now,
            updated_at=now,
        )
        assert record.app_name == "test_app"
        assert record.name == "test_corpus"


class TestKnowledgeTypes:
    """Knowledge 相关类型测试"""

    def test_knowledge_chunk_creation(self) -> None:
        """KnowledgeChunk 应正确创建"""
        chunk = KnowledgeChunk(
            content="test content",
            source_uri="doc://test",
            chunk_index=0,
            metadata={"key": "value"},
            embedding=[0.1, 0.2, 0.3],
        )
        assert chunk.content == "test content"
        assert chunk.source_uri == "doc://test"
        assert chunk.chunk_index == 0
        assert chunk.metadata == {"key": "value"}
        assert chunk.embedding == [0.1, 0.2, 0.3]

    def test_knowledge_chunk_defaults(self) -> None:
        """KnowledgeChunk 默认值应正确"""
        chunk = KnowledgeChunk(content="test")
        assert chunk.source_uri is None
        assert chunk.chunk_index == 0
        assert chunk.metadata == {}
        assert chunk.embedding is None

    def test_knowledge_match_score_fields(self) -> None:
        """KnowledgeMatch 分数字段应正确"""
        from uuid import uuid4

        match = KnowledgeMatch(
            id=uuid4(),
            content="test",
            source_uri="doc://test",
            metadata={},
            semantic_score=0.8,
            keyword_score=0.2,
            combined_score=0.7,
        )
        assert match.semantic_score == 0.8
        assert match.keyword_score == 0.2
        assert match.combined_score == 0.7


class TestChunkingConfig:
    """ChunkingConfig 配置测试"""

    def test_default_values(self) -> None:
        """ChunkingConfig 默认值应与常量对齐"""
        config = ChunkingConfig()
        assert config.chunk_size == DEFAULT_CHUNK_SIZE
        assert config.overlap == DEFAULT_OVERLAP
        assert config.preserve_newlines is True

    def test_custom_values(self) -> None:
        """ChunkingConfig 自定义值应正确"""
        config = ChunkingConfig(
            chunk_size=500,
            overlap=50,
            preserve_newlines=False,
        )
        assert config.chunk_size == 500
        assert config.overlap == 50
        assert config.preserve_newlines is False

    def test_overlap_less_than_chunk_size(self) -> None:
        """overlap 应小于 chunk_size"""
        config = ChunkingConfig(chunk_size=100, overlap=50)
        assert config.overlap < config.chunk_size


class TestSearchConfig:
    """SearchConfig 配置测试"""

    def test_default_hybrid_mode(self) -> None:
        """SearchConfig 默认应为 hybrid 模式"""
        config = SearchConfig()
        assert config.mode == "hybrid"

    def test_all_search_modes(self) -> None:
        """SearchConfig 应支持所有搜索模式"""
        for mode in ["semantic", "keyword", "hybrid"]:
            config = SearchConfig(mode=mode)  # type: ignore
            assert config.mode == mode

    def test_default_limit(self) -> None:
        """SearchConfig 默认 limit 应为 20"""
        config = SearchConfig()
        assert config.limit == 20

    def test_default_weights(self) -> None:
        """SearchConfig 默认权重应正确"""
        config = SearchConfig()
        assert config.semantic_weight == 0.7
        assert config.keyword_weight == 0.3

    def test_metadata_filter_default(self) -> None:
        """SearchConfig metadata_filter 默认应为 None"""
        config = SearchConfig()
        assert config.metadata_filter is None

    def test_custom_metadata_filter(self) -> None:
        """SearchConfig 自定义 metadata_filter 应正确"""
        filter_dict = {"category": "tech"}
        config = SearchConfig(metadata_filter=filter_dict)
        assert config.metadata_filter == filter_dict


class TestImmutability:
    """不可变性测试"""

    def test_frozen_dataclass_cannot_modify(self) -> None:
        """frozen dataclass 不应允许修改"""
        chunk = KnowledgeChunk(content="original")
        with pytest.raises(AttributeError):  # frozen=True
            chunk.content = "modified"

    def test_frozen_dataclass_hashable(self) -> None:
        """frozen dataclass 应可哈希（使用无 dict 字段的类型验证）"""
        # KnowledgeChunk 含有 metadata: dict，dict 不可哈希
        # 测试 Pydantic frozen 模型的不可变性
        config1 = ChunkingConfig(chunk_size=500, overlap=50)
        config2 = ChunkingConfig(chunk_size=500, overlap=50)
        # frozen Pydantic model 应可哈希
        assert hash(config1) == hash(config2)


class TestTypeValidation:
    """类型验证测试"""

    def test_chunk_size_must_be_positive(self) -> None:
        """chunk_size 必须为正数"""
        with pytest.raises(ValidationError):
            ChunkingConfig(chunk_size=0)

    def test_overlap_must_be_non_negative(self) -> None:
        """overlap 必须非负"""
        with pytest.raises(ValidationError, match="overlap must be non-negative"):
            ChunkingConfig(chunk_size=100, overlap=-1)

    def test_search_weights_in_valid_range(self) -> None:
        """搜索权重应在有效范围内"""
        config = SearchConfig(semantic_weight=1.0, keyword_weight=0.0)
        assert config.semantic_weight == 1.0
        assert config.keyword_weight == 0.0

    def test_limit_must_be_positive(self) -> None:
        """limit 必须为正数"""
        with pytest.raises(ValidationError):
            SearchConfig(limit=0)

        with pytest.raises(ValidationError):
            SearchConfig(limit=-1)
