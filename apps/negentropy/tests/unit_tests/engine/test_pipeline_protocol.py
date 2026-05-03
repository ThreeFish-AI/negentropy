"""
Consolidation Pipeline Protocol 单元测试

覆盖 PipelineContext 和 StepResult 协议的正确性。
"""

from __future__ import annotations

from uuid import uuid4

from negentropy.engine.consolidation.pipeline.protocol import (
    PipelineContext,
    StepResult,
)

# ===================================================================
# PipelineContext
# ===================================================================


class TestPipelineContext:
    """PipelineContext dataclass 字段与默认值测试"""

    def test_default_fields(self) -> None:
        """默认字段值正确"""
        ctx = PipelineContext(
            user_id="user-1",
            app_name="test-app",
            thread_id=None,
        )
        assert ctx.user_id == "user-1"
        assert ctx.app_name == "test-app"
        assert ctx.thread_id is None
        assert ctx.turns == []
        assert ctx.new_memory_ids == []
        assert ctx.embedding_fn is None
        assert ctx.facts == []
        assert ctx.entities == []
        assert ctx.topics == []
        assert ctx.metadata == {}

    def test_custom_fields(self) -> None:
        """自定义字段正确赋值"""
        thread_uuid = uuid4()
        memory_uuid = uuid4()

        ctx = PipelineContext(
            user_id="user-2",
            app_name="custom-app",
            thread_id=thread_uuid,
            turns=[{"author": "user", "text": "hello"}],
            new_memory_ids=[memory_uuid],
            embedding_fn=lambda x: [0.1, 0.2],
            facts=[{"key": "fact1"}],
            entities=[{"name": "entity1"}],
            topics=[{"topic": "topic1"}],
            metadata={"source": "test"},
        )

        assert ctx.user_id == "user-2"
        assert ctx.app_name == "custom-app"
        assert ctx.thread_id == thread_uuid
        assert len(ctx.turns) == 1
        assert ctx.turns[0]["author"] == "user"
        assert len(ctx.new_memory_ids) == 1
        assert ctx.new_memory_ids[0] == memory_uuid
        assert ctx.embedding_fn is not None
        assert ctx.facts == [{"key": "fact1"}]
        assert ctx.entities == [{"name": "entity1"}]
        assert ctx.topics == [{"topic": "topic1"}]
        assert ctx.metadata == {"source": "test"}

    def test_default_lists_are_independent(self) -> None:
        """默认列表互不影响（不共享引用）"""
        ctx_a = PipelineContext(user_id="a", app_name="app", thread_id=None)
        ctx_b = PipelineContext(user_id="b", app_name="app", thread_id=None)

        ctx_a.facts.append("fact_a")
        ctx_b.facts.append("fact_b")

        assert ctx_a.facts == ["fact_a"]
        assert ctx_b.facts == ["fact_b"]
        assert ctx_a.facts != ctx_b.facts

    def test_default_metadata_are_independent(self) -> None:
        """默认 metadata dict 互不影响"""
        ctx_a = PipelineContext(user_id="a", app_name="app", thread_id=None)
        ctx_b = PipelineContext(user_id="b", app_name="app", thread_id=None)

        ctx_a.metadata["key"] = "value_a"
        assert "key" not in ctx_b.metadata

    def test_topics_default_empty_list(self) -> None:
        """topics 默认为空列表"""
        ctx = PipelineContext(user_id="u", app_name="app", thread_id=None)
        assert ctx.topics == []
        assert isinstance(ctx.topics, list)

    def test_entities_default_empty_list(self) -> None:
        """entities 默认为空列表"""
        ctx = PipelineContext(user_id="u", app_name="app", thread_id=None)
        assert ctx.entities == []
        assert isinstance(ctx.entities, list)

    def test_facts_default_empty_list(self) -> None:
        """facts 默认为空列表"""
        ctx = PipelineContext(user_id="u", app_name="app", thread_id=None)
        assert ctx.facts == []
        assert isinstance(ctx.facts, list)

    def test_mutable_fields_modifiable(self) -> None:
        """可变字段可在创建后修改"""
        ctx = PipelineContext(user_id="u", app_name="app", thread_id=None)
        ctx.facts.append({"key": "new_fact"})
        ctx.entities.append({"name": "new_entity"})
        ctx.topics.append("new_topic")
        ctx.metadata["extra"] = "value"
        ctx.turns.append({"author": "user", "text": "hi"})

        assert len(ctx.facts) == 1
        assert len(ctx.entities) == 1
        assert len(ctx.topics) == 1
        assert ctx.metadata["extra"] == "value"
        assert len(ctx.turns) == 1


# ===================================================================
# StepResult
# ===================================================================


class TestStepResult:
    """StepResult dataclass 与 ok 属性测试"""

    def test_ok_returns_true_for_success(self) -> None:
        """status="success" → ok=True"""
        result = StepResult(step_name="test_step", status="success")
        assert result.ok is True

    def test_ok_returns_false_for_failed(self) -> None:
        """status="failed" → ok=False"""
        result = StepResult(step_name="test_step", status="failed")
        assert result.ok is False

    def test_ok_returns_false_for_skipped(self) -> None:
        """status="skipped" → ok=False"""
        result = StepResult(step_name="test_step", status="skipped")
        assert result.ok is False

    def test_default_values(self) -> None:
        """默认值：duration_ms=0, output_count=0, error=None, extra={}"""
        result = StepResult(step_name="step", status="success")
        assert result.duration_ms == 0
        assert result.output_count == 0
        assert result.error is None
        assert result.extra == {}

    def test_custom_values(self) -> None:
        """自定义字段正确赋值"""
        result = StepResult(
            step_name="extract_facts",
            status="success",
            duration_ms=150,
            output_count=5,
            extra={"model": "gpt-4"},
        )
        assert result.step_name == "extract_facts"
        assert result.status == "success"
        assert result.duration_ms == 150
        assert result.output_count == 5
        assert result.error is None
        assert result.extra == {"model": "gpt-4"}

    def test_failed_with_error(self) -> None:
        """failed 状态携带 error 信息"""
        result = StepResult(
            step_name="bad_step",
            status="failed",
            error="Connection timeout",
        )
        assert result.ok is False
        assert result.error == "Connection timeout"

    def test_skipped_with_reason(self) -> None:
        """skipped 状态可在 extra 中携带原因"""
        result = StepResult(
            step_name="optional_step",
            status="skipped",
            extra={"reason": "feature flag disabled"},
        )
        assert result.ok is False
        assert result.extra["reason"] == "feature flag disabled"

    def test_ok_is_property(self) -> None:
        """ok 是 property，不是普通属性"""
        result = StepResult(step_name="step", status="success")
        # property 可通过类访问到 descriptor
        assert isinstance(type(result).ok, property)

    def test_extra_default_independent(self) -> None:
        """多个 StepResult 的 extra 默认值互不影响"""
        r1 = StepResult(step_name="a", status="success")
        r2 = StepResult(step_name="b", status="success")
        r1.extra["key"] = "val"
        assert "key" not in r2.extra

    def test_unknown_status_ok_false(self) -> None:
        """任意非 "success" status → ok=False"""
        for status in ("pending", "running", "cancelled", "timeout", ""):
            result = StepResult(step_name="step", status=status)
            assert result.ok is False, f"status={status!r} should give ok=False"
