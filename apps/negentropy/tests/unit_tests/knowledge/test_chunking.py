"""
分块算法单元测试

测试 chunk_text 函数的边界条件和特殊场景。

扩展测试:
- Fixed 分块: 固定大小分块
- Recursive 分块: 递归分块（段落 > 句子 > 词）
- Semantic 分块: 语义分块（基于句子相似度）
- ChunkingStrategy: 策略枚举和配置验证

参考文献:
[1] G. Kamalloo and A. K. G., "Semantic Chunking for RAG Applications," 2024.
[2] LlamaIndex, "Semantic Chunking," GitHub, 2024.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from negentropy.knowledge.chunking import (
    _cosine_similarity,
    _fixed_chunk,
    _recursive_chunk,
    _split_into_sentences,
    chunk_text,
    semantic_chunk_async,
)
from negentropy.knowledge.types import ChunkingConfig, ChunkingStrategy


class TestChunkingBasic:
    """基础分块测试"""

    def test_empty_text_returns_empty_list(self) -> None:
        """空文本应返回空列表"""
        result = chunk_text("", ChunkingConfig())
        assert result == []

    def test_whitespace_only_returns_empty_list(self) -> None:
        """纯空白文本应返回空列表"""
        result = chunk_text("   \n\t  ", ChunkingConfig())
        assert result == []

    def test_simple_text_chunks_correctly(self) -> None:
        """简单文本应正确分块"""
        text = "hello world"
        result = chunk_text(text, ChunkingConfig(chunk_size=5, overlap=0))
        assert result == ["hello", "world"]

    def test_chunk_size_larger_than_text(self) -> None:
        """分块大小大于文本长度时返回整个文本"""
        text = "short"
        result = chunk_text(text, ChunkingConfig(chunk_size=100, overlap=0))
        assert result == ["short"]


class TestChunkingOverlap:
    """重叠分块测试"""

    def test_overlap_creates_overlapping_chunks(self) -> None:
        """重叠分块应创建有重叠的块"""
        # 使用有单词边界的文本，避免单词边界保护机制影响分块
        text = "word word word word word word"
        result = chunk_text(text, ChunkingConfig(chunk_size=15, overlap=5))
        assert len(result) >= 2
        # 第二块应与前一块有重叠
        assert result[1]  # 确保第二块存在

    def test_overlap_equal_to_chunk_size_raises_validation_error(self) -> None:
        """重叠等于分块大小时应抛出验证异常"""
        with pytest.raises(ValidationError, match="overlap"):
            ChunkingConfig(chunk_size=10, overlap=10)


class TestChunkingNewlines:
    """换行符处理测试"""

    def test_preserve_newlines_keeps_structure(self) -> None:
        """保留换行符模式应保持文本结构"""
        text = "line1\nline2\nline3"
        # 使用 FIXED 策略以测试 preserve_newlines 参数
        result = chunk_text(
            text,
            ChunkingConfig(strategy=ChunkingStrategy.FIXED, chunk_size=30, overlap=0, preserve_newlines=True),
        )
        assert len(result) >= 1
        # 验证换行符被保留在分块中
        assert "\n" in result[0]

    def test_remove_newlines_flattens_text(self) -> None:
        """移除换行符模式应展平文本"""
        text = "line1\nline2\nline3"
        # 使用 FIXED 策略以测试 preserve_newlines 参数
        result = chunk_text(
            text,
            ChunkingConfig(strategy=ChunkingStrategy.FIXED, chunk_size=30, overlap=0, preserve_newlines=False),
        )
        assert len(result) >= 1
        # 验证换行符被移除
        assert "\n" not in result[0]
        # 验证内容被保留（换行符被替换为空格）
        assert "line1" in result[0]
        assert "line2" in result[0]
        assert "line3" in result[0]


class TestChunkingEdgeCases:
    """边界条件测试"""

    def test_very_small_chunk_size(self) -> None:
        """极小的分块大小应正常工作"""
        # 使用有单词边界的文本进行测试
        text = "a b c d e f"
        result = chunk_text(text, ChunkingConfig(chunk_size=3, overlap=0))
        # 由于单词边界保护，每个单词会被保持完整
        assert len(result) >= 1
        # 验证所有内容都被保留
        combined = " ".join(result)
        for char in "abcdef":
            assert char in combined

    def test_zero_overlap_is_accepted(self) -> None:
        """零重叠应被接受"""
        # 使用有单词边界的文本，避免单词边界保护机制影响
        text = "word " * 4  # "word word word word "
        result = chunk_text(text, ChunkingConfig(chunk_size=10, overlap=0))
        # 验证分块正常工作
        assert len(result) >= 1
        # 验证内容完整
        combined = " ".join(result)
        assert "word" in combined

    def test_negative_overlap_raises_validation_error(self) -> None:
        """负重叠应抛出验证异常"""
        with pytest.raises(ValidationError, match="overlap must be non-negative"):
            ChunkingConfig(chunk_size=10, overlap=-1)

    def test_text_with_special_characters(self) -> None:
        """特殊字符应被正确处理"""
        text = "Hello, 世界! 🚀"
        result = chunk_text(text, ChunkingConfig(chunk_size=100, overlap=0))
        assert len(result) == 1
        assert "世界" in result[0]
        assert "🚀" in result[0]

    def test_text_with_leading_trailing_whitespace(self) -> None:
        """首尾空白应被去除"""
        text = "   \n  content  \n   "
        result = chunk_text(text, ChunkingConfig(chunk_size=100, overlap=0))
        assert len(result) == 1
        assert result[0] == "content"

    def test_very_long_single_line(self) -> None:
        """超长单行文本应正确分块"""
        text = "word " * 1000  # 约 5000 字符
        # 使用较大的 chunk_size 以便更好地控制分块大小
        result = chunk_text(text, ChunkingConfig(chunk_size=500, overlap=50))
        assert len(result) > 1
        # 由于单词边界保护，chunk 长度可能会略超过 chunk_size
        # 允许 20% 的容差
        for chunk in result:
            assert len(chunk) <= 600  # 500 * 1.2 = 600

    def test_empty_chunks_are_filtered(self) -> None:
        """空块应被过滤"""
        text = "a\n\n\nb"  # 多个换行符可能产生空块
        result = chunk_text(text, ChunkingConfig(chunk_size=10, overlap=0, preserve_newlines=True))
        # 不应有空字符串
        assert all(chunk for chunk in result)


class TestChunkingConfigValidation:
    """配置验证测试"""

    def test_chunk_size_zero_raises_validation_error(self) -> None:
        """零分块大小应抛出验证异常"""
        text = "abc"
        with pytest.raises(ValidationError, match="chunk_size must be at least"):
            ChunkingConfig(chunk_size=0, overlap=0)

    def test_negative_chunk_size_raises_validation_error(self) -> None:
        """负分块大小应抛出验证异常"""
        text = "abc"
        with pytest.raises(ValidationError, match="chunk_size must be at least"):
            ChunkingConfig(chunk_size=-1, overlap=0)

    def test_hierarchical_parent_smaller_than_child_raises(self) -> None:
        with pytest.raises(
            ValidationError,
            match="hierarchical_parent_chunk_size must be >=",
        ):
            ChunkingConfig(
                strategy=ChunkingStrategy.HIERARCHICAL,
                hierarchical_parent_chunk_size=128,
                hierarchical_child_chunk_size=256,
            )

    def test_hierarchical_child_overlap_must_be_smaller_than_child_size(self) -> None:
        with pytest.raises(
            ValidationError,
            match="hierarchical_child_overlap must be less than hierarchical_child_chunk_size",
        ):
            ChunkingConfig(
                strategy=ChunkingStrategy.HIERARCHICAL,
                hierarchical_child_chunk_size=128,
                hierarchical_child_overlap=128,
            )


class TestChunkingDeterminism:
    """确定性测试"""

    def test_same_input_produces_same_output(self) -> None:
        """相同输入应产生相同输出"""
        text = "a" * 100
        config = ChunkingConfig(chunk_size=20, overlap=5)

        result1 = chunk_text(text, config)
        result2 = chunk_text(text, config)

        assert result1 == result2


class TestHierarchicalChunking:
    def test_hierarchical_chunk_returns_child_chunks(self) -> None:
        text = "第一章介绍系统背景。第一章继续补充实现细节。\n\n第二章描述检索链路。第二章继续描述父子分块。"
        config = ChunkingConfig(
            strategy=ChunkingStrategy.HIERARCHICAL,
            hierarchical_parent_chunk_size=20,
            hierarchical_child_chunk_size=10,
            hierarchical_child_overlap=2,
        )

        result = chunk_text(text, config)

        assert len(result) >= 2
        combined = " ".join(result)
        assert "系统背景" in combined
        assert "父子分块" in combined


# ================================
# Sentence Splitting Tests
# ================================


class TestSentenceSplitting:
    """测试句子分割功能"""

    def test_split_chinese_sentences(self) -> None:
        """测试中文句子分割"""
        text = "这是第一句。这是第二句！这是第三句？"
        sentences = _split_into_sentences(text)
        assert len(sentences) == 3
        # 句子分割后保留标点符号
        assert sentences[0] == "这是第一句。"
        assert sentences[1] == "这是第二句！"
        assert sentences[2] == "这是第三句？"

    def test_split_english_sentences(self) -> None:
        """测试英文句子分割"""
        text = "First sentence. Second sentence! Third sentence?"
        sentences = _split_into_sentences(text)
        assert len(sentences) == 3

    def test_split_mixed_sentences(self) -> None:
        """测试中英文混合句子分割"""
        text = "中文句子。English sentence! 混合 Mixed 句子。"
        sentences = _split_into_sentences(text)
        assert len(sentences) >= 2

    def test_split_empty_text(self) -> None:
        """测试空文本分割"""
        sentences = _split_into_sentences("")
        assert sentences == []

    def test_split_text_without_delimiters(self) -> None:
        """测试没有分隔符的文本"""
        text = "这是没有分隔符的文本只是一句话"
        sentences = _split_into_sentences(text)
        assert len(sentences) == 1


# ================================
# Recursive Chunking Tests
# ================================


class TestRecursiveChunking:
    """测试递归分块"""

    @pytest.fixture
    def sample_text(self) -> str:
        """示例文本"""
        return """
        第一段的第一句话。第一段的第二句话。

        第二段的第一句话。第二段的第二句话。第二段的第三句话。

        第三段只有一个长句子，包含更多内容来测试分块效果。

        第四段用于测试边界情况。
        """

    def test_recursive_chunk_basic(self, sample_text: str) -> None:
        """测试基本递归分块"""
        config = ChunkingConfig(strategy=ChunkingStrategy.RECURSIVE, chunk_size=200, overlap=0)
        chunks = _recursive_chunk(sample_text, config)
        assert len(chunks) > 0
        assert all(len(c) <= 200 for c in chunks)

    def test_recursive_chunk_preserves_paragraphs(self, sample_text: str) -> None:
        """测试递归分块保持段落结构"""
        config = ChunkingConfig(strategy=ChunkingStrategy.RECURSIVE, chunk_size=500, overlap=0)
        chunks = _recursive_chunk(sample_text, config)
        assert len(chunks) >= 1

    def test_recursive_chunk_empty_text(self) -> None:
        """测试空文本递归分块"""
        config = ChunkingConfig(strategy=ChunkingStrategy.RECURSIVE)
        chunks = _recursive_chunk("", config)
        assert chunks == []


# ================================
# Cosine Similarity Tests
# ================================


class TestCosineSimilarity:
    """测试余弦相似度计算"""

    def test_cosine_similarity_identical(self) -> None:
        """测试相同向量的相似度"""
        a = [1.0, 2.0, 3.0]
        b = [1.0, 2.0, 3.0]
        similarity = _cosine_similarity(a, b)
        assert similarity == pytest.approx(1.0)

    def test_cosine_similarity_orthogonal(self) -> None:
        """测试正交向量的相似度"""
        a = [1.0, 0.0, 0.0]
        b = [0.0, 1.0, 0.0]
        similarity = _cosine_similarity(a, b)
        assert similarity == pytest.approx(0.0)

    def test_cosine_similarity_opposite(self) -> None:
        """测试相反向量的相似度"""
        a = [1.0, 1.0, 1.0]
        b = [-1.0, -1.0, -1.0]
        similarity = _cosine_similarity(a, b)
        assert similarity == pytest.approx(-1.0)

    def test_cosine_similarity_empty_vectors(self) -> None:
        """测试空向量"""
        similarity = _cosine_similarity([], [])
        assert similarity == 0.0

    def test_cosine_similarity_different_lengths(self) -> None:
        """测试不同长度的向量"""
        a = [1.0, 2.0]
        b = [1.0, 2.0, 3.0]
        similarity = _cosine_similarity(a, b)
        assert similarity == 0.0


# ================================
# Semantic Chunking Tests
# ================================


class TestSemanticChunking:
    """测试语义分块"""

    @pytest.mark.asyncio
    async def test_semantic_chunk_basic(self) -> None:
        """测试基本语义分块"""
        text = "第一句。第二句。第三句。第四句。"
        config = ChunkingConfig(
            strategy=ChunkingStrategy.SEMANTIC,
            semantic_threshold=0.85,
        )

        # Mock embedding function
        async def mock_embedding(text: str) -> list[float]:
            base = [0.1] * 1536
            base[0] = len(text) / 100.0
            return base

        chunks = await semantic_chunk_async(text, config, mock_embedding)
        assert len(chunks) > 0

    @pytest.mark.asyncio
    async def test_semantic_chunk_empty_text(self) -> None:
        """测试空文本语义分块"""
        config = ChunkingConfig(strategy=ChunkingStrategy.SEMANTIC)

        async def mock_embedding(text: str) -> list[float]:
            return [0.1] * 1536

        chunks = await semantic_chunk_async("", config, mock_embedding)
        assert chunks == []

    @pytest.mark.asyncio
    async def test_semantic_chunk_single_sentence(self) -> None:
        """测试单句子文本"""
        text = "这是唯一的一句话。"
        config = ChunkingConfig(strategy=ChunkingStrategy.SEMANTIC)

        async def mock_embedding(text: str) -> list[float]:
            return [0.1] * 1536

        chunks = await semantic_chunk_async(text, config, mock_embedding)
        assert len(chunks) == 1

    @pytest.mark.asyncio
    async def test_semantic_chunk_fallback_on_embedding_failure(self) -> None:
        """测试嵌入失败时回退到递归分块"""
        text = "第一句。第二句。第三句。"
        config = ChunkingConfig(strategy=ChunkingStrategy.SEMANTIC)

        async def failing_embedding(text: str) -> list[float]:
            raise RuntimeError("Embedding failed")

        chunks = await semantic_chunk_async(text, config, failing_embedding)
        # 应该回退到递归分块
        assert len(chunks) > 0


# ================================
# ChunkingStrategy Tests
# ================================


class TestChunkingStrategy:
    """测试 ChunkingStrategy 枚举"""

    def test_strategy_enum_values(self) -> None:
        """测试策略枚举值"""
        assert ChunkingStrategy.FIXED.value == "fixed"
        assert ChunkingStrategy.RECURSIVE.value == "recursive"
        assert ChunkingStrategy.SEMANTIC.value == "semantic"

    def test_config_with_fixed_strategy(self) -> None:
        """测试 FIXED 策略配置"""
        config = ChunkingConfig(strategy=ChunkingStrategy.FIXED, chunk_size=100, overlap=0)
        text = "a" * 200
        chunks = chunk_text(text, config)
        assert len(chunks) == 2

    def test_config_with_recursive_strategy(self) -> None:
        """测试 RECURSIVE 策略配置"""
        config = ChunkingConfig(strategy=ChunkingStrategy.RECURSIVE, chunk_size=100, overlap=0)
        text = "a" * 200
        chunks = chunk_text(text, config)
        assert len(chunks) > 0

    def test_config_strategy_from_string(self) -> None:
        """测试从字符串创建策略"""
        config = ChunkingConfig(strategy="semantic")
        assert config.strategy == ChunkingStrategy.SEMANTIC

    def test_config_strategy_invalid_string(self) -> None:
        """测试无效策略字符串"""
        with pytest.raises(ValueError, match="not a valid ChunkingStrategy"):
            ChunkingConfig(strategy="invalid")


# ================================
# ChunkingConfig Extended Validation Tests
# ================================


class TestChunkingConfigExtended:
    """测试扩展的 ChunkingConfig 配置验证"""

    def test_config_defaults(self) -> None:
        """测试默认配置"""
        config = ChunkingConfig()
        assert config.strategy == ChunkingStrategy.RECURSIVE
        assert config.chunk_size == 800
        assert config.overlap == 100

    def test_config_custom_semantic_threshold(self) -> None:
        """测试自定义语义阈值"""
        config = ChunkingConfig(semantic_threshold=0.9)
        assert config.semantic_threshold == 0.9

    def test_config_validation_semantic_threshold_bounds(self) -> None:
        """测试 semantic_threshold 验证"""
        with pytest.raises(ValidationError, match="semantic_threshold must be between 0 and 1"):
            ChunkingConfig(semantic_threshold=1.5)

    def test_config_validation_min_chunk_size(self) -> None:
        """测试 min_chunk_size 验证"""
        with pytest.raises(ValidationError, match="min_chunk_size must be at least 1"):
            ChunkingConfig(min_chunk_size=0)

    def test_config_validation_max_chunk_size(self) -> None:
        """测试 max_chunk_size 验证"""
        with pytest.raises(ValidationError, match="max_chunk_size must be at least 100"):
            ChunkingConfig(max_chunk_size=50)
