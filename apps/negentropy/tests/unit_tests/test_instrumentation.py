from __future__ import annotations

from types import SimpleNamespace

import pytest
from litellm.integrations.opentelemetry import OpenTelemetry

from negentropy.instrumentation import _resolve_total_cost, patch_litellm_otel_cost


class _FakeSpan:
    def __init__(self) -> None:
        self.attributes: dict[str, object] = {}


class _FakeOpenTelemetryCallback:
    callback_name = "otel"

    @staticmethod
    def safe_set_attribute(span: _FakeSpan, key: str, value: object) -> None:
        span.attributes[key] = value


def test_patch_litellm_otel_cost_normalizes_request_and_response_model(monkeypatch):
    original = OpenTelemetry.set_attributes

    def _original_set_attributes(self, span, kwargs, response_obj):
        self.safe_set_attribute(span, "gen_ai.request.model", kwargs.get("model"))
        self.safe_set_attribute(span, "gen_ai.response.model", response_obj.get("model"))

    monkeypatch.setattr(OpenTelemetry, "set_attributes", _original_set_attributes)

    try:
        patch_litellm_otel_cost()

        span = _FakeSpan()
        callback = _FakeOpenTelemetryCallback()
        kwargs = {"model": "zai/glm-5", "response_cost": 0.12}
        response_obj = {"model": "glm-5"}

        OpenTelemetry.set_attributes(callback, span, kwargs, response_obj)

        assert span.attributes["gen_ai.request.model"] == "zai/glm-5"
        assert span.attributes["gen_ai.response.model"] == "zai/glm-5"
        assert span.attributes["gen_ai.usage.cost"] == 0.12
    finally:
        monkeypatch.setattr(OpenTelemetry, "set_attributes", original)


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
        model="zai/glm-5",
    )

    cost, pricing_source, refresh_error = _resolve_total_cost({"model": "zai/glm-5"}, response_obj)

    assert cost == pytest.approx(0.000376)
    assert pricing_source == "litellm_online_catalog"
    assert refresh_error is None
