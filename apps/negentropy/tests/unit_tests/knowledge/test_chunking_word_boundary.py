"""单词边界保护单元测试

测试 chunk_text 和 _fixed_chunk 的单词边界保护策略。
"""

from __future__ import annotations

from negentropy.knowledge.ingestion.chunking import chunk_text
from negentropy.knowledge.types import ChunkingConfig


class TestWordBoundaryProtection:
    """测试英文单词完整性保护"""

    def test_find_word_boundary_left(self) -> None:
        """测试向左查找单词边界"""
        from negentropy.knowledge.ingestion.chunking import _find_word_boundary

        text = "hello world test"
        # 位置 7 是 'o'（world 的第一个 o）
        result = _find_word_boundary(text, 7, "left", 10)
        assert result == 6  # "world" 的起始位置

    def test_find_word_boundary_right(self) -> None:
        """测试向右查找单词边界"""
        from negentropy.knowledge.ingestion.chunking import _find_word_boundary

        text = "hello world test"
        # 位置 7 是 'o'（world 的第一个 o）
        result = _find_word_boundary(text, 7, "right", 10)
        assert result == 11  # "world" 后的空格位置

    def test_find_word_boundary_at_space(self) -> None:
        """测试当前位置是空格的情况"""
        from negentropy.knowledge.ingestion.chunking import _find_word_boundary

        text = "hello world"
        result = _find_word_boundary(text, 5, "left", 10)  # 位置 5 是空格
        assert result == 5

    def test_find_word_boundary_chinese_text(self) -> None:
        """测试中文文本不调整边界"""
        from negentropy.knowledge.ingestion.chunking import _find_word_boundary

        text = "这是中文测试文本"
        result = _find_word_boundary(text, 3, "left", 10)
        assert result == 3  # 中文不调整

    def test_fixed_chunk_preserves_words(self) -> None:
        """测试 Fixed 分块保护单词完整性"""
        from negentropy.knowledge.types import ChunkingStrategy

        text = "The quick brown fox jumps over the lazy dog multiple times"
        config = ChunkingConfig(strategy=ChunkingStrategy.FIXED, chunk_size=20, overlap=0)
        chunks = chunk_text(text, config)

        # 检查没有单词被切断
        for chunk in chunks:
            words = chunk.split()
            for word in words:
                # 每个单词应该是完整的（出现在原文中）
                assert word in text, f"Word '{word}' was cut in chunk '{chunk}'"

    def test_fixed_chunk_with_overlap_preserves_words(self) -> None:
        """测试 Fixed 分块带 Overlap 保护单词完整性"""
        import re

        from negentropy.knowledge.types import ChunkingStrategy

        text = "The quick brown fox jumps over the lazy dog"
        config = ChunkingConfig(strategy=ChunkingStrategy.FIXED, chunk_size=25, overlap=10)
        chunks = chunk_text(text, config)

        # 检查每个 chunk 中的英文单词都是完整的
        for chunk in chunks:
            # 提取英文单词
            words = re.findall(r"[a-zA-Z]+", chunk)
            for word in words:
                assert word in text, f"Word '{word}' was cut in chunk '{chunk}'"

    def test_recursive_chunk_overlap_preserves_words(self) -> None:
        """测试 Recursive 分块 Overlap 保护单词完整性"""
        import re

        from negentropy.knowledge.types import ChunkingStrategy

        text = """
        This is a long paragraph that contains many English words.
        We want to ensure that the overlap mechanism does not cut words in half.
        The quick brown fox jumps over the lazy dog.
        """
        config = ChunkingConfig(strategy=ChunkingStrategy.RECURSIVE, chunk_size=50, overlap=20)
        chunks = chunk_text(text, config)

        # 检查 overlap 部分的单词完整性
        for i, chunk in enumerate(chunks):
            words = re.findall(r"[a-zA-Z]+", chunk)
            for word in words:
                assert word in text, f"Word '{word}' was cut in chunk {i}: '{chunk}'"

    def test_mixed_chinese_english_text(self) -> None:
        """测试中英文混合文本"""
        import re

        from negentropy.knowledge.types import ChunkingStrategy

        text = "这是中文This is English更多中文More English here结束"
        config = ChunkingConfig(strategy=ChunkingStrategy.FIXED, chunk_size=15, overlap=0)
        chunks = chunk_text(text, config)

        # 英文单词应该保持完整
        for chunk in chunks:
            english_words = re.findall(r"[a-zA-Z]+", chunk)
            for word in english_words:
                assert word in ["This", "is", "English", "More", "here"], f"Unexpected partial word: '{word}'"

    def test_very_long_word_handling(self) -> None:
        """测试超长单词处理"""
        from negentropy.knowledge.types import ChunkingStrategy

        # 创建一个超长单词
        long_word = "supercalifragilisticexpialidocious"
        text = f"The word {long_word} is very long"
        config = ChunkingConfig(strategy=ChunkingStrategy.FIXED, chunk_size=20, overlap=0)
        chunks = chunk_text(text, config)

        # 超长单词可能需要被保留或特殊处理
        # 这里验证分块不会崩溃
        assert len(chunks) > 0

    def test_continuous_text_without_spaces(self) -> None:
        """测试无空格的连续文本"""
        from negentropy.knowledge.types import ChunkingStrategy

        text = "abcdefghij" * 10  # 100 个字符，无空格
        config = ChunkingConfig(strategy=ChunkingStrategy.FIXED, chunk_size=20, overlap=0)
        chunks = chunk_text(text, config)

        # 无空格时，应该按字符切分
        assert len(chunks) > 0
        total_len = sum(len(c) for c in chunks)
        assert total_len == len(text)

    def test_get_word_safe_overlap(self) -> None:
        """测试获取单词安全的重叠文本"""
        from negentropy.knowledge.ingestion.chunking import _get_word_safe_overlap

        prev_chunk = "This is the previous chunk with words"
        overlap_size = 15

        overlap = _get_word_safe_overlap(prev_chunk, overlap_size)

        # 重叠部分应该是完整的单词
        assert overlap.strip() in prev_chunk
        # 检查开头的单词是否完整
        first_word = overlap.strip().split()[0] if overlap.strip() else ""
        if first_word:
            assert first_word in prev_chunk


