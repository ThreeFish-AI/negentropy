from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from litellm.integrations.opentelemetry import OpenTelemetry

from negentropy.instrumentation import LiteLLMLoggingCallback, _resolve_total_cost, patch_litellm_otel_cost


class _FakeSpan:
    def __init__(self, *, recording: bool = True, name: str = "span") -> None:
        self.attributes: dict[str, object] = {}
        self.recording = recording
        self.name = name
        self.statuses: list[object] = []
        self.end_calls = 0

    def is_recording(self) -> bool:
        return self.recording

    def set_attribute(self, key: str, value: object) -> None:
        self.attributes[key] = value

    def set_status(self, status: object) -> None:
        self.statuses.append(status)

    def end(self, *, end_time: int | None = None) -> None:
        self.end_calls += 1
        self.recording = False


class _FakeOpenTelemetryCallback:
    callback_name = "otel"
    config = SimpleNamespace(enable_events=False)

    @staticmethod
    def safe_set_attribute(span: _FakeSpan, key: str, value: object) -> None:
        span.attributes[key] = value


@pytest.fixture(autouse=True)
def _restore_otel_patches(monkeypatch):
    original_set_attributes = OpenTelemetry.set_attributes
    original_handle_success = OpenTelemetry._handle_success
    yield
    monkeypatch.setattr(OpenTelemetry, "set_attributes", original_set_attributes)
    monkeypatch.setattr(OpenTelemetry, "_handle_success", original_handle_success)


def _build_success_callback(parent_span: _FakeSpan):
    callback = _FakeOpenTelemetryCallback()
    callback._get_span_context = lambda kwargs: (None, parent_span)
    callback._start_primary_span = lambda kwargs, response_obj, start_time, end_time, ctx: _FakeSpan()
    callback._maybe_log_raw_request = lambda kwargs, response_obj, start_time, end_time, span: None
    callback._create_guardrail_span = lambda kwargs, context: None
    callback._record_metrics = lambda kwargs, response_obj, start_time, end_time: None
    callback._emit_semantic_logs = lambda kwargs, response_obj, span: None
    callback._to_ns = lambda value: 0
    callback.set_attributes = lambda span, kwargs, response_obj: OpenTelemetry.set_attributes(  # type: ignore[attr-defined]
        callback,
        span,
        kwargs,
        response_obj,
    )
    return callback


def test_patch_litellm_otel_cost_injects_cost_attributes(monkeypatch):
    def _original_set_attributes(self, span, kwargs, response_obj):
        self.safe_set_attribute(span, "gen_ai.request.model", kwargs.get("model"))
        self.safe_set_attribute(span, "gen_ai.response.model", response_obj.get("model"))

    monkeypatch.setattr(OpenTelemetry, "set_attributes", _original_set_attributes)
    patch_litellm_otel_cost()

    span = _FakeSpan()
    callback = _FakeOpenTelemetryCallback()
    kwargs = {"model": "openai/gpt-5-mini", "response_cost": 0.12}
    response_obj = {"model": "openai/gpt-5-mini"}

    OpenTelemetry.set_attributes(callback, span, kwargs, response_obj)

    # 归一化为 vendor/model 全名上报，让 Langfuse Model Costs 视图收敛到单一聚合键。
    assert span.attributes["gen_ai.request.model"] == "openai/gpt-5-mini"
    assert span.attributes["gen_ai.response.model"] == "openai/gpt-5-mini"
    assert span.attributes["gen_ai.system"] == "openai"
    # Langfuse 私有强制覆盖键。
    assert span.attributes["langfuse.observation.model.name"] == "openai/gpt-5-mini"
    # 诊断字段保留原始字符串（用于 trace 详情排查）。
    assert span.attributes["gen_ai.original_model"] == "openai/gpt-5-mini"
    # request == response 时不重复写 original_response_model，避免冗余。
    assert "gen_ai.original_response_model" not in span.attributes
    assert span.attributes["gen_ai.usage.cost"] == 0.12


