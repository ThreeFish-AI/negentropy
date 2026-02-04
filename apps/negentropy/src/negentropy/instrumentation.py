"""
Instrumentation and Observability Callbacks.
"""

from typing import Any
import json

from negentropy.logging import get_logger
from opentelemetry import trace
from litellm.integrations.opentelemetry import OpenTelemetry


class LiteLLMLoggingCallback:
    """Callback to log interaction metrics (token usage, cost, latency) via structlog."""

    def __init__(self) -> None:
        self._logger = get_logger("negentropy.llm.usage")

    def _ensure_tracing(self):
        """Ensure TracingManager has attached its configuration."""
        try:
            from negentropy.engine.adapters.postgres.tracing import get_tracing_manager

            manager = get_tracing_manager()
            if manager:
                # Accessing .tracer triggers _ensure_initialized()
                self._logger.debug("Triggering TracingManager initialization check from instrumentation...")
                t = manager.tracer
                self._logger.debug(f"Got tracer: {t}")
        except Exception as e:
            self._logger.error(f"Failed to ensure tracing: {e}")

    def _get_model_cost(self, kwargs: dict) -> float:
        try:
            from litellm import completion_cost

            # Create a mock response object for cost calculation if response_obj is available
            response_obj = kwargs.get("response_obj")
            if response_obj:
                return float(completion_cost(completion_response=response_obj))
            return 0.0
        except Exception:
            return 0.0

    def log_success_event(self, kwargs: dict, response_obj: Any, start_time: Any, end_time: Any) -> None:
        """Log successful LLM interaction."""
        self._ensure_tracing()
        try:
            model = kwargs.get("model", "unknown")
            input_tokens = 0
            output_tokens = 0

            # Extract usage from response
            if hasattr(response_obj, "usage"):
                usage = response_obj.usage
                input_tokens = getattr(usage, "prompt_tokens", 0)
                output_tokens = getattr(usage, "completion_tokens", 0)

            # Calculate cost
            cost = self._get_model_cost({"response_obj": response_obj, "model": model})

            # Inject cost into current OTEL span without changing LiteLLM's OTEL callback
            try:
                span = trace.get_current_span()
                if span and span.is_recording():
                    total_cost = _extract_total_cost(kwargs, response_obj)
                    if total_cost is None:
                        total_cost = cost
                    if total_cost is not None:
                        span.set_attribute("gen_ai.usage.cost", float(total_cost))
                        span.set_attribute(
                            "langfuse.observation.cost_details",
                            json.dumps({"total": float(total_cost)}),
                        )
            except Exception:
                pass

            # Calculate latency
            latency_ms = (end_time - start_time).total_seconds() * 1000

            self._logger.info(
                f"[{model}] {input_tokens} -> {output_tokens} tokens",
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=f"{cost:.6f}",
                latency_ms=f"{latency_ms:.0f}",
            )
        except Exception:
            pass  # Fail safe

    def log_failure_event(self, kwargs: dict, response_obj: Any, start_time: Any, end_time: Any) -> None:
        """Log failed LLM interaction."""
        try:
            model = kwargs.get("model", "unknown")
            exception = kwargs.get("exception", "unknown error")

            latency_ms = (end_time - start_time).total_seconds() * 1000

            get_logger("negentropy.llm.error").error(
                f"[{model}] Failed: {str(exception)}",
                model=model,
                error=str(exception),
                latency_ms=f"{latency_ms:.0f}",
            )
        except Exception:
            pass


def _extract_total_cost(kwargs: dict, response_obj: Any) -> float | None:
    cost = kwargs.get("response_cost")
    if cost is None:
        standard_logging = kwargs.get("standard_logging_object")
        cost_breakdown = None
        if isinstance(standard_logging, dict):
            cost_breakdown = standard_logging.get("cost_breakdown")
        elif standard_logging is not None:
            if hasattr(standard_logging, "get") and callable(standard_logging.get):
                cost_breakdown = standard_logging.get("cost_breakdown")
            if cost_breakdown is None:
                cost_breakdown = getattr(standard_logging, "cost_breakdown", None)
        cost = (cost_breakdown or {}).get("total_cost")

    if cost is None and response_obj is not None:
        try:
            from litellm.cost_calculator import completion_cost

            cost = completion_cost(completion_response=response_obj)
        except Exception:
            cost = None

    try:
        return float(cost) if cost is not None else None
    except (TypeError, ValueError):
        return None


def patch_litellm_otel_cost() -> None:
    """
    Monkey-patch LiteLLM OpenTelemetry set_attributes to inject cost without replacing the 'otel' callback.
    """
    if getattr(OpenTelemetry.set_attributes, "_ne_cost_patched", False):
        return

    original = OpenTelemetry.set_attributes

    def _patched_set_attributes(self, span, kwargs, response_obj):
        original(self, span, kwargs, response_obj)
        try:
            cost = _extract_total_cost(kwargs, response_obj)
            if cost is not None:
                self.safe_set_attribute(span, "gen_ai.usage.cost", cost)
                self.safe_set_attribute(
                    span,
                    "langfuse.observation.cost_details",
                    json.dumps({"total": cost}),
                )
        except Exception:
            pass

    _patched_set_attributes._ne_cost_patched = True  # type: ignore[attr-defined]
    OpenTelemetry.set_attributes = _patched_set_attributes  # type: ignore[assignment]
