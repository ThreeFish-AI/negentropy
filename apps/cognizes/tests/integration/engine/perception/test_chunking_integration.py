"""
Integration tests for Chunking Strategies.

Tests cover end-to-end scenarios:
- Chunking real documents
- Chunking + Embedding pipeline
- Chunking + Database storage
- Performance benchmarks

Task ID: P3-5-2
"""

import pytest
import tempfile
import os
from pathlib import Path

from cognizes.engine.perception.chunking import (
    FixedLengthChunker,
    RecursiveChunker,
    HierarchicalChunker,
    get_chunker,
    chunk_text,
    Chunk,
)


# ============================================
# Test Fixtures
# ============================================


@pytest.fixture
def sample_markdown_doc():
    """A realistic markdown document for testing."""
    return """
# Machine Learning Best Practices

## 1. Data Preparation

Data preparation is crucial for any machine learning project. It involves several key steps:

### 1.1 Data Collection

Gather data from multiple sources. Ensure data quality and consistency.
Consider using web scraping, APIs, or existing datasets.

### 1.2 Data Cleaning

Remove duplicates and handle missing values. Normalize text data.
Convert categorical variables to numerical representations.

### 1.3 Feature Engineering

Create meaningful features from raw data. Use domain knowledge.
Consider automated feature selection techniques.

## 2. Model Selection

Choose the right model for your problem:

- **Classification**: Use Random Forest, SVM, or Neural Networks
- **Regression**: Use Linear Regression, Gradient Boosting, or XGBoost
- **Clustering**: Use K-Means, DBSCAN, or Hierarchical Clustering

### 2.1 Hyperparameter Tuning

Use grid search or random search for hyperparameter optimization.
Consider Bayesian optimization for larger search spaces.

### 2.2 Cross-Validation

Always use cross-validation to evaluate model performance.
Use stratified k-fold for imbalanced datasets.

## 3. Deployment

Deploy your model to production:

1. Containerize with Docker
2. Set up CI/CD pipeline
3. Monitor model performance
4. Plan for model retraining

## Conclusion

Following these best practices will improve your ML project outcomes.
Remember to iterate and continuously improve your approach.
"""


@pytest.fixture
def sample_legal_doc():
    """A legal-style document for hierarchical chunking tests."""
    return """
SOFTWARE LICENSE AGREEMENT

ARTICLE 1: DEFINITIONS

1.1 "Software" means the computer program(s) provided under this Agreement.

1.2 "Licensee" means the individual or entity that has agreed to these terms.

1.3 "Licensor" means the company providing the Software.

1.4 "Effective Date" means the date this Agreement is executed.

ARTICLE 2: LICENSE GRANT

2.1 Subject to the terms and conditions of this Agreement, Licensor hereby
grants to Licensee a non-exclusive, non-transferable license to use the
Software for internal business purposes only.

2.2 The license granted herein is limited to the number of users specified
in the applicable Order Form. Additional users require additional licenses.

2.3 Licensee may make one (1) copy of the Software for backup purposes only.

ARTICLE 3: RESTRICTIONS

3.1 Licensee shall not:
    (a) sublicense, sell, or distribute the Software;
    (b) modify, adapt, or create derivative works;
    (c) reverse engineer or decompile the Software;
    (d) remove any proprietary notices from the Software.

3.2 Licensee shall maintain the confidentiality of the Software.

ARTICLE 4: PAYMENT

4.1 Licensee shall pay all fees as specified in the Order Form.

4.2 All payments are due within thirty (30) days of invoice date.

4.3 Late payments shall incur interest at 1.5% per month.

ARTICLE 5: TERM AND TERMINATION

5.1 This Agreement shall commence on the Effective Date and continue
for a period of one (1) year, unless earlier terminated.

5.2 Either party may terminate this Agreement upon thirty (30) days
written notice for any reason.

5.3 Upon termination, Licensee shall cease all use of the Software
and destroy all copies.
"""


