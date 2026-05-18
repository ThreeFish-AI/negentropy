"""
Unit tests for Document Ingestion Service.

Tests cover:
- Document parsers (Markdown, Text, PDF)
- DocumentIngester service
- Factory functions

Task ID: P3-5-1
"""

import pytest
import tempfile
import os
from pathlib import Path
from cognizes.engine.perception.ingestion import (
    Document,
    IngestedDocument,
    MarkdownParser,
    TextParser,
    DocumentIngester,
    get_ingester,
)

# pytest-asyncio 配置
pytestmark = pytest.mark.asyncio


# ============================================
# Document Dataclass Tests
# ============================================


class TestDocumentDataclass:
    """Tests for Document dataclass."""

    def test_document_creation(self):
        """Test basic document creation."""
        doc = Document(
            content="Test content",
            source_uri="test.txt",
            doc_id="",
        )

        assert doc.content == "Test content"
        assert doc.source_uri == "test.txt"
        assert doc.doc_id != ""  # Should be auto-generated

    def test_document_id_generation(self):
        """Test document ID is generated from content."""
        doc1 = Document(content="Same content", source_uri="a.txt", doc_id="")
        doc2 = Document(content="Same content", source_uri="b.txt", doc_id="")

        # Same content should produce same doc_id
        assert doc1.doc_id == doc2.doc_id


# ============================================
# Parser Tests
# ============================================


class TestMarkdownParser:
    """Tests for MarkdownParser."""

    def test_parse_markdown(self):
        """Test parsing markdown content."""
        parser = MarkdownParser()
        content = "# My Title\n\nThis is the content."

        doc = parser.parse(content, "test.md")

        assert doc.title == "My Title"
        assert "This is the content" in doc.content
        assert doc.mime_type == "text/markdown"

    def test_supported_extensions(self):
        """Test supported file extensions."""
        parser = MarkdownParser()

        assert ".md" in parser.supported_extensions
        assert ".markdown" in parser.supported_extensions


class TestTextParser:
    """Tests for TextParser."""

    def test_parse_text(self):
        """Test parsing plain text."""
        parser = TextParser()
        content = "Plain text content"

        doc = parser.parse(content, "document.txt")

        assert doc.content == "Plain text content"
        assert doc.title == "document"
        assert doc.mime_type == "text/plain"


# ============================================
# DocumentIngester Tests
# ============================================


class TestDocumentIngester:
    """Tests for DocumentIngester service."""

    @pytest.fixture
    def ingester(self):
        """Create ingester with mock embedder."""
        return get_ingester(embedding_provider="mock")

    @pytest.fixture
    def sample_markdown(self):
        """Sample markdown content."""
        return """
# Machine Learning Guide

## Introduction

Machine learning is a subset of AI that enables computers to learn from data.

## Methods

Common methods include supervised learning, unsupervised learning, and reinforcement learning.
"""

    async def test_ingest_text(self, ingester, sample_markdown):
        """Test ingesting text content."""
        result = await ingester.ingest_text(
            content=sample_markdown,
            source_uri="guide.md",
        )

        assert isinstance(result, IngestedDocument)
        assert len(result.chunks) > 0
        assert result.document.source_uri == "guide.md"

    async def test_chunks_have_embeddings(self, ingester, sample_markdown):
        """Test that chunks have embeddings."""
        result = await ingester.ingest_text(
            content=sample_markdown,
            source_uri="test.md",
            generate_embeddings=True,
        )

        # All chunks should have embeddings
        for chunk in result.chunks:
            assert "embedding" in chunk
            assert len(chunk["embedding"]) > 0

    async def test_ingest_without_embeddings(self, ingester, sample_markdown):
        """Test ingesting without embeddings."""
        result = await ingester.ingest_text(
            content=sample_markdown,
            source_uri="test.md",
            generate_embeddings=False,
        )

        # Chunks should not have embeddings
        for chunk in result.chunks:
            assert "embedding" not in chunk

    async def test_ingest_file(self, ingester):
        """Test ingesting from file."""
        # Create temp file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("# Test\n\nTest content for ingestion.")
            temp_path = f.name

        try:
            result = await ingester.ingest_file(temp_path)

            assert isinstance(result, IngestedDocument)
            assert result.document.title == "Test"
        finally:
            os.unlink(temp_path)


# ============================================
# Factory Function Tests
# ============================================


class TestIngesterFactory:
    """Tests for ingester factory functions."""

    def test_get_ingester_default(self):
        """Test creating ingester with defaults."""
        ingester = get_ingester()

        assert ingester is not None
        assert ingester.chunker is not None
        assert ingester.embedder is not None

    def test_get_ingester_custom_chunk_size(self):
        """Test creating ingester with custom chunk size."""
        ingester = get_ingester(chunk_size=256, chunk_overlap=25)

        assert ingester.chunker.chunk_size == 256
        assert ingester.chunker.chunk_overlap == 25
