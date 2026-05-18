"""
Unit tests for RAG Pipeline.

Tests cover:
- RetrievalResult and RAGResponse
- RAGPipeline indexing
- RAGPipeline retrieval (mock)
- RAGPipeline generation (mock)
- End-to-end query (mock)

Task ID: P3-5-4
"""

import pytest
from cognizes.engine.perception.rag_pipeline import (
    RAGPipeline,
    RAGResponse,
    RetrievalResult,
    IndexingResult,
    get_rag_pipeline,
)

# pytest-asyncio 配置
pytestmark = pytest.mark.asyncio


# ============================================
# Dataclass Tests
# ============================================


class TestRetrievalResult:
    """Tests for RetrievalResult dataclass."""

    def test_creation(self):
        """Test basic creation."""
        result = RetrievalResult(
            id="doc_1",
            content="Test content",
            score=0.95,
            source_uri="test.txt",
        )

        assert result.id == "doc_1"
        assert result.content == "Test content"
        assert result.score == 0.95


class TestRAGResponse:
    """Tests for RAGResponse dataclass."""

    def test_creation(self):
        """Test basic creation."""
        response = RAGResponse(
            query="What is ML?",
            answer="ML is...",
            sources=[],
            retrieval_time_ms=10.5,
            generation_time_ms=50.0,
            total_time_ms=60.5,
        )

        assert response.query == "What is ML?"
        assert response.answer == "ML is..."
        assert response.total_time_ms == 60.5


# ============================================
# RAGPipeline Tests (Mock Mode)
# ============================================


class TestRAGPipelineMock:
    """Tests for RAGPipeline in mock mode (no database)."""

    @pytest.fixture
    def pipeline(self):
        """Create pipeline without database."""
        return get_rag_pipeline(
            db_pool=None,
            app_name="test_app",
            embedding_provider="mock",
        )

    async def test_index_document(self, pipeline):
        """Test document indexing (mock mode)."""
        result = await pipeline.index_document(
            content="Machine learning is a subset of AI.",
            source_uri="test.txt",
        )

        assert isinstance(result, IndexingResult)
        assert result.source_uri == "test.txt"
        # No DB, so chunks_indexed is 0
        assert result.chunks_indexed == 0

    async def test_retrieve_mock(self, pipeline):
        """Test retrieval in mock mode."""
        results = await pipeline.retrieve(
            query="What is machine learning?",
            top_k=5,
        )

        # Should return mock results
        assert len(results) == 5
        assert all(isinstance(r, RetrievalResult) for r in results)

    async def test_generate_mock(self, pipeline):
        """Test generation in mock mode."""
        context = [
            RetrievalResult(
                id="1",
                content="ML is AI",
                score=0.9,
                source_uri="doc.txt",
            ),
        ]
        answer = await pipeline.generate(
            query="What is ML?",
            context=context,
        )

        # Should return mock answer (no LLM configured)
        assert isinstance(answer, str)
        assert "Mock answer" in answer

    async def test_query_e2e_mock(self, pipeline):
        """Test end-to-end query in mock mode."""
        response = await pipeline.query(
            query="What is machine learning?",
            top_k=3,
        )

        assert isinstance(response, RAGResponse)
        assert response.query == "What is machine learning?"
        assert len(response.sources) <= 3
        assert response.total_time_ms > 0


# ============================================
# Factory Function Tests
# ============================================


class TestRAGPipelineFactory:
    """Tests for RAG pipeline factory functions."""

    def test_get_rag_pipeline_default(self):
        """Test creating pipeline with defaults."""
        pipeline = get_rag_pipeline()

        assert pipeline is not None
        assert pipeline.app_name == "default"
        assert pipeline.use_knowledge_base is True

    def test_get_rag_pipeline_custom(self):
        """Test creating pipeline with custom settings."""
        pipeline = get_rag_pipeline(
            app_name="my_app",
            use_knowledge_base=False,
        )

        assert pipeline.app_name == "my_app"
        assert pipeline.use_knowledge_base is False