@pytest.fixture
def temp_text_file(sample_markdown_doc):
    """Create a temporary file with sample content."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write(sample_markdown_doc)
        temp_path = f.name

    yield temp_path

    # Cleanup
    os.unlink(temp_path)


# ============================================
# End-to-End Chunking Tests
# ============================================


class TestEndToEndChunking:
    """End-to-end tests for chunking real documents."""

    def test_markdown_document_chunking(self, sample_markdown_doc):
        """Test chunking a realistic markdown document."""
        chunker = RecursiveChunker(chunk_size=200, chunk_overlap=30)
        chunks = chunker.split(sample_markdown_doc, source_uri="best_practices.md")

        # Should produce at least one chunk (doc is ~330 tokens, chunk_size=200)
        assert len(chunks) >= 1

        # Headers should be preserved in chunks
        content_concat = " ".join(c.content for c in chunks)
        assert "Machine Learning Best Practices" in content_concat
        assert "Data Preparation" in content_concat
        assert "Model Selection" in content_concat

        # Each chunk should have metadata
        for chunk in chunks:
            assert chunk.metadata["source_uri"] == "best_practices.md"
            assert chunk.token_count > 0

    def test_legal_document_hierarchical_chunking(self, sample_legal_doc):
        """Test hierarchical chunking of legal document."""
        chunker = HierarchicalChunker(
            parent_chunk_size=500,
            child_chunk_size=150,
            chunk_overlap=20,
        )
        chunks = chunker.split(sample_legal_doc, source_uri="license.txt")

        # Separate parents and children
        parents = [c for c in chunks if c.metadata.get("is_parent")]
        children = [c for c in chunks if not c.metadata.get("is_parent")]

        # Should have hierarchical structure (doc is ~400 tokens, parent_size=500)
        assert len(parents) >= 1
        assert len(children) >= 1

        # Verify parent-child relationships
        for parent in parents:
            assert len(parent.children_ids) > 0

            # Find children of this parent
            parent_children = [c for c in children if c.parent_id == parent.metadata.get("chunk_id")]
            assert len(parent_children) == len(parent.children_ids)

    def test_file_chunking(self, temp_text_file):
        """Test chunking from a file."""
        # Read file content
        with open(temp_text_file, "r") as f:
            content = f.read()

        source_uri = Path(temp_text_file).name
        chunks = chunk_text(
            text=content,
            strategy="recursive",
            chunk_size=150,
            chunk_overlap=20,
            source_uri=source_uri,
        )

        assert len(chunks) > 0
        assert all(c.metadata["source_uri"] == source_uri for c in chunks)


# ============================================
# Chunking Pipeline Tests
# ============================================


class TestChunkingPipeline:
    """Tests for chunking as part of a larger pipeline."""

    def test_chunk_to_embedding_ready_format(self, sample_markdown_doc):
        """Test that chunks are ready for embedding."""
        chunker = RecursiveChunker(chunk_size=256)
        chunks = chunker.split(sample_markdown_doc, source_uri="doc.md")

        # Each chunk should be suitable for embedding
        for chunk in chunks:
            # Content should be non-empty
            assert len(chunk.content.strip()) > 0

            # Token count should be reasonable for embedding models
            assert chunk.token_count <= 512  # Most models support up to 512

            # Should have required metadata
            assert "source_uri" in chunk.metadata
            assert chunk.index >= 0

    def test_hierarchical_chunks_for_retrieval(self, sample_legal_doc):
        """Test that hierarchical chunks support two-stage retrieval."""
        chunker = HierarchicalChunker(
            parent_chunk_size=400,
            child_chunk_size=100,
        )
        chunks = chunker.split(sample_legal_doc)

        parents = {c.metadata["chunk_id"]: c for c in chunks if c.metadata.get("is_parent")}
        children = [c for c in chunks if not c.metadata.get("is_parent")]

        # Simulate retrieval: find children, then get parent context
        sample_child = children[0]
        parent_id = sample_child.parent_id

        # Should be able to look up parent
        assert parent_id in parents
        parent = parents[parent_id]

        # Parent should provide broader context
        assert len(parent.content) > len(sample_child.content)


# ============================================
# Strategy Comparison Tests
# ============================================


class TestStrategyComparison:
    """Compare different chunking strategies."""

    def test_strategy_chunk_counts(self, sample_markdown_doc):
        """Compare chunk counts across strategies."""
        strategies = ["fixed", "recursive"]
        results = {}

        for strategy in strategies:
            chunks = chunk_text(
                text=sample_markdown_doc,
                strategy=strategy,
                chunk_size=200,
                chunk_overlap=20,
            )
            results[strategy] = len(chunks)

        # All strategies should produce chunks
        for strategy, count in results.items():
            assert count > 0, f"{strategy} produced no chunks"

    def test_strategy_content_preservation(self, sample_markdown_doc):
        """Verify all strategies preserve content (with possible overlap)."""
        strategies = ["fixed", "recursive"]

        for strategy in strategies:
            chunks = chunk_text(
                text=sample_markdown_doc,
                strategy=strategy,
                chunk_size=200,
                chunk_overlap=0,  # No overlap for this test
            )

            # Key content should be present
            combined = " ".join(c.content for c in chunks)
            assert "Machine Learning" in combined
            assert "Deployment" in combined


# ============================================
# Performance Tests
# ============================================


class TestChunkingPerformance:
    """Performance tests for chunking strategies."""

    @pytest.mark.slow
    def test_large_document_performance(self):
        """Test chunking performance on large documents."""
        import time

        # Generate large document (~100KB)
        large_doc = "Machine learning is transforming industries. " * 5000

        chunker = RecursiveChunker(chunk_size=512, chunk_overlap=50)

        start = time.perf_counter()
        chunks = chunker.split(large_doc)
        elapsed = time.perf_counter() - start

        # Should complete in reasonable time (< 5 seconds)
        assert elapsed < 5.0, f"Chunking took {elapsed:.2f}s"
        assert len(chunks) > 10

    def test_concurrent_chunking(self, sample_markdown_doc):
        """Test that chunking is thread-safe."""
        import concurrent.futures

        def chunk_document(doc_id):
            chunks = chunk_text(
                text=sample_markdown_doc,
                strategy="recursive",
                chunk_size=100,
                source_uri=f"doc_{doc_id}.md",
            )
            return (doc_id, len(chunks))

        # Chunk multiple documents concurrently
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            futures = [executor.submit(chunk_document, i) for i in range(10)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        # All should complete successfully
        assert len(results) == 10
        for doc_id, chunk_count in results:
            assert chunk_count > 0


# ============================================
# Database Integration Tests
# ============================================


class TestDatabaseIntegration:
    """Tests for integrating chunks with database storage."""

    def test_chunk_to_knowledge_base_format(self, sample_markdown_doc):
        """Test converting chunks to knowledge_base table format."""
        import uuid

        chunker = RecursiveChunker(chunk_size=200)
        chunks = chunker.split(sample_markdown_doc, source_uri="guide.md")

        # Convert to database records
        corpus_id = uuid.uuid4()
        app_name = "test_app"

        records = []
        for chunk in chunks:
            record = {
                "id": uuid.uuid4(),
                "corpus_id": corpus_id,
                "app_name": app_name,
                "content": chunk.content,
                "source_uri": chunk.metadata.get("source_uri"),
                "chunk_index": chunk.index,
                "metadata": {
                    "strategy": chunk.metadata.get("strategy"),
                    "token_count": chunk.token_count,
                },
            }
            records.append(record)

        # Verify records
        assert len(records) == len(chunks)
        for record in records:
            assert record["content"]
            assert record["corpus_id"] == corpus_id
            assert record["app_name"] == app_name

    def test_hierarchical_chunks_to_db_format(self, sample_legal_doc):
        """Test converting hierarchical chunks to DB format with relationships."""
        import uuid

        chunker = HierarchicalChunker(
            parent_chunk_size=400,
            child_chunk_size=100,
        )
        chunks = chunker.split(sample_legal_doc)

        corpus_id = uuid.uuid4()

        # Create records with proper relationships
        records = []
        chunk_id_map = {}  # Map internal IDs to UUIDs

        for chunk in chunks:
            db_id = uuid.uuid4()
            internal_id = chunk.metadata.get("chunk_id", f"chunk_{chunk.index}")
            chunk_id_map[internal_id] = db_id

            record = {
                "id": db_id,
                "corpus_id": corpus_id,
                "content": chunk.content,
                "chunk_index": chunk.index,
                "metadata": {
                    "is_parent": chunk.metadata.get("is_parent", False),
                    "internal_id": internal_id,
                    "parent_internal_id": chunk.parent_id,
                    "children_internal_ids": chunk.children_ids,
                },
            }
            records.append(record)

        # Verify parent-child relationships can be resolved
        parents = [r for r in records if r["metadata"]["is_parent"]]
        children = [r for r in records if not r["metadata"]["is_parent"]]

        assert len(parents) > 0
        assert len(children) > 0

        # Each child should have a valid parent reference
        for child in children:
            parent_internal_id = child["metadata"]["parent_internal_id"]
            assert parent_internal_id in chunk_id_map
