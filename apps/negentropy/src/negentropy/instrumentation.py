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
    """Normalize model name for consistent Langfuse reporting."""
    return canonicalize_model_name(model) or model


# ----------------------------------------------------------------------------
# P3-3 · OpenTelemetry GenAI Semantic Conventions 1.28+
# ----------------------------------------------------------------------------
# 标准属性键参考：https://opentelemetry.io/docs/specs/semconv/gen-ai/
# 实施动机详见 docs/observability-genai.md。

_GENAI_SYSTEM_PREFIX_MAP: dict[str, str] = {
    # OpenAI 系
    "openai/": "openai",
    "gpt-": "openai",
    "o1-": "openai",
    "o3-": "openai",
    # Anthropic 系
    "anthropic/": "anthropic",
    "claude-": "anthropic",
    # Google 系
    "gemini/": "gemini",
    "gemini-": "gemini",
    "vertex_ai/": "vertex_ai",
    # Mistral 系
    "mistral/": "mistral",
    # Cohere 系
    "cohere/": "cohere",
    # Meta / Llama 系
    "llama-": "meta",
    "ollama/": "ollama",
    # Groq 系
    "groq/": "groq",
    # DeepSeek 系
    "deepseek/": "deepseek",
}


def _detect_genai_system(model: str | None) -> str | None:
    """根据模型名前缀映射到 OTel GenAI semconv ``gen_ai.system`` 值。

    返回 None 表示无法识别 —— span 上不写该 attribute（避免污染未知值）。
    """
    if not model:
        return None
    lowered = str(model).lower()
    for prefix, system in _GENAI_SYSTEM_PREFIX_MAP.items():
        if lowered.startswith(prefix):
            return system
    return None


def _inject_genai_semconv_attrs(
    span: Any,
    kwargs: dict,
    response_obj: Any,
) -> None:
    """在 LLM span 上写入 OpenTelemetry GenAI semconv 1.28+ 标准属性。

    涵盖 attribute（fail-soft，单个失败不影响其他）：
        gen_ai.system, gen_ai.operation.name, gen_ai.request.model, gen_ai.response.model,
        gen_ai.request.temperature, gen_ai.request.top_p, gen_ai.request.max_tokens,
        gen_ai.usage.input_tokens, gen_ai.usage.output_tokens,
        gen_ai.response.id, gen_ai.response.finish_reasons

    本函数是幂等的（重复调用同 span 仅覆盖同名 attribute）。
    """
    if not _is_writable_span(span):
        return

    try:
        model = kwargs.get("model")
        normalized_model = _normalize_model_name(model) if model else None
        system = _detect_genai_system(normalized_model or model)

        if system:
            _safe_set_span_attribute(span, "gen_ai.system", system)
        # 当前 negentropy 仅走 chat completion 链路；TODO: 区分 embedding / tool_use
        _safe_set_span_attribute(span, "gen_ai.operation.name", "chat")
        if normalized_model:
            _safe_set_span_attribute(span, "gen_ai.request.model", normalized_model)

        # 请求参数（仅当存在时上报）
        for key, attr in (
            ("temperature", "gen_ai.request.temperature"),
            ("top_p", "gen_ai.request.top_p"),
            ("max_tokens", "gen_ai.request.max_tokens"),
            ("stop", "gen_ai.request.stop_sequences"),
        ):
            value = kwargs.get(key)
            if value is None:
                continue
            try:
                _safe_set_span_attribute(span, attr, value)
            except Exception:
                pass

        # 响应字段
        if response_obj is not None:
            response_model = None
            if hasattr(response_obj, "get"):
                try:
                    response_model = response_obj.get("model")
                except Exception:
                    response_model = None
            if response_model is None:
                response_model = getattr(response_obj, "model", None)
            normalized_response_model = _normalize_model_name(response_model) if response_model else None
            if normalized_response_model:
                _safe_set_span_attribute(span, "gen_ai.response.model", normalized_response_model)

            response_id = None
            if hasattr(response_obj, "get"):
                try:
                    response_id = response_obj.get("id")
                except Exception:
                    response_id = None
            if response_id is None:
                response_id = getattr(response_obj, "id", None)
            if response_id:
                _safe_set_span_attribute(span, "gen_ai.response.id", str(response_id))

            usage = getattr(response_obj, "usage", None)
            if usage is not None:
                input_tokens = getattr(usage, "prompt_tokens", None)
                output_tokens = getattr(usage, "completion_tokens", None)
                if input_tokens is not None:
                    _safe_set_span_attribute(span, "gen_ai.usage.input_tokens", int(input_tokens))
                if output_tokens is not None:
                    _safe_set_span_attribute(span, "gen_ai.usage.output_tokens", int(output_tokens))

            finish_reasons: list[str] = []
            choices = (
                response_obj.get("choices") if hasattr(response_obj, "get") else getattr(response_obj, "choices", None)
            )
            if isinstance(choices, list):
                for choice in choices:
                    fr = None
                    if hasattr(choice, "get"):
                        try:
                            fr = choice.get("finish_reason")
                        except Exception:
                            fr = None
                    if fr is None:
                        fr = getattr(choice, "finish_reason", None)
                    if fr:
                        finish_reasons.append(str(fr))
            if finish_reasons:
                _safe_set_span_attribute(
                    span,
                    "gen_ai.response.finish_reasons",
                    finish_reasons,
                )
    except Exception:
        # fail-soft：观测属性丢失不能影响 LLM 主路径
        pass


