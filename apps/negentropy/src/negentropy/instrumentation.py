"""
Instrumentation and Observability Callbacks.
"""

from __future__ import annotations

import json
from typing import Any

from litellm.integrations.opentelemetry import OpenTelemetry
from opentelemetry import trace

from negentropy.config.pricing import get_effective_model_pricing_usd, get_last_online_catalog_error
from negentropy.logging import get_logger
from negentropy.model_names import canonicalize_model_name


def _normalize_model_name(model: str) -> str:
    """Normalize model name for consistent Langfuse reporting.

    Ensures GLM models always have the 'zai/' prefix for consistent naming.
    """
    return canonicalize_model_name(model) or model


def _is_writable_span(span: Any) -> bool:
    return span is not None and hasattr(span, "is_recording") and bool(span.is_recording())


def _safe_set_span_attribute(span: Any, key: str, value: Any) -> None:
    if not _is_writable_span(span):
        return
    span.set_attribute(key, value)


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
            model = _normalize_model_name(kwargs.get("model", "unknown"))
            input_tokens = 0
            output_tokens = 0

            # Extract usage from response
            if hasattr(response_obj, "usage"):
                usage = response_obj.usage
                input_tokens = getattr(usage, "prompt_tokens", 0)
                output_tokens = getattr(usage, "completion_tokens", 0)

            # Calculate cost
            resolved_kwargs = dict(kwargs)
            resolved_kwargs["model"] = model
            resolved_kwargs["response_obj"] = response_obj
            total_cost, pricing_source, pricing_refresh_error = _resolve_total_cost(
                resolved_kwargs,
                response_obj,
            )
            if total_cost is not None:
                cost = total_cost
            else:
                cost = self._get_model_cost({"response_obj": response_obj, "model": model})

            # Inject cost into current OTEL span without changing LiteLLM's OTEL callback
            try:
                span = trace.get_current_span()
                if total_cost is not None:
                    _safe_set_span_attribute(span, "gen_ai.usage.cost", float(total_cost))
                    _safe_set_span_attribute(
                        span,
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
                pricing_source=pricing_source,
                pricing_refresh_error=pricing_refresh_error,
            )
        except Exception:
            pass  # Fail safe

    def log_failure_event(self, kwargs: dict, response_obj: Any, start_time: Any, end_time: Any) -> None:
        """Log failed LLM interaction."""
        try:
            model = _normalize_model_name(kwargs.get("model", "unknown"))
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
    cost, _, _ = _resolve_total_cost(kwargs, response_obj)
    return cost


def _resolve_total_cost(kwargs: dict, response_obj: Any) -> tuple[float | None, str, str | None]:
    """Extract cost with fallback to custom pricing.

    Priority:
    1. LiteLLM's response_cost (already calculated)
    2. LiteLLM's cost_breakdown from standard_logging_object
    3. LiteLLM's completion_cost function
    4. LiteLLM 官方在线价目表
    5. 本地 override 配置
    """
    model = _normalize_model_name(kwargs.get("model"))
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
    if cost is not None:
        return _coerce_cost(cost), "litellm_builtin", None

    if cost is None and response_obj is not None:
        try:
            from litellm.cost_calculator import completion_cost

            cost = completion_cost(completion_response=response_obj)
        except Exception:
            cost = None
    if cost is not None:
        return _coerce_cost(cost), "litellm_builtin", None

    if cost is None and response_obj is not None:
        pricing, pricing_source = get_effective_model_pricing_usd(model)
        if pricing is not None:
            cost = _calculate_token_cost(response_obj=response_obj, pricing=pricing)
            if cost is not None:
                return _coerce_cost(cost), pricing_source, None

    return _coerce_cost(cost), "missing", get_last_online_catalog_error()


def _coerce_cost(cost: Any) -> float | None:
    try:
        return float(cost) if cost is not None else None
    except (TypeError, ValueError):
        return None


def _calculate_token_cost(response_obj: Any, pricing: dict[str, float]) -> float | None:
    input_tokens = 0
    output_tokens = 0
    if hasattr(response_obj, "usage") and response_obj.usage is not None:
        usage = response_obj.usage
        input_tokens = getattr(usage, "prompt_tokens", 0) or 0
        output_tokens = getattr(usage, "completion_tokens", 0) or 0

    if input_tokens == 0 and output_tokens == 0:
        return None

    input_cost = (input_tokens / 1_000_000) * pricing.get("input", 0)
    output_cost = (output_tokens / 1_000_000) * pricing.get("output", 0)
    return input_cost + output_cost


def patch_litellm_otel_cost() -> None:
    """
    Monkey-patch LiteLLM OpenTelemetry set_attributes to:
    1. Normalize model name for consistent Langfuse reporting
    2. Inject cost without replacing the 'otel' callback
    """
    if getattr(OpenTelemetry.set_attributes, "_ne_cost_patched", False):
        return

    original = OpenTelemetry.set_attributes

    def _patched_set_attributes(self, span, kwargs, response_obj):
        original(self, span, kwargs, response_obj)
        try:
            # Normalize model name for consistent Langfuse reporting
            model = kwargs.get("model", "unknown")
            normalized_model = _normalize_model_name(model)
            response_model = None
            if response_obj is not None and hasattr(response_obj, "get"):
                response_model = response_obj.get("model")
            normalized_response_model = _normalize_model_name(response_model) if response_model else None

            if normalized_model != model:
                _safe_set_span_attribute(span, "gen_ai.request.model", normalized_model)
            if normalized_response_model and normalized_response_model != response_model:
                _safe_set_span_attribute(span, "gen_ai.response.model", normalized_response_model)

            # Extract and inject cost
            cost = _extract_total_cost(kwargs, response_obj)
            if cost is not None:
                _safe_set_span_attribute(span, "gen_ai.usage.cost", cost)
                _safe_set_span_attribute(
                    span,
                    "langfuse.observation.cost_details",
                    json.dumps({"total": cost}),
                )
        except Exception:
            pass

    _patched_set_attributes._ne_cost_patched = True  # type: ignore[attr-defined]
    OpenTelemetry.set_attributes = _patched_set_attributes  # type: ignore[assignment]
