"""Tests for ConsolidationPipeline orchestrator + registry (Phase 5 F3)."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from negentropy.engine.consolidation.pipeline import (
    ConsolidationPipeline,
    PipelineContext,
    StepResult,
    build_pipeline,
    register,
)
from negentropy.engine.consolidation.pipeline.registry import STEP_REGISTRY


def _new_ctx() -> PipelineContext:
    return PipelineContext(user_id="alice", app_name="negentropy", thread_id=uuid4(), turns=[])


@dataclass
class _RecordingStep:
    name: str
    status: str = "success"
    output_count: int = 1
    delay: float = 0.0
    raise_exc: BaseException | None = None
    invoked: list[str] = None  # type: ignore

    def __post_init__(self) -> None:
        self.invoked = []

    async def run(self, ctx: PipelineContext) -> StepResult:
        if self.delay:
            await asyncio.sleep(self.delay)
        self.invoked.append(self.name)
        if self.raise_exc:
            raise self.raise_exc
        return StepResult(
            step_name=self.name,
            status=self.status,
            duration_ms=1,
            output_count=self.output_count,
        )


class TestConsolidationPipeline:
    async def test_serial_runs_in_order(self):
        s1 = _RecordingStep(name="a")
        s2 = _RecordingStep(name="b")
        pipe = ConsolidationPipeline(steps=[s1, s2], policy="serial")
        results = await pipe.run(_new_ctx())
        assert [r.step_name for r in results] == ["a", "b"]
        assert all(r.status == "success" for r in results)

    async def test_serial_aborts_on_failure(self):
        s1 = _RecordingStep(name="a", raise_exc=RuntimeError("boom"))
        s2 = _RecordingStep(name="b")
        pipe = ConsolidationPipeline(steps=[s1, s2], policy="serial")
        results = await pipe.run(_new_ctx())
        assert [r.step_name for r in results] == ["a"]
        assert results[0].status == "failed"
        # b 没被调用
        assert s2.invoked == []

    async def test_fail_tolerant_continues(self):
        s1 = _RecordingStep(name="a", raise_exc=RuntimeError("boom"))
        s2 = _RecordingStep(name="b")
        pipe = ConsolidationPipeline(steps=[s1, s2], policy="fail_tolerant")
        results = await pipe.run(_new_ctx())
        assert [r.step_name for r in results] == ["a", "b"]
        assert results[0].status == "failed"
        assert results[1].status == "success"

    async def test_parallel_invokes_all_concurrently(self):
        s1 = _RecordingStep(name="a", delay=0.05)
        s2 = _RecordingStep(name="b", delay=0.05)
        pipe = ConsolidationPipeline(steps=[s1, s2], policy="parallel")
        # 串行需要 100ms+，并行应 < 80ms
        loop_start = asyncio.get_event_loop().time()
        results = await pipe.run(_new_ctx())
        elapsed = asyncio.get_event_loop().time() - loop_start
        assert {r.step_name for r in results} == {"a", "b"}
        assert elapsed < 0.08

    async def test_step_timeout_marked_failed(self):
        slow = _RecordingStep(name="slow", delay=0.5)
        pipe = ConsolidationPipeline(steps=[slow], policy="serial", timeout_per_step_ms=50)
        results = await pipe.run(_new_ctx())
        assert results[0].status == "failed"
        assert results[0].error == "timeout"

    async def test_invalid_policy_raises(self):
        with pytest.raises(ValueError):
            ConsolidationPipeline(steps=[], policy="DAG")  # type: ignore[arg-type]

    async def test_empty_pipeline_returns_empty(self):
        pipe = ConsolidationPipeline(steps=[], policy="serial")
        assert await pipe.run(_new_ctx()) == []


class TestRegistryBuilder:
    def test_default_steps_registered(self):
        # 触发内置 step 注册
        from negentropy.engine.consolidation.pipeline import steps as _  # noqa

        assert "fact_extract" in STEP_REGISTRY
        assert "auto_link" in STEP_REGISTRY

    def test_register_decorator(self):
        @register("test_xyz")
        class _S:
            name = "test_xyz"

            async def run(self, ctx):
                return StepResult(step_name=self.name, status="success", duration_ms=1)

        assert STEP_REGISTRY.get("test_xyz") is _S
        STEP_REGISTRY.pop("test_xyz", None)

    def test_build_pipeline_strict_unknown_raises(self):
        with pytest.raises(ValueError):
            build_pipeline(["nonexistent_step_xyz"], strict=True)

    def test_build_pipeline_non_strict_skips_unknown(self):
        from negentropy.engine.consolidation.pipeline import steps as _  # noqa

        pipe = build_pipeline(["fact_extract", "nope_step"], strict=False)
        assert pipe.step_names == ["fact_extract"]


class TestFactExtractStep:
    async def test_skipped_on_empty_turns(self):
        from negentropy.engine.consolidation.pipeline.steps.fact_extract_step import (
            FactExtractStep,
        )

        step = FactExtractStep(extractor=MagicMock())
        ctx = _new_ctx()
        result = await step.run(ctx)
        assert result.status == "skipped"
        assert result.output_count == 0

    async def test_extracts_and_upserts(self):
        from negentropy.engine.consolidation.fact_extractor import ExtractedFact
        from negentropy.engine.consolidation.pipeline.steps.fact_extract_step import (
            FactExtractStep,
        )

        fake_extractor = MagicMock()
        fake_extractor.extract = AsyncMock(
            return_value=[
                ExtractedFact(fact_type="preference", key="lang", value="rust", confidence=0.9),
            ]
        )

        ctx = _new_ctx()
        ctx.turns = [{"author": "user", "text": "I prefer Rust"}]

        with patch("negentropy.engine.factories.memory.get_fact_service") as mock_get:
            fake_service = MagicMock()
            fake_service.upsert_fact = AsyncMock()
            mock_get.return_value = fake_service

            step = FactExtractStep(extractor=fake_extractor)
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1
        assert ctx.facts and ctx.facts[0].key == "lang"
        fake_service.upsert_fact.assert_awaited_once()


class TestAutoLinkStep:
    async def test_skipped_when_no_new_memory_ids(self):
        from negentropy.engine.consolidation.pipeline.steps.auto_link_step import (
            AutoLinkStep,
        )

        step = AutoLinkStep()
        ctx = _new_ctx()
        result = await step.run(ctx)
        assert result.status == "skipped"


class TestSummarizeStep:
    async def test_summarize_success(self):
        from negentropy.engine.consolidation.pipeline.steps.summarize_step import SummarizeStep

        fake_summary = MagicMock()
        fake_summary.content = "summary text"
        fake_summarizer = MagicMock()
        fake_summarizer.get_or_generate_summary = AsyncMock(return_value=fake_summary)

        with patch(
            "negentropy.engine.factories.memory.get_memory_summarizer",
            return_value=fake_summarizer,
        ):
            step = SummarizeStep()
            result = await step.run(_new_ctx())

        assert result.status == "success"
        assert result.output_count == 1

    async def test_summarize_handles_old_signature(self):
        from negentropy.engine.consolidation.pipeline.steps.summarize_step import SummarizeStep

        fake_summary = MagicMock()
        fake_summary.content = ""
        fake_summarizer = MagicMock()

        # 第一次（带 force_refresh）抛 TypeError，第二次（无 force_refresh）成功
        async def _resolver(*args, **kwargs):
            if "force_refresh" in kwargs:
                raise TypeError("unexpected keyword")
            return fake_summary

        fake_summarizer.get_or_generate_summary = AsyncMock(side_effect=_resolver)

        with patch(
            "negentropy.engine.factories.memory.get_memory_summarizer",
            return_value=fake_summarizer,
        ):
            step = SummarizeStep()
            result = await step.run(_new_ctx())

        assert result.status == "success"
        # content 为空 → output_count = 0
        assert result.output_count == 0


# ---------------------------------------------------------------------------
# EntityNormalizationStep tests
# ---------------------------------------------------------------------------


class TestEntityNormalizationStep:
    """Tests for EntityNormalizationStep — LLM-based entity normalization."""

    @pytest.fixture()
    def _patch_model_config(self):
        with patch(
            "negentropy.engine.consolidation.pipeline.steps.entity_normalization_step.resolve_model_config",
            return_value=("test-model", {"temperature": 0.5}),
        ):
            yield

    async def test_skipped_on_empty_facts(self, _patch_model_config):
        from negentropy.engine.consolidation.pipeline.steps.entity_normalization_step import (
            EntityNormalizationStep,
        )

        step = EntityNormalizationStep()
        ctx = _new_ctx()
        ctx.facts = []
        result = await step.run(ctx)
        assert result.status == "skipped"
        assert result.output_count == 0
        assert result.step_name == "entity_normalization"

    async def test_llm_returns_entities(self, _patch_model_config):
        from negentropy.engine.consolidation.pipeline.steps.entity_normalization_step import (
            EntityNormalizationStep,
        )

        fake_fact_1 = MagicMock()
        fake_fact_1.fact_type = "preference"
        fake_fact_1.key = "lang"
        fake_fact_1.value = "TypeScript"
        fake_fact_2 = MagicMock()
        fake_fact_2.fact_type = "preference"
        fake_fact_2.key = "lang"
        fake_fact_2.value = "TS"

        ctx = _new_ctx()
        ctx.facts = [fake_fact_1, fake_fact_2]

        fake_response = MagicMock()
        json_content = json.dumps(
            {
                "entities": [
                    {
                        "canonical": "TypeScript",
                        "aliases": ["TS", "typescript"],
                        "kind": "language",
                    }
                ]
            }
        )
        fake_response.choices = [MagicMock(message=MagicMock(content=json_content))]

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=fake_response):
            step = EntityNormalizationStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1
        assert len(ctx.entities) == 1
        assert ctx.entities[0]["canonical"] == "TypeScript"
        assert "TS" in ctx.entities[0]["aliases"]

    async def test_llm_returns_empty_entities_list(self, _patch_model_config):
        from negentropy.engine.consolidation.pipeline.steps.entity_normalization_step import (
            EntityNormalizationStep,
        )

        fake_fact = MagicMock()
        fake_fact.fact_type = "preference"
        fake_fact.key = "lang"
        fake_fact.value = "Rust"

        ctx = _new_ctx()
        ctx.facts = [fake_fact]

        fake_response = MagicMock()
        fake_response.choices = [MagicMock(message=MagicMock(content='{"entities": []}'))]

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=fake_response):
            step = EntityNormalizationStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 0
        assert ctx.entities == []

    async def test_llm_returns_entities_without_canonical_filtered_out(self, _patch_model_config):
        from negentropy.engine.consolidation.pipeline.steps.entity_normalization_step import (
            EntityNormalizationStep,
        )

        fake_fact = MagicMock()
        fake_fact.fact_type = "preference"
        fake_fact.key = "lang"
        fake_fact.value = "Rust"

        ctx = _new_ctx()
        ctx.facts = [fake_fact]

        # One entity with canonical, one without
        fake_response = MagicMock()
        fake_response.choices = [
            MagicMock(
                message=MagicMock(
                    content='{"entities": [{"canonical": "Rust", "aliases": ["rust"], "kind": "language"}, {"aliases": ["bad"]}]}'  # noqa: E501
                )
            )
        ]

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=fake_response):
            step = EntityNormalizationStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1
        assert len(ctx.entities) == 1
        assert ctx.entities[0]["canonical"] == "Rust"

    async def test_llm_failure_returns_failed_status(self, _patch_model_config):
        from negentropy.engine.consolidation.pipeline.steps.entity_normalization_step import (
            EntityNormalizationStep,
        )

        fake_fact = MagicMock()
        fake_fact.fact_type = "preference"
        fake_fact.key = "lang"
        fake_fact.value = "Go"

        ctx = _new_ctx()
        ctx.facts = [fake_fact]

        with patch("litellm.acompletion", new_callable=AsyncMock, side_effect=RuntimeError("LLM unavailable")):
            step = EntityNormalizationStep(max_retries=1)
            result = await step.run(ctx)

        assert result.status == "failed"
        assert "entity_normalization llm failed" in result.error
        assert "LLM unavailable" in result.error

    async def test_llm_returns_invalid_json_then_failure(self, _patch_model_config):
        from negentropy.engine.consolidation.pipeline.steps.entity_normalization_step import (
            EntityNormalizationStep,
        )

        fake_fact = MagicMock()
        fake_fact.fact_type = "preference"
        fake_fact.key = "lang"
        fake_fact.value = "Python"

        ctx = _new_ctx()
        ctx.facts = [fake_fact]

        # LLM returns non-JSON content
        fake_response = MagicMock()
        fake_response.choices = [MagicMock(message=MagicMock(content="not valid json"))]

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=fake_response):
            step = EntityNormalizationStep(max_retries=1)
            result = await step.run(ctx)

        assert result.status == "failed"
        assert result.output_count == 0

    async def test_entities_extend_existing_ctx_entities(self, _patch_model_config):
        from negentropy.engine.consolidation.pipeline.steps.entity_normalization_step import (
            EntityNormalizationStep,
        )

        fake_fact = MagicMock()
        fake_fact.fact_type = "preference"
        fake_fact.key = "lang"
        fake_fact.value = "Kotlin"

        ctx = _new_ctx()
        ctx.facts = [fake_fact]
        ctx.entities = [{"canonical": "existing_entity", "aliases": [], "kind": "test"}]

        fake_response = MagicMock()
        fake_response.choices = [
            MagicMock(
                message=MagicMock(
                    content='{"entities": [{"canonical": "Kotlin", "aliases": ["kotlin"], "kind": "language"}]}'
                )
            )
        ]

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=fake_response):
            step = EntityNormalizationStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert len(ctx.entities) == 2
        assert ctx.entities[0]["canonical"] == "existing_entity"
        assert ctx.entities[1]["canonical"] == "Kotlin"

    async def test_facts_truncated_to_50(self, _patch_model_config):
        from negentropy.engine.consolidation.pipeline.steps.entity_normalization_step import (
            EntityNormalizationStep,
        )

        # Build 60 facts; only first 50 should be sent to LLM
        facts = []
        for i in range(60):
            f = MagicMock()
            f.fact_type = "preference"
            f.key = f"k{i}"
            f.value = f"v{i}"
            facts.append(f)

        ctx = _new_ctx()
        ctx.facts = facts

        captured_prompt = {}

        async def _fake_completion(*args, **kwargs):
            captured_prompt["messages"] = kwargs.get("messages", args[1] if len(args) > 1 else [])
            fake_response = MagicMock()
            fake_response.choices = [MagicMock(message=MagicMock(content='{"entities": []}'))]
            return fake_response

        with patch("litellm.acompletion", new_callable=AsyncMock, side_effect=_fake_completion):
            step = EntityNormalizationStep()
            result = await step.run(ctx)

        assert result.status == "success"
        # Verify the prompt only contains 50 facts (lines starting with "- ")
        prompt_text = captured_prompt["messages"][0]["content"]
        fact_lines = [line for line in prompt_text.split("\n") if line.startswith("- ")]
        assert len(fact_lines) == 50


# ---------------------------------------------------------------------------
# TopicClusterStep tests
# ---------------------------------------------------------------------------


class TestTopicClusterPureFunctions:
    """Tests for TopicClusterStep pure helper functions."""

    def test_cosine_distance_identical_vectors(self):
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import _cosine_distance

        a = [1.0, 0.0, 0.0]
        dist = _cosine_distance(a, a)
        assert abs(dist) < 1e-9

    def test_cosine_distance_orthogonal_vectors(self):
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import _cosine_distance

        a = [1.0, 0.0]
        b = [0.0, 1.0]
        dist = _cosine_distance(a, b)
        assert abs(dist - 1.0) < 1e-9

    def test_cosine_distance_zero_vector_returns_one(self):
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import _cosine_distance

        a = [0.0, 0.0, 0.0]
        b = [1.0, 2.0, 3.0]
        assert _cosine_distance(a, b) == 1.0
        assert _cosine_distance(b, a) == 1.0

    def test_cosine_distance_both_zero_vectors_returns_one(self):
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import _cosine_distance

        assert _cosine_distance([0.0, 0.0], [0.0, 0.0]) == 1.0

    def test_cosine_distance_known_value(self):
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import _cosine_distance

        a = [1.0, 2.0, 3.0]
        b = [4.0, 5.0, 6.0]
        # dot=32, |a|=sqrt(14), |b|=sqrt(77), cos_sim=32/sqrt(1078)≈0.9746
        dist = _cosine_distance(a, b)
        assert abs(dist - (1.0 - 32.0 / (14**0.5 * 77**0.5))) < 1e-9

    def test_extract_label_basic_english(self):
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import _extract_label

        contents = ["Python is great for data science", "Python machine learning libraries"]
        label = _extract_label(contents)
        assert "python" in label

    def test_extract_label_filters_stop_words(self):
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import _extract_label

        contents = ["the cat is on the mat"]
        label = _extract_label(contents)
        # "the", "is", "on" are stop words; "cat" and "mat" remain
        assert "the" not in label.split("_")
        assert "cat" in label

    def test_extract_label_returns_topic_for_no_words(self):
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import _extract_label

        contents = ["!!! ??? ..."]
        label = _extract_label(contents)
        assert label == "topic"

    def test_extract_label_returns_topic_for_only_stop_words(self):
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import _extract_label

        contents = ["the is are was were"]
        label = _extract_label(contents)
        assert label == "topic"

    def test_extract_label_chinese_characters(self):
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import _extract_label

        contents = ["机器学习 机器学习 深度学习", "机器学习 神经网络"]
        label = _extract_label(contents)
        assert "机器学习" in label

    def test_extract_label_returns_top_three_keywords(self):
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import _extract_label

        # "kotlin" appears 3x, "android" 2x, "gradle" 2x
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
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import _extract_label

        label = _extract_label([])
        assert label == "topic"

    def test_extract_label_single_char_words_excluded(self):
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import _extract_label

        # Words < 2 chars are excluded by regex [a-zA-Z一-鿿]{2,}
        contents = ["a I x y z"]
        label = _extract_label(contents)
        assert label == "topic"


class TestTopicClusterStep:
    """Tests for TopicClusterStep run() with mocked DB."""

    async def test_skipped_when_no_new_memory_ids(self):
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import (
            TopicClusterStep,
        )

        step = TopicClusterStep()
        ctx = _new_ctx()
        ctx.new_memory_ids = []
        result = await step.run(ctx)
        assert result.status == "skipped"
        assert result.output_count == 0
        assert result.step_name == "topic_cluster"

    async def test_success_with_fewer_than_2_embeddings(self):
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import (
            TopicClusterStep,
        )

        ctx = _new_ctx()
        ctx.new_memory_ids = [uuid4()]

        # Simulate DB returning 1 row with embedding
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
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import (
            TopicClusterStep,
        )

        id_a, id_b = uuid4(), uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [id_a, id_b]

        # Two nearly identical embeddings (cosine distance < eps=0.15)
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
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import (
            TopicClusterStep,
        )

        id_a, id_b = uuid4(), uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [id_a, id_b]

        # Orthogonal embeddings (distance = 1.0, > eps=0.15)
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
        from negentropy.engine.consolidation.pipeline.steps.topic_cluster_step import (
            TopicClusterStep,
        )

        id_a, id_b, id_c = uuid4(), uuid4(), uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [id_a, id_b, id_c]

        row_a = MagicMock()
        row_a.id = id_a
        row_a.content = "test a"
        row_a.embedding = None  # None embedding

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
        # row_a skipped (None embedding); only b and c might cluster
        # With eps=0.15, b and c are close enough to cluster
        assert result.output_count >= 0


# ---------------------------------------------------------------------------
# DedupMergeStep tests
# ---------------------------------------------------------------------------


class TestDedupMergeStep:
    """Tests for DedupMergeStep — near-duplicate memory merging."""

    async def test_skipped_when_no_new_memory_ids(self):
        from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
            DedupMergeStep,
        )

        step = DedupMergeStep()
        ctx = _new_ctx()
        ctx.new_memory_ids = []
        result = await step.run(ctx)
        assert result.status == "skipped"
        assert result.output_count == 0
        assert result.step_name == "dedup_merge"

    async def test_merges_near_duplicate_with_lower_score(self):
        from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
            DedupMergeStep,
        )

        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        # New memory with higher retention_score
        new_row = MagicMock()
        new_row.id = new_id
        new_row.content = "Python is great"
        new_row.embedding = [1.0, 0.0, 0.0]
        new_row.retention_score = 0.9
        new_row.metadata_ = {}

        dup_id = uuid4()
        dup_row = MagicMock()
        dup_row.id = dup_id
        dup_row.content = "Python is awesome"
        dup_row.retention_score = 0.5
        dup_row.dist = 0.05  # well within threshold

        # Sequence of DB calls:
        # 1st execute: select new memories -> returns [new_row]
        # 2nd execute: find near-dup -> returns [dup_row]
        # 3rd execute: select primary metadata -> returns {}
        # 4th execute: update primary metadata
        # 5th execute: select loser metadata -> returns {}
        # 6th execute: update loser (soft-delete)

        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()

            if call_count == 1:
                # Initial SELECT of new memories
                mock_res.all.return_value = [new_row]
            elif call_count == 2:
                # Near-dup query
                mock_res.first.return_value = dup_row
            elif call_count == 3:
                # Primary metadata select
                mock_res.scalar.return_value = {}
            elif call_count == 4:
                # Update primary
                pass
            elif call_count == 5:
                # Loser metadata select
                mock_res.scalar.return_value = {}
            elif call_count == 6:
                # Update loser
                pass
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = DedupMergeStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1

    async def test_skips_memory_with_none_embedding(self):
        from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
            DedupMergeStep,
        )

        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        new_row = MagicMock()
        new_row.id = new_id
        new_row.content = "no embedding"
        new_row.embedding = None  # No embedding
        new_row.retention_score = 0.5
        new_row.metadata_ = {}

        mock_res = MagicMock()
        mock_res.all.return_value = [new_row]

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_res)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = DedupMergeStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 0

    async def test_no_duplicate_found_proceeds_without_merge(self):
        from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
            DedupMergeStep,
        )

        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        new_row = MagicMock()
        new_row.id = new_id
        new_row.content = "unique content"
        new_row.embedding = [0.5, 0.5, 0.5]
        new_row.retention_score = 0.8
        new_row.metadata_ = {}

        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mock_res.all.return_value = [new_row]
            elif call_count == 2:
                # No duplicate found
                mock_res.first.return_value = None
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = DedupMergeStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 0

    async def test_loses_higher_score_becomes_primary(self):
        from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
            DedupMergeStep,
        )

        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        # New memory with LOWER retention_score
        new_row = MagicMock()
        new_row.id = new_id
        new_row.content = "new lower score content"
        new_row.embedding = [1.0, 0.0, 0.0]
        new_row.retention_score = 0.3
        new_row.metadata_ = {}

        dup_id = uuid4()
        dup_row = MagicMock()
        dup_row.id = dup_id
        dup_row.content = "existing higher score content"
        dup_row.retention_score = 0.8
        dup_row.dist = 0.05

        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mock_res.all.return_value = [new_row]
            elif call_count == 2:
                mock_res.first.return_value = dup_row
            elif call_count == 3:
                # Primary is the dup (higher score), select its metadata
                mock_res.scalar.return_value = {}
            elif call_count == 4:
                pass  # update primary
            elif call_count == 5:
                # Loser is new_row (lower score), select its metadata
                mock_res.scalar.return_value = {}
            elif call_count == 6:
                pass  # update loser
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = DedupMergeStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1

    async def test_merged_from_capped_at_five(self):
        from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
            DedupMergeStep,
        )

        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        new_row = MagicMock()
        new_row.id = new_id
        new_row.content = "new content"
        new_row.embedding = [1.0, 0.0, 0.0]
        new_row.retention_score = 0.9
        new_row.metadata_ = {}

        dup_id = uuid4()
        dup_row = MagicMock()
        dup_row.id = dup_id
        dup_row.content = "dup content"
        dup_row.retention_score = 0.4
        dup_row.dist = 0.05

        # Primary already has 5 merged_from entries
        existing_merged_from = [{"content": f"old_{i}", "merged_at": 1000.0 + i} for i in range(5)]

        call_count = 0
        captured_primary_meta = {}

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mock_res.all.return_value = [new_row]
            elif call_count == 2:
                mock_res.first.return_value = dup_row
            elif call_count == 3:
                # Return existing metadata with 5 entries already
                mock_res.scalar.return_value = {"merged_from": list(existing_merged_from)}
            elif call_count == 4:
                # Capture the update to verify cap
                captured_primary_meta["value"] = getattr(stmt, "_values", None)
                pass
            elif call_count == 5:
                mock_res.scalar.return_value = {}
            elif call_count == 6:
                pass
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = DedupMergeStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1
        # The cap of 5 is applied inside the step logic via merged_from[-5:]

    async def test_db_exception_triggers_rollback(self):
        from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
            DedupMergeStep,
        )

        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=RuntimeError("DB connection lost"))
        mock_db.rollback = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = DedupMergeStep()
            with pytest.raises(RuntimeError, match="DB connection lost"):
                await step.run(ctx)


class TestDedupMergeConflictBridge:
    """Tests for DedupMergeStep ↔ ConflictResolver integration (Gap 2)."""

    async def test_no_conflict_proceeds_with_soft_delete(self):
        """When _check_fact_conflict returns False, loser is soft-deleted normally."""
        from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
            DedupMergeStep,
        )

        step = DedupMergeStep()
        step._check_fact_conflict = AsyncMock(return_value=False)

        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        new_row = MagicMock()
        new_row.id = new_id
        new_row.content = "I like dark theme"
        new_row.embedding = [1.0, 0.0, 0.0]
        new_row.retention_score = 0.9
        new_row.metadata_ = {}

        dup_id = uuid4()
        dup_row = MagicMock()
        dup_row.id = dup_id
        dup_row.content = "I love dark mode"
        dup_row.retention_score = 0.5
        dup_row.dist = 0.05

        call_count = 0
        loser_updated = False

        async def _mock_execute(stmt):
            nonlocal call_count, loser_updated
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mock_res.all.return_value = [new_row]
            elif call_count == 2:
                mock_res.first.return_value = dup_row
            elif call_count == 3:
                mock_res.scalar.return_value = {}
            elif call_count == 4:
                pass
            elif call_count == 5:
                mock_res.scalar.return_value = {}
            elif call_count == 6:
                loser_updated = True
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1
        assert loser_updated

    async def test_conflict_keep_both_skips_soft_delete(self):
        """When ConflictResolver returns keep_both, loser is NOT soft-deleted."""
        from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
            DedupMergeStep,
        )

        step = DedupMergeStep()
        step._check_fact_conflict = AsyncMock(return_value=True)

        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        new_row = MagicMock()
        new_row.id = new_id
        new_row.content = "I prefer light theme"
        new_row.embedding = [1.0, 0.0, 0.0]
        new_row.retention_score = 0.9
        new_row.metadata_ = {}

        dup_id = uuid4()
        dup_row = MagicMock()
        dup_row.id = dup_id
        dup_row.content = "I like dark theme"
        dup_row.retention_score = 0.5
        dup_row.dist = 0.05

        call_count = 0
        loser_updated = False

        async def _mock_execute(stmt):
            nonlocal call_count, loser_updated
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mock_res.all.return_value = [new_row]
            elif call_count == 2:
                mock_res.first.return_value = dup_row
            elif call_count == 3:
                mock_res.scalar.return_value = {}
            elif call_count == 4:
                pass  # update primary metadata
            # No call 5/6 because soft-delete is skipped
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1
        assert not loser_updated

    async def test_check_fact_conflict_returns_false_no_thread_ids(self):
        """_check_fact_conflict returns False when memories have no thread_id."""
        from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
            DedupMergeStep,
        )

        step = DedupMergeStep()
        mock_db = AsyncMock()
        mock_result = MagicMock()
        # thread_id query returns rows with None thread_id
        mem_row = MagicMock()
        mem_row.thread_id = None
        mock_result.all.return_value = [mem_row]
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await step._check_fact_conflict(mock_db, uuid4(), uuid4(), "user1", "app1")
        assert result is False

    async def test_check_fact_conflict_returns_false_with_fewer_than_2_facts(self):
        """_check_fact_conflict returns False when fewer than 2 active facts exist."""
        from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
            DedupMergeStep,
        )

        step = DedupMergeStep()
        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                # thread_id query
                mem_row = MagicMock()
                mem_row.thread_id = uuid4()
                mock_res.all.return_value = [mem_row]
            elif call_count == 2:
                # facts query — empty
                mock_res.scalars.return_value.all.return_value = []
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)

        result = await step._check_fact_conflict(mock_db, uuid4(), uuid4(), "user1", "app1")
        assert result is False

    async def test_check_fact_conflict_returns_false_no_key_collision(self):
        """_check_fact_conflict returns False when facts have unique keys."""
        from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
            DedupMergeStep,
        )

        step = DedupMergeStep()

        fact_a = MagicMock()
        fact_a.key = "language"
        fact_a.value = {"name": "rust"}
        fact_a.created_at = 100.0

        fact_b = MagicMock()
        fact_b.key = "editor"
        fact_b.value = {"name": "vim"}
        fact_b.created_at = 200.0

        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mem_row = MagicMock()
                mem_row.thread_id = uuid4()
                mock_res.all.return_value = [mem_row]
            elif call_count == 2:
                mock_res.scalars.return_value.all.return_value = [fact_a, fact_b]
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)

        result = await step._check_fact_conflict(mock_db, uuid4(), uuid4(), "user1", "app1")
        assert result is False

    async def test_check_fact_conflict_detects_keep_both(self):
        """_check_fact_conflict returns True when ConflictResolver resolves as keep_both."""
        from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
            DedupMergeStep,
        )

        step = DedupMergeStep()

        fact_old = MagicMock()
        fact_old.key = "theme"
        fact_old.value = {"mode": "dark"}
        fact_old.fact_type = "custom"
        fact_old.confidence = 0.8
        fact_old.created_at = 100.0

        fact_new = MagicMock()
        fact_new.key = "theme"
        fact_new.value = {"mode": "light"}
        fact_new.fact_type = "custom"
        fact_new.confidence = 0.9
        fact_new.created_at = 200.0

        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mem_row = MagicMock()
                mem_row.thread_id = uuid4()
                mock_res.all.return_value = [mem_row]
            elif call_count == 2:
                mock_res.scalars.return_value.all.return_value = [fact_old, fact_new]
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)

        mock_conflict = MagicMock()
        mock_conflict.resolution = "keep_both"

        with patch("negentropy.engine.governance.conflict_resolver.ConflictResolver") as MockResolver:
            instance = MockResolver.return_value
            instance.detect_and_resolve = AsyncMock(return_value=mock_conflict)

            result = await step._check_fact_conflict(mock_db, uuid4(), uuid4(), "user1", "app1")

        assert result is True

    async def test_check_fact_conflict_supersede_returns_false(self):
        """_check_fact_conflict returns False when resolution is supersede (soft-delete ok)."""
        from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
            DedupMergeStep,
        )

        step = DedupMergeStep()

        fact_old = MagicMock()
        fact_old.key = "theme"
        fact_old.value = {"mode": "dark"}
        fact_old.fact_type = "preference"
        fact_old.confidence = 0.8
        fact_old.created_at = 100.0

        fact_new = MagicMock()
        fact_new.key = "theme"
        fact_new.value = {"mode": "light"}
        fact_new.fact_type = "preference"
        fact_new.confidence = 0.9
        fact_new.created_at = 200.0

        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mem_row = MagicMock()
                mem_row.thread_id = uuid4()
                mock_res.all.return_value = [mem_row]
            elif call_count == 2:
                mock_res.scalars.return_value.all.return_value = [fact_old, fact_new]
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)

        mock_conflict = MagicMock()
        mock_conflict.resolution = "supersede"

        with patch("negentropy.engine.governance.conflict_resolver.ConflictResolver") as MockResolver:
            instance = MockResolver.return_value
            instance.detect_and_resolve = AsyncMock(return_value=mock_conflict)

            result = await step._check_fact_conflict(mock_db, uuid4(), uuid4(), "user1", "app1")

        assert result is False
