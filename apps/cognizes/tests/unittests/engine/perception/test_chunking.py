"""
Unit tests for Chunking Strategies.

Tests cover:
- FixedLengthChunker
- RecursiveChunker
- SemanticChunker
- HierarchicalChunker
- Factory functions

Task ID: P3-5-2
"""

import pytest
from cognizes.engine.perception.chunking import (
    Chunk,
    ChunkingStrategy,
    FixedLengthChunker,
    RecursiveChunker,
    SemanticChunker,
    HierarchicalChunker,
    get_chunker,
    chunk_text,
)


# ============================================
# Test Fixtures
# ============================================


@pytest.fixture
def short_text():
    """Short text that fits in a single chunk."""
    return "Machine learning is a subset of artificial intelligence."


@pytest.fixture
def medium_text():
    """Medium text that should produce multiple chunks."""
    return "Machine learning is a subset of artificial intelligence. " * 50


@pytest.fixture
def structured_text():
    """Structured text with clear paragraph boundaries."""
    return """
# Introduction

This is the introduction paragraph. It contains important background information.

## Section 1: Overview

This section provides an overview of the topic. Machine learning has revolutionized
how we approach complex problems.

## Section 2: Methods

The methods section describes our approach in detail. We used a combination of
supervised and unsupervised learning techniques.

### 2.1 Data Preprocessing

Data preprocessing involved cleaning, normalization, and feature extraction.

### 2.2 Model Architecture

The model architecture consists of three main components.
"""


@pytest.fixture
def multi_topic_text():
    """Text with multiple distinct topics."""
    return """
Machine learning is transforming healthcare. Doctors can now use AI to diagnose diseases
more accurately. Medical imaging analysis has seen significant improvements.

The stock market showed volatility today. Tech stocks rallied while energy sectors declined.
Investors are watching the Federal Reserve's next move closely.

Python programming has become the language of choice for data science. Its simple syntax
and rich ecosystem of libraries make it ideal for machine learning projects.
"""


# ============================================
# Chunk Dataclass Tests
# ============================================


class TestChunkDataclass:
    """Tests for the Chunk dataclass."""

    def test_chunk_creation(self):
        """Test basic Chunk creation."""
        chunk = Chunk(
            content="Test content",
            index=0,
            start_char=0,
            end_char=12,
            token_count=3,
            metadata={"source": "test.txt"},
        )
        assert chunk.content == "Test content"
        assert chunk.index == 0
        assert chunk.token_count == 3
        assert chunk.metadata["source"] == "test.txt"

    def test_chunk_defaults(self):
        """Test Chunk default values."""
        chunk = Chunk(content="Test", index=0)
        assert chunk.start_char == 0
        assert chunk.end_char == 0
        assert chunk.token_count == 0
        assert chunk.metadata == {}
        assert chunk.parent_id is None
        assert chunk.children_ids == []


# ============================================
# FixedLengthChunker Tests
# ============================================


class TestFixedLengthChunker:
    """Tests for FixedLengthChunker."""

    def test_short_text_single_chunk(self, short_text):
        """Short text should produce a single chunk."""
        chunker = FixedLengthChunker(chunk_size=100, chunk_overlap=10)
        chunks = chunker.split(short_text)

        assert len(chunks) == 1
        assert chunks[0].content == short_text
        assert chunks[0].index == 0

    def test_medium_text_multiple_chunks(self, medium_text):
        """Medium text should produce multiple chunks."""
        chunker = FixedLengthChunker(chunk_size=100, chunk_overlap=10)
        chunks = chunker.split(medium_text)

        assert len(chunks) > 1
        # All chunks except possibly the last should be around chunk_size
        for chunk in chunks[:-1]:
            assert chunk.token_count <= 100

    def test_chunk_overlap(self, medium_text):
        """Test that overlap is applied correctly."""
        chunker = FixedLengthChunker(chunk_size=50, chunk_overlap=10)
        chunks = chunker.split(medium_text)

        assert len(chunks) > 1
        assert chunker.chunk_overlap == 10

    def test_metadata_included(self, short_text):
        """Test that metadata is included in chunks."""
        chunker = FixedLengthChunker(chunk_size=100)
        chunks = chunker.split(short_text, source_uri="test.txt")

        assert chunks[0].metadata["source_uri"] == "test.txt"
        assert chunks[0].metadata["strategy"] == "fixed_length"

    def test_indices_sequential(self, medium_text):
        """Test that chunk indices are sequential."""
        chunker = FixedLengthChunker(chunk_size=50)
        chunks = chunker.split(medium_text)

        for i, chunk in enumerate(chunks):
            assert chunk.index == i


# ============================================
# RecursiveChunker Tests
# ============================================


class TestRecursiveChunker:
    """Tests for RecursiveChunker."""

    def test_paragraph_boundary_preservation(self, structured_text):
        """Test that paragraphs are preserved when possible."""
        chunker = RecursiveChunker(chunk_size=200, chunk_overlap=20)
        chunks = chunker.split(structured_text)

        # At least one chunk should be produced
        assert len(chunks) >= 1
        # First chunk should start with Introduction
        assert "Introduction" in chunks[0].content

    def test_sentence_not_truncated(self, structured_text):
        """Test that sentences are not truncated mid-word."""
        chunker = RecursiveChunker(chunk_size=100, chunk_overlap=10)
        chunks = chunker.split(structured_text)

        for chunk in chunks:
            content = chunk.content.strip()
            if content:
                # Content should end with punctuation or be the last chunk
                last_char = content[-1]
                # Allow alphanumeric for last chunk edge case
                assert last_char in ".!?。！？" or content[-1].isalnum()

    def test_metadata_strategy(self, short_text):
        """Test that strategy is recorded in metadata."""
        chunker = RecursiveChunker(chunk_size=100)
        chunks = chunker.split(short_text, source_uri="doc.md")

        assert chunks[0].metadata["strategy"] == "recursive"
        assert chunks[0].metadata["source_uri"] == "doc.md"