def test_patch_normalizes_dated_response_model(monkeypatch):
    """OpenAI response.model 常带日期后缀（gpt-5-mini-2025-08-07），需归一化为裸名。"""

    def _original_set_attributes(self, span, kwargs, response_obj):
        self.safe_set_attribute(span, "gen_ai.request.model", kwargs.get("model"))
        self.safe_set_attribute(span, "gen_ai.response.model", response_obj.get("model"))

    monkeypatch.setattr(OpenTelemetry, "set_attributes", _original_set_attributes)
    patch_litellm_otel_cost()

    span = _FakeSpan()
    callback = _FakeOpenTelemetryCallback()
    kwargs = {"model": "openai/gpt-5-mini", "response_cost": 0.05}
    response_obj = {"model": "gpt-5-mini-2025-08-07"}

    OpenTelemetry.set_attributes(callback, span, kwargs, response_obj)

    assert span.attributes["gen_ai.request.model"] == "openai/gpt-5-mini"
    assert span.attributes["gen_ai.response.model"] == "openai/gpt-5-mini"
    assert span.attributes["gen_ai.system"] == "openai"
    # response.model 优先用作 Langfuse 强制覆盖键（更接近实际计费模型）。
    assert span.attributes["langfuse.observation.model.name"] == "openai/gpt-5-mini"
    assert span.attributes["gen_ai.original_model"] == "openai/gpt-5-mini"
    # response.model 含具体版本日期，归一化丢失的信息单独保留到 original_response_model。
    assert span.attributes["gen_ai.original_response_model"] == "gpt-5-mini-2025-08-07"


def test_patch_emits_vendor_for_bare_model(monkeypatch):
    """硬编码裸名（如 KG 兜底 gpt-4o-mini）也能识别 vendor 写入 gen_ai.system。"""

    def _original_set_attributes(self, span, kwargs, response_obj):
        self.safe_set_attribute(span, "gen_ai.request.model", kwargs.get("model"))
        self.safe_set_attribute(span, "gen_ai.response.model", response_obj.get("model"))

    monkeypatch.setattr(OpenTelemetry, "set_attributes", _original_set_attributes)
    patch_litellm_otel_cost()

    span = _FakeSpan()
    callback = _FakeOpenTelemetryCallback()
    kwargs = {"model": "gpt-4o-mini", "response_cost": 0.01}
    response_obj = {"model": "gpt-4o-mini-2024-07-18"}

    OpenTelemetry.set_attributes(callback, span, kwargs, response_obj)

    assert span.attributes["gen_ai.request.model"] == "openai/gpt-4o-mini"
    # 日期后缀剥离 + 系族前缀识别后补齐为 openai/gpt-4o-mini。
    assert span.attributes["gen_ai.response.model"] == "openai/gpt-4o-mini"
    assert span.attributes["gen_ai.system"] == "openai"
    assert span.attributes["langfuse.observation.model.name"] == "openai/gpt-4o-mini"
    assert span.attributes["gen_ai.original_model"] == "gpt-4o-mini"
    # 裸名 request 与带日期的 response 不同，需各自保留诊断字符串。
    assert span.attributes["gen_ai.original_response_model"] == "gpt-4o-mini-2024-07-18"


def test_patch_litellm_otel_cost_skips_non_recording_span(monkeypatch):
    calls = {"count": 0}

    def _original_set_attributes(self, span, kwargs, response_obj):
        calls["count"] += 1

    monkeypatch.setattr(OpenTelemetry, "set_attributes", _original_set_attributes)
    patch_litellm_otel_cost()

    span = _FakeSpan(recording=False)
    callback = _FakeOpenTelemetryCallback()

    OpenTelemetry.set_attributes(
        callback,
        span,
        {"model": "openai/gpt-5-mini", "response_cost": 0.12},
        {"model": "openai/gpt-5-mini"},
    )

    assert calls["count"] == 0
    assert span.attributes == {}


def test_patch_litellm_handle_success_skips_ended_parent_span(monkeypatch):
    parent_span = _FakeSpan(recording=False, name="litellm_proxy_request")
    callback = _build_success_callback(parent_span)
    set_attributes_calls = {"count": 0}

    def _original_set_attributes(self, span, kwargs, response_obj):
        set_attributes_calls["count"] += 1

    monkeypatch.setattr(OpenTelemetry, "set_attributes", _original_set_attributes)
    patch_litellm_otel_cost()

    OpenTelemetry._handle_success(
        callback,
        {"model": "openai/gpt-5-mini"},
        {"model": "openai/gpt-5-mini", "choices": []},
        datetime.now(),
        datetime.now(),
    )

    assert set_attributes_calls["count"] == 0
    assert parent_span.statuses == []
    assert parent_span.end_calls == 0


