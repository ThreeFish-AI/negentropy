"""Tests for TopicClusterStep — topic clustering via embedding similarity."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import (
    TopicClusterStep,
    _cosine_distance,
    _extract_label,
)

from .conftest import _new_ctx


class TestTopicClusterPureFunctions:
    """Tests for TopicClusterStep pure helper functions."""

    def test_cosine_distance_identical_vectors(self):
        a = [1.0, 0.0, 0.0]
        dist = _cosine_distance(a, a)
        assert abs(dist) < 1e-9

    def test_cosine_distance_orthogonal_vectors(self):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        dist = _cosine_distance(a, b)
        assert abs(dist - 1.0) < 1e-9

    def test_cosine_distance_zero_vector_returns_one(self):
        a = [0.0, 0.0, 0.0]
        b = [1.0, 2.0, 3.0]
        assert _cosine_distance(a, b) == 1.0
        assert _cosine_distance(b, a) == 1.0

    def test_cosine_distance_both_zero_vectors_returns_one(self):
        assert _cosine_distance([0.0, 0.0], [0.0, 0.0]) == 1.0

    def test_cosine_distance_known_value(self):
        a = [1.0, 2.0, 3.0]
        b = [4.0, 5.0, 6.0]
        dist = _cosine_distance(a, b)
        assert abs(dist - (1.0 - 32.0 / (14**0.5 * 77**0.5))) < 1e-9

    def test_extract_label_basic_english(self):
        contents = ["Python is great for data science", "Python machine learning libraries"]
        label = _extract_label(contents)
        assert "python" in label

    def test_extract_label_filters_stop_words(self):
        contents = ["the cat is on the mat"]
        label = _extract_label(contents)
        assert "the" not in label.split("_")
        assert "cat" in label

    def test_extract_label_returns_topic_for_no_words(self):
        contents = ["!!! ??? ..."]
        label = _extract_label(contents)
        assert label == "topic"

    def test_extract_label_returns_topic_for_only_stop_words(self):
        contents = ["the is are was were"]
        label = _extract_label(contents)
        assert label == "topic"

    def test_extract_label_chinese_characters(self):
        contents = ["机器学习 机器学习 深度学习", "机器学习 神经网络"]
        label = _extract_label(contents)
        assert "机器学习" in label

    def test_extract_label_returns_top_three_keywords(self):
        contents = [
            "kotlin kotlin kotlin",
            "android android gradle gradle",
            "kotlin android gradle",
        ]
        label = _extract_label(contents)
        parts = label.split("_")
        assert len(parts) == 3
        assert parts[0] == "kotlin"

    def test_extract_label_empty_contents(self):
        label = _extract_label([])
        assert label == "topic"

    def test_extract_label_single_char_words_excluded(self):
        contents = ["a I x y z"]
        label = _extract_label(contents)
        assert label == "topic"


class TestTopicClusterStep:
    """Tests for TopicClusterStep run() with mocked DB."""

    async def test_skipped_when_no_new_memory_ids(self):
        step = TopicClusterStep()
        ctx = _new_ctx()
        ctx.new_memory_ids = []
        result = await step.run(ctx)
        assert result.status == "skipped"
        assert result.output_count == 0
        assert result.step_name == "topic_cluster"

    async def test_success_with_fewer_than_2_embeddings(self):
        ctx = _new_ctx()
        ctx.new_memory_ids = [uuid4()]

        fake_row = MagicMock()
        fake_row.id = ctx.new_memory_ids[0]
        fake_row.content = "test content"
        fake_row.embedding = [0.1, 0.2, 0.3]

        mock_result = MagicMock()
        mock_result.all.return_value = [fake_row]

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = TopicClusterStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 0

    async def test_clusters_two_similar_memories_and_labels(self):
        id_a, id_b = uuid4(), uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [id_a, id_b]

        row_a = MagicMock()
        row_a.id = id_a
        row_a.content = "Python data analysis"
        row_a.embedding = [1.0, 0.0, 0.0]

        row_b = MagicMock()
        row_b.id = id_b
        row_b.content = "Python machine learning"
        row_b.embedding = [0.99, 0.01, 0.0]

        mock_result = MagicMock()
        mock_result.all.return_value = [row_a, row_b]

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = TopicClusterStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 2
        assert len(ctx.topics) == 1
        assert ctx.topics[0]["memory_count"] == 2
        assert "python" in ctx.topics[0]["label"]

    async def test_no_cluster_for_dissimilar_memories(self):
        id_a, id_b = uuid4(), uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [id_a, id_b]

        row_a = MagicMock()
        row_a.id = id_a
        row_a.content = "cooking recipes"
        row_a.embedding = [1.0, 0.0]

        row_b = MagicMock()
        row_b.id = id_b
        row_b.content = "quantum physics"
        row_b.embedding = [0.0, 1.0]

        mock_result = MagicMock()
        mock_result.all.return_value = [row_a, row_b]

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = TopicClusterStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 0
        assert ctx.topics == []

    async def test_none_embedding_rows_skipped_in_clustering(self):
        id_a, id_b, id_c = uuid4(), uuid4(), uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [id_a, id_b, id_c]

        row_a = MagicMock()
        row_a.id = id_a
        row_a.content = "test a"
        row_a.embedding = None

        row_b = MagicMock()
        row_b.id = id_b
        row_b.content = "test b"
        row_b.embedding = [1.0, 0.0]

        row_c = MagicMock()
        row_c.id = id_c
        row_c.content = "test c"
        row_c.embedding = [0.99, 0.01]

        mock_result = MagicMock()
        mock_result.all.return_value = [row_a, row_b, row_c]

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = TopicClusterStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count >= 0