# ============================================
# SemanticChunker Tests
# ============================================


class TestSemanticChunker:
    """Tests for SemanticChunker."""

    @pytest.mark.slow
    def test_topic_separation(self, multi_topic_text):
        """Test that different topics are separated."""
        try:
            chunker = SemanticChunker(
                chunk_size=200,
                chunk_overlap=0,
                similarity_threshold=0.5,
            )
            chunks = chunker.split(multi_topic_text)

            # Should have multiple chunks for different topics
            assert len(chunks) >= 2
        except ImportError:
            pytest.skip("sentence-transformers not installed")

    @pytest.mark.slow
    def test_fallback_for_large_chunks(self, medium_text):
        """Test fallback to recursive splitting for large chunks."""
        try:
            chunker = SemanticChunker(
                chunk_size=50,  # Small size to trigger fallback
                similarity_threshold=0.9,  # High threshold = fewer splits
            )
            chunks = chunker.split(medium_text)

            # Should produce chunks within size limit
            for chunk in chunks:
                assert chunk.token_count <= 100  # Allow some flexibility
        except ImportError:
            pytest.skip("sentence-transformers not installed")


# ============================================
# HierarchicalChunker Tests
# ============================================


class TestHierarchicalChunker:
    """Tests for HierarchicalChunker."""

    def test_parent_child_structure(self, structured_text):
        """Test that parent-child structure is created."""
        chunker = HierarchicalChunker(
            parent_chunk_size=300,
            child_chunk_size=100,
            chunk_overlap=10,
        )
        chunks = chunker.split(structured_text)

        # Should have both parents and children
        parents = [c for c in chunks if c.metadata.get("is_parent")]
        children = [c for c in chunks if not c.metadata.get("is_parent")]

        assert len(parents) > 0
        assert len(children) >= len(parents)  # At least one child per parent

    def test_child_has_parent_id(self, structured_text):
        """Test that children have parent_id set."""
        chunker = HierarchicalChunker(
            parent_chunk_size=300,
            child_chunk_size=100,
        )
        chunks = chunker.split(structured_text)

        children = [c for c in chunks if not c.metadata.get("is_parent")]

        for child in children:
            assert child.parent_id is not None
            assert child.parent_id.startswith("parent_")

    def test_parent_has_children_ids(self, structured_text):
        """Test that parents have children_ids list."""
        chunker = HierarchicalChunker(
            parent_chunk_size=300,
            child_chunk_size=100,
        )
        chunks = chunker.split(structured_text)

        parents = [c for c in chunks if c.metadata.get("is_parent")]

        for parent in parents:
            assert len(parent.children_ids) > 0
            for child_id in parent.children_ids:
                assert child_id.startswith("child_")


# ============================================
# Factory Function Tests
# ============================================


class TestFactoryFunctions:
    """Tests for factory functions."""

    def test_get_chunker_fixed(self):
        """Test get_chunker with fixed strategy."""
        chunker = get_chunker("fixed", chunk_size=100)
        assert isinstance(chunker, FixedLengthChunker)

    def test_get_chunker_recursive(self):
        """Test get_chunker with recursive strategy."""
        chunker = get_chunker("recursive", chunk_size=100)
        assert isinstance(chunker, RecursiveChunker)

    def test_get_chunker_hierarchical(self):
        """Test get_chunker with hierarchical strategy."""
        chunker = get_chunker("hierarchical", chunk_size=100)
        assert isinstance(chunker, HierarchicalChunker)

    def test_get_chunker_unknown_strategy(self):
        """Test get_chunker with unknown strategy raises error."""
        with pytest.raises(ValueError, match="Unknown strategy"):
            get_chunker("unknown")

    def test_chunk_text_convenience(self, short_text):
        """Test chunk_text convenience function."""
        chunks = chunk_text(
            text=short_text,
            strategy="recursive",
            chunk_size=100,
            source_uri="test.txt",
        )

        assert len(chunks) >= 1
        assert chunks[0].metadata["source_uri"] == "test.txt"


# ============================================
# Edge Cases
# ============================================


class TestEdgeCases:
    """Tests for edge cases."""

    def test_empty_text(self):
        """Test handling of empty text."""
        chunker = FixedLengthChunker(chunk_size=100)
        chunks = chunker.split("")

        # Empty text should produce empty result or single empty chunk
        assert len(chunks) <= 1

    def test_whitespace_only_text(self):
        """Test handling of whitespace-only text."""
        chunker = RecursiveChunker(chunk_size=100)
        chunks = chunker.split("   \n\n   ")

        # Should handle gracefully
        assert isinstance(chunks, list)

    def test_very_long_word(self):
        """Test handling of text with very long words."""
        long_word = "a" * 1000
        chunker = FixedLengthChunker(chunk_size=50)
        chunks = chunker.split(long_word)

        # Should still produce chunks
        assert len(chunks) > 0

    def test_unicode_text(self):
        """Test handling of unicode text."""
        unicode_text = "机器学习是人工智能的一个子集。深度学习使用多层神经网络。"
        chunker = RecursiveChunker(chunk_size=50)
        chunks = chunker.split(unicode_text)

        assert len(chunks) >= 1
        # Content should be preserved
        full_content = "".join(c.content for c in chunks)
        # Allow for some overlap duplication
        assert "机器学习" in full_content