def test_patch_litellm_handle_success_preserves_recording_parent_span(monkeypatch):
    parent_span = _FakeSpan(recording=True, name="active-parent")
    callback = _build_success_callback(parent_span)
    set_attributes_calls = {"count": 0}

    def _original_set_attributes(self, span, kwargs, response_obj):
        set_attributes_calls["count"] += 1
        self.safe_set_attribute(span, "gen_ai.request.model", kwargs.get("model"))

    monkeypatch.setattr(OpenTelemetry, "set_attributes", _original_set_attributes)
    patch_litellm_otel_cost()

    OpenTelemetry._handle_success(
        callback,
        {"model": "openai/gpt-5-mini", "response_cost": 0.12},
        {"model": "openai/gpt-5-mini", "choices": []},
        datetime.now(),
        datetime.now(),
    )

    assert set_attributes_calls["count"] == 1
    # 经归一化后写入 vendor/model 全名（与 Langfuse Model Costs 视图聚合口径一致）。
    assert parent_span.attributes["gen_ai.request.model"] == "openai/gpt-5-mini"
    assert parent_span.attributes["gen_ai.usage.cost"] == 0.12
    assert len(parent_span.statuses) == 1


def test_resolve_total_cost_uses_unified_online_catalog(monkeypatch):
    monkeypatch.setattr(
        "litellm.cost_calculator.completion_cost",
        lambda *, completion_response: (_ for _ in ()).throw(ValueError("missing builtin price")),
    )
    monkeypatch.setattr(
        "negentropy.instrumentation.get_effective_model_pricing_usd",
        lambda model: ({"input": 1.0, "output": 3.2}, "litellm_online_catalog"),
    )

    response_obj = SimpleNamespace(
        usage=SimpleNamespace(prompt_tokens=120, completion_tokens=80),
        model="openai/gpt-5-mini",
    )

    cost, pricing_source, refresh_error = _resolve_total_cost({"model": "openai/gpt-5-mini"}, response_obj)

    assert cost == pytest.approx(0.000376)
    assert pricing_source == "litellm_online_catalog"
    assert refresh_error is None


def test_log_success_event_skips_non_recording_current_span(monkeypatch):
    callback = LiteLLMLoggingCallback()
    span = _FakeSpan(recording=False)

    monkeypatch.setattr("negentropy.instrumentation.trace.get_current_span", lambda: span)
    monkeypatch.setattr(callback, "_ensure_tracing", lambda: None)

    class _FakeLogger:
        def info(self, *args, **kwargs):
            return None

    callback._logger = _FakeLogger()

    response_obj = SimpleNamespace(
        usage=SimpleNamespace(prompt_tokens=10, completion_tokens=20),
        model="openai/gpt-5-mini",
    )
    kwargs = {"model": "openai/gpt-5-mini", "response_cost": 0.12}

    callback.log_success_event(
        kwargs,
        response_obj,
        datetime.now(UTC),
        datetime.now(UTC),
    )

    assert span.attributes == {}


def test_normalization_runs_even_if_original_set_attributes_raises(monkeypatch):
    """original_set_attributes 抛异常时归一化仍应执行。"""

    def _boom_set_attributes(self, span, kwargs, response_obj):
        raise ValueError("simulated missing standard_logging_object")

    monkeypatch.setattr(OpenTelemetry, "set_attributes", _boom_set_attributes)
    patch_litellm_otel_cost()

    span = _FakeSpan()
    callback = _FakeOpenTelemetryCallback()
    kwargs = {"model": "openai/gpt-5-mini", "response_cost": 0.08}
    response_obj = {"model": "gpt-5-mini-2025-08-07"}

    OpenTelemetry.set_attributes(callback, span, kwargs, response_obj)

    # 归一化在 original 失败后仍然执行（vendor 前缀以 request 侧权威推断）
    assert span.attributes["gen_ai.request.model"] == "openai/gpt-5-mini"
    assert span.attributes["gen_ai.response.model"] == "openai/gpt-5-mini"
    assert span.attributes["langfuse.observation.model.name"] == "openai/gpt-5-mini"
    assert span.attributes["gen_ai.system"] == "openai"


