from __future__ import annotations

from litellm.integrations.opentelemetry import OpenTelemetry

from negentropy.instrumentation import patch_litellm_otel_cost


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