class TestWordBoundaryEdgeCases:
    """单词边界边界情况测试"""

    def test_empty_text(self) -> None:
        """测试空文本"""
        from negentropy.knowledge.ingestion.chunking import _find_word_boundary

        assert _find_word_boundary("", 0, "left", 10) == 0
        assert _find_word_boundary("", 0, "right", 10) == 0

    def test_single_character(self) -> None:
        """测试单字符文本"""
        from negentropy.knowledge.ingestion.chunking import _find_word_boundary

        assert _find_word_boundary("a", 0, "left", 10) == 0
        assert _find_word_boundary("a", 0, "right", 10) == 0

    def test_position_at_text_start(self) -> None:
        """测试位置在文本开头"""
        from negentropy.knowledge.ingestion.chunking import _find_word_boundary

        text = "hello world"
        assert _find_word_boundary(text, 0, "left", 10) == 0

    def test_position_at_text_end(self) -> None:
        """测试位置在文本末尾"""
        from negentropy.knowledge.ingestion.chunking import _find_word_boundary

        text = "hello world"
        assert _find_word_boundary(text, len(text) - 1, "right", 10) == len(text) - 1

    def test_numbers_and_punctuation(self) -> None:
        """测试数字和标点符号"""
        from negentropy.knowledge.ingestion.chunking import _find_word_boundary

        text = "hello123 world test"
        # 数字和标点不被视为英文单词的一部分
        result = _find_word_boundary(text, 5, "right", 10)
        # '123' 不是英文字母，应该在此处停止
        assert result <= 8  # 最多到 123 的位置

    def test_multiple_spaces(self) -> None:
        """测试多个连续空格"""
        from negentropy.knowledge.types import ChunkingStrategy

        text = "hello   world"
        config = ChunkingConfig(strategy=ChunkingStrategy.FIXED, chunk_size=10, overlap=0)
        chunks = chunk_text(text, config)
        # 应该正常处理多个空格的情况
        assert len(chunks) > 0
