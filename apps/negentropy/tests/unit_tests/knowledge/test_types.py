"""
类型系统单元测试

测试 Knowledge 模块的类型定义、配置验证和不可变性。
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from negentropy.knowledge.constants import (
    DEFAULT_CHUNK_SIZE,
    DEFAULT_OVERLAP,
)
from negentropy.knowledge.types import (
    ChunkingConfig,
    ChunkingStrategy,
    CorpusRecord,
    CorpusSpec,
    GraphBuildConfig,
    GraphQueryConfig,
    KnowledgeChunk,
    KnowledgeMatch,
    SearchConfig,
    infer_source_type,
    normalize_source_metadata,
    serialize_chunking_config,
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

    def test_separators_normalized_to_hashable_tuple(self) -> None:
        """separators 应标准化为可哈希的不可变元组"""
        config = ChunkingConfig(separators=["###", " ", "###", "\t", "---"])
        assert config.separators == ("###", "---")

    def test_serialize_chunking_config_returns_json_safe_recursive_payload(self) -> None:
        """序列化结果应只包含 JSON 原生类型"""
        config = ChunkingConfig(
            strategy=ChunkingStrategy.RECURSIVE,
            chunk_size=500,
            overlap=50,
            preserve_newlines=False,
            separators=["###", "---"],
        )

        payload = serialize_chunking_config(config)

        assert payload == {
            "strategy": "recursive",
            "chunk_size": 500,
            "overlap": 50,
            "preserve_newlines": False,
            "separators": ["###", "---"],
        }
        assert isinstance(payload["strategy"], str)

    def test_serialize_chunking_config_returns_json_safe_hierarchical_payload(self) -> None:
        """层级分块配置序列化后不应保留枚举或元组"""
        config = ChunkingConfig(
            strategy=ChunkingStrategy.HIERARCHICAL,
            preserve_newlines=True,
            separators=["###"],
            hierarchical_parent_chunk_size=1500,
            hierarchical_child_chunk_size=500,
            hierarchical_child_overlap=150,
        )

        payload = serialize_chunking_config(config)

        assert payload == {
            "strategy": "hierarchical",
            "preserve_newlines": True,
            "separators": ["###"],
            "hierarchical_parent_chunk_size": 1500,
            "hierarchical_child_chunk_size": 500,
            "hierarchical_child_overlap": 150,
        }
        assert isinstance(payload["strategy"], str)
        assert isinstance(payload["separators"], list)


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


class TestGraphBuildConfig:
    """GraphBuildConfig 配置测试"""

    def test_graph_build_config_hashable(self) -> None:
        """图谱构建配置应保持可哈希"""
        config1 = GraphBuildConfig(
            entity_types=["person", "organization", "person"],
            relation_types=["WORKS_FOR", "  ", "WORKS_FOR"],
        )
        config2 = GraphBuildConfig(
            entity_types=("person", "organization"),
            relation_types=("WORKS_FOR",),
        )

        assert config1.entity_types == ("person", "organization")
        assert config1.relation_types == ("WORKS_FOR",)
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


class TestInferSourceType:
    """infer_source_type 工具函数测试"""

    def test_gs_uri_returns_file(self) -> None:
        """gs:// 前缀应推断为 file"""
        assert infer_source_type("gs://bucket/path") == "file"

    def test_http_uri_returns_url(self) -> None:
        """http:// 前缀应推断为 url"""
        assert infer_source_type("http://example.com") == "url"

    def test_https_uri_returns_url(self) -> None:
        """https:// 前缀应推断为 url"""
        assert infer_source_type("https://example.com/page") == "url"

    def test_plain_text_uri_returns_text(self) -> None:
        """非空非特殊前缀应推断为 text"""
        assert infer_source_type("some-plain-text-id") == "text"

    def test_none_uri_returns_unknown(self) -> None:
        """None URI 应推断为 unknown"""
        assert infer_source_type(None) == "unknown"

    def test_metadata_source_type_takes_precedence(self) -> None:
        """metadata 中已有 source_type 应优先采用"""
        result = infer_source_type("gs://bucket/path", {"source_type": "url"})
        assert result == "url"

    def test_metadata_invalid_source_type_falls_back(self) -> None:
        """metadata 中无效 source_type 应回退到 URI 推断"""
        result = infer_source_type("gs://bucket/path", {"source_type": "invalid"})
        assert result == "file"


class TestNormalizeSourceMetadata:
    """normalize_source_metadata 工具函数测试"""

    def test_adds_source_type_when_missing(self) -> None:
        """缺失 source_type 时应自动补充"""
        result = normalize_source_metadata(
            source_uri="https://example.com",
            metadata={"key": "value"},
        )
        assert result["source_type"] == "url"
        assert result["key"] == "value"

    def test_preserves_valid_source_type(self) -> None:
        """已有有效 source_type 时应保留"""
        result = normalize_source_metadata(
            source_uri="gs://bucket/file",
            metadata={"source_type": "text"},
        )
        assert result["source_type"] == "text"

    def test_handles_none_metadata(self) -> None:
        """metadata 为 None 时应返回含 source_type 的新字典"""
        result = normalize_source_metadata(source_uri=None, metadata=None)
        assert result == {"source_type": "unknown"}


class TestGraphQueryConfig:
    """GraphQueryConfig 配置测试"""

    def test_default_values(self) -> None:
        """GraphQueryConfig 默认值应正确"""
        config = GraphQueryConfig()
        assert config.max_depth == 2
        assert config.include_neighbors is True

    def test_custom_values(self) -> None:
        """GraphQueryConfig 自定义值应正确"""
        config = GraphQueryConfig(max_depth=3, include_neighbors=False)
        assert config.max_depth == 3
        assert config.include_neighbors is False


class TestBackwardCompatibleAliases:
    """向后兼容别名测试"""

    def test_graph_build_config_model_alias(self) -> None:
        """GraphBuildConfigModel 别名应指向 GraphBuildConfig"""
        from negentropy.knowledge import GraphBuildConfigModel

        assert GraphBuildConfigModel is GraphBuildConfig

    def test_graph_search_config_alias(self) -> None:
        """GraphSearchConfig 别名应指向 GraphQueryConfig"""
        from negentropy.knowledge import GraphSearchConfig

        assert GraphSearchConfig is GraphQueryConfig