def _is_writable_span(span: Any) -> bool:
    """Return whether an OpenTelemetry span can still accept mutations."""
    if span is None:
        return False

    is_recording = getattr(span, "is_recording", None)
    if callable(is_recording):
        try:
            return bool(is_recording())
        except Exception:
            return False

    return False


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
    3. Guard ended spans in LiteLLM's success path
    """
    original_set_attributes = OpenTelemetry.set_attributes

    def _patched_set_attributes(self, span, kwargs, response_obj):
        if not _is_writable_span(span):
            return

        original_set_attributes(self, span, kwargs, response_obj)
        try:
            # Normalize model name for consistent Langfuse reporting
            model = kwargs.get("model", "unknown")
            normalized_model = _normalize_model_name(model)
            response_model = None
            if response_obj is not None and hasattr(response_obj, "get"):
                response_model = response_obj.get("model")
            normalized_response_model = _normalize_model_name(response_model) if response_model else None

            if not _is_writable_span(span):
                return

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

            # P3-3 · OTel GenAI semconv 1.28+ 标准属性补全
            _inject_genai_semconv_attrs(span, kwargs, response_obj)
        except Exception:
            pass

    if not getattr(OpenTelemetry.set_attributes, "_ne_cost_patched", False):
        _patched_set_attributes._ne_cost_patched = True  # type: ignore[attr-defined]
        OpenTelemetry.set_attributes = _patched_set_attributes  # type: ignore[assignment]

    if getattr(OpenTelemetry._handle_success, "_ne_span_guard_patched", False):
        return

    original_handle_success = OpenTelemetry._handle_success
    handle_success_globals = original_handle_success.__globals__
    get_secret_bool = handle_success_globals["get_secret_bool"]
    proxy_span_name = handle_success_globals["LITELLM_PROXY_REQUEST_SPAN_NAME"]

    def _patched_handle_success(self, kwargs, response_obj, start_time, end_time):
        from opentelemetry.trace import Status, StatusCode

        handle_success_globals["verbose_logger"].debug(
            "OpenTelemetry Logger: Logging kwargs: %s, OTEL config settings=%s",
            kwargs,
            self.config,
        )
        ctx, parent_span = self._get_span_context(kwargs)

        should_create_primary_span = parent_span is None or get_secret_bool("USE_OTEL_LITELLM_REQUEST_SPAN")

        if should_create_primary_span:
            span = self._start_primary_span(kwargs, response_obj, start_time, end_time, ctx)
            self._maybe_log_raw_request(kwargs, response_obj, start_time, end_time, span)
            if parent_span is not None and parent_span.name == proxy_span_name and _is_writable_span(parent_span):
                self.set_attributes(parent_span, kwargs, response_obj)
        else:
            span = None
            if _is_writable_span(parent_span):
                parent_span.set_status(Status(StatusCode.OK))
                self.set_attributes(parent_span, kwargs, response_obj)
                self._maybe_log_raw_request(kwargs, response_obj, start_time, end_time, parent_span)

        self._create_guardrail_span(kwargs=kwargs, context=ctx)
        self._record_metrics(kwargs, response_obj, start_time, end_time)

        if self.config.enable_events:
            log_span = span if _is_writable_span(span) else parent_span
            if _is_writable_span(log_span):
                self._emit_semantic_logs(kwargs, response_obj, log_span)

        if parent_span is not None and parent_span.name == proxy_span_name and _is_writable_span(parent_span):
            parent_span.end(end_time=self._to_ns(end_time))

    _patched_handle_success._ne_span_guard_patched = True  # type: ignore[attr-defined]
    OpenTelemetry._handle_success = _patched_handle_success  # type: ignore[assignment]