def test_normalization_handles_embedding_model(monkeypatch):
    """Embedding 模型名（gemini/text-embedding-004）请求与响应跨字段保持 vendor 一致。

    response.model 是裸名 ``text-embedding-004``，家族前缀表会把它识别为 OpenAI；
    request 侧 ``gemini/`` 前缀必须作为权威 vendor_hint 桥接，让 Langfuse 聚合到
    ``gemini/text-embedding-004``，避免被 Embedding 的 OpenAI 同名模型污染。
    """

    def _original_set_attributes(self, span, kwargs, response_obj):
        self.safe_set_attribute(span, "gen_ai.request.model", kwargs.get("model"))

    monkeypatch.setattr(OpenTelemetry, "set_attributes", _original_set_attributes)
    patch_litellm_otel_cost()

    span = _FakeSpan()
    callback = _FakeOpenTelemetryCallback()
    kwargs = {"model": "gemini/text-embedding-004"}
    response_obj = {"model": "text-embedding-004"}

    OpenTelemetry.set_attributes(callback, span, kwargs, response_obj)

    assert span.attributes["gen_ai.request.model"] == "gemini/text-embedding-004"
    assert span.attributes["gen_ai.response.model"] == "gemini/text-embedding-004"
    assert span.attributes["gen_ai.system"] == "gemini"
    assert span.attributes["langfuse.observation.model.name"] == "gemini/text-embedding-004"


def test_normalization_handles_bare_model_name(monkeypatch):
    """裸名（gpt-4o-mini）经归一化后补齐 ``openai/`` 前缀，与带前缀调用聚合到同一行。"""

    def _original_set_attributes(self, span, kwargs, response_obj):
        self.safe_set_attribute(span, "gen_ai.request.model", kwargs.get("model"))

    monkeypatch.setattr(OpenTelemetry, "set_attributes", _original_set_attributes)
    patch_litellm_otel_cost()

    span = _FakeSpan()
    callback = _FakeOpenTelemetryCallback()
    kwargs = {"model": "gpt-4o-mini"}
    response_obj = {"model": "gpt-4o-mini"}

    OpenTelemetry.set_attributes(callback, span, kwargs, response_obj)

    assert span.attributes["gen_ai.request.model"] == "openai/gpt-4o-mini"
    assert span.attributes["langfuse.observation.model.name"] == "openai/gpt-4o-mini"
    assert span.attributes["gen_ai.system"] == "openai"


# ---------------------------------------------------------------------------
# _infer_operation_name
# ---------------------------------------------------------------------------


def test_operation_name_embeddings_via_litellm_call_type():
    """litellm_call_type="embedding" 应推断为 "embeddings"。"""
    from negentropy.instrumentation import _infer_operation_name

    assert (
        _infer_operation_name({"litellm_call_type": "embedding", "model": "gemini/text-embedding-004"}) == "embeddings"
    )


def test_operation_name_embeddings_via_heuristic():
    """kwargs 有 input 无 messages 时启发式推断为 "embeddings"。"""
    from negentropy.instrumentation import _infer_operation_name

    assert _infer_operation_name({"model": "openai/text-embedding-3-small", "input": ["hello"]}) == "embeddings"


def test_operation_name_chat_preserved():
    """kwargs 有 messages 时推断为 "chat"。"""
    from negentropy.instrumentation import _infer_operation_name

    assert (
        _infer_operation_name({"model": "openai/gpt-5-mini", "messages": [{"role": "user", "content": "hi"}]}) == "chat"
    )


def test_operation_name_chat_default():
    """kwargs 既无 input 也无 messages 时默认为 "chat"。"""
    from negentropy.instrumentation import _infer_operation_name

    assert _infer_operation_name({"model": "openai/gpt-5-mini"}) == "chat"


def test_apply_model_normalization_gemini_embedding_models_prefix(monkeypatch):
    """Gemini Embedding 响应含 ``models/`` 前缀时归一化为 ``gemini/text-embedding-004``。"""

    def _original_set_attributes(self, span, kwargs, response_obj):
        self.safe_set_attribute(span, "gen_ai.request.model", kwargs.get("model"))

    monkeypatch.setattr(OpenTelemetry, "set_attributes", _original_set_attributes)
    patch_litellm_otel_cost()

    span = _FakeSpan()
    callback = _FakeOpenTelemetryCallback()
    kwargs = {"model": "gemini/text-embedding-004", "input": ["hello"]}
    response_obj = {"model": "models/text-embedding-004"}

    OpenTelemetry.set_attributes(callback, span, kwargs, response_obj)

    assert span.attributes["gen_ai.request.model"] == "gemini/text-embedding-004"
    assert span.attributes["gen_ai.response.model"] == "gemini/text-embedding-004"
    assert span.attributes["gen_ai.system"] == "gemini"
    assert span.attributes["langfuse.observation.model.name"] == "gemini/text-embedding-004"
    # embedding kwargs 推断操作名
    assert span.attributes["gen_ai.operation.name"] == "embeddings"
