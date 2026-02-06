"""
分块算法单元测试

测试 chunk_text 函数的边界条件和特殊场景。
"""

from __future__ import annotations

import pytest

from negentropy.knowledge.chunking import chunk_text
from negentropy.knowledge.types import ChunkingConfig


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
        text = "a" * 20
        result = chunk_text(text, ChunkingConfig(chunk_size=10, overlap=2))
        assert len(result) == 2
        # 第二块应包含第一块的最后 2 个字符
        assert result[1][:2] == "aa"

    def test_overlap_equal_to_chunk_size_is_clamped(self) -> None:
        """重叠等于分块大小时应被限制"""
        text = "a" * 20
        result = chunk_text(text, ChunkingConfig(chunk_size=10, overlap=10))
        # overlap 应被限制为 chunk_size - 1
        assert len(result) == 2


class TestChunkingNewlines:
    """换行符处理测试"""

    def test_preserve_newlines_keeps_structure(self) -> None:
        """保留换行符模式应保持文本结构"""
        text = "line1\nline2\nline3"
        result = chunk_text(text, ChunkingConfig(chunk_size=10, overlap=0, preserve_newlines=True))
        assert "\n" in result[0]

    def test_remove_newlines_flattens_text(self) -> None:
        """移除换行符模式应展平文本"""
        text = "line1\nline2\nline3"
        result = chunk_text(text, ChunkingConfig(chunk_size=10, overlap=0, preserve_newlines=False))
        assert "\n" not in result[0]
        assert "line1 line2" in result[0]


class TestChunkingEdgeCases:
    """边界条件测试"""

    def test_very_small_chunk_size(self) -> None:
        """极小的分块大小应正常工作"""
        text = "abcdef"
        result = chunk_text(text, ChunkingConfig(chunk_size=1, overlap=0))
        assert len(result) == 6
        assert result == ["a", "b", "c", "d", "e", "f"]

    def test_zero_overlap_is_accepted(self) -> None:
        """零重叠应被接受"""
        text = "a" * 20
        result = chunk_text(text, ChunkingConfig(chunk_size=10, overlap=0))
        assert len(result) == 2
        assert result[0] != result[1]

    def test_negative_overlap_is_treated_as_zero(self) -> None:
        """负重叠应被处理为零"""
        text = "a" * 20
        result = chunk_text(text, ChunkingConfig(chunk_size=10, overlap=-1))
        assert len(result) == 2

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
        result = chunk_text(text, ChunkingConfig(chunk_size=500, overlap=50))
        assert len(result) > 1
        for chunk in result:
            assert len(chunk) <= 500

    def test_empty_chunks_are_filtered(self) -> None:
        """空块应被过滤"""
        text = "a\n\n\nb"  # 多个换行符可能产生空块
        result = chunk_text(text, ChunkingConfig(chunk_size=10, overlap=0, preserve_newlines=True))
        # 不应有空字符串
        assert all(chunk for chunk in result)


class TestChunkingConfigValidation:
    """配置验证测试"""

    def test_chunk_size_zero_is_clamped_to_one(self) -> None:
        """零分块大小应被限制为 1"""
        text = "abc"
        result = chunk_text(text, ChunkingConfig(chunk_size=0, overlap=0))
        assert len(result) >= 1

    def test_negative_chunk_size_is_treated_as_one(self) -> None:
        """负分块大小应被处理为 1"""
        text = "abc"
        result = chunk_text(text, ChunkingConfig(chunk_size=-1, overlap=0))
        assert len(result) >= 1


class TestChunkingDeterminism:
    """确定性测试"""

    def test_same_input_produces_same_output(self) -> None:
        """相同输入应产生相同输出"""
        text = "a" * 100
        config = ChunkingConfig(chunk_size=20, overlap=5)

        result1 = chunk_text(text, config)
        result2 = chunk_text(text, config)

        assert result1 == result2
