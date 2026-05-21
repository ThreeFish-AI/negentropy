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
from negentropy.model_names import extract_vendor, observability_model_name, pricing_lookup_model_name


def _normalize_model_name(model: str | None, *, vendor_hint: str | None = None) -> str | None:
    """规范化模型名用于 Langfuse 上报（``vendor/model`` 全名 + 剥日期 + 别名）。

    与调度路径的 ``canonicalize_model_name`` 正交：调度需要保留 ``vendor/``
    前缀以驱动 LiteLLM 选择真实 API；观测同样以 ``vendor/model`` 形态上报，让
    Langfuse Model Costs 视图把同一模型聚合到单一 cost 行（避免裸名 vs 带前缀
    被拆成多行）。两套口径都落在 ``model_names`` 模块，但语义独立维护。

    ``vendor_hint`` 用于跨字段一致性：当 response.model 是裸名（如 Gemini Embedding
    的 ``text-embedding-004``）时，请求侧的 ``gemini/`` 前缀作为权威来源透传给
    ``observability_model_name``，避免 ``_VENDOR_FAMILY_PREFIXES`` 误把它识别成
    OpenAI 模型。
    """
    if model is None:
        return None
    normalized = observability_model_name(model, vendor_hint=vendor_hint)
    return normalized if normalized else model


# ----------------------------------------------------------------------------
# P3-3 · OpenTelemetry GenAI Semantic Conventions 1.28+
# ----------------------------------------------------------------------------
# 标准属性键参考：https://opentelemetry.io/docs/specs/semconv/gen-ai/
# vendor 与裸名的单一事实源：``negentropy.model_names``。本文件仅作 OTel 注入。


def _extract_response_model(response_obj: Any) -> str | None:
    """从 LiteLLM response 对象中提取 model 字段，兼容 dict / object 两种形态。"""
    if response_obj is None:
        return None
    if hasattr(response_obj, "get"):
        try:
            val = response_obj.get("model")
            if isinstance(val, str):
                return val
        except Exception:
            pass
    val = getattr(response_obj, "model", None)
    return val if isinstance(val, str) else None


def _apply_model_normalization(span: Any, kwargs: dict, response_obj: Any) -> None:
    """归一化模型名 + 注入 cost，确保 Langfuse 聚合到单一 ``vendor/model`` 行。

    唯一写入 ``gen_ai.request.model``、``gen_ai.response.model`` 和
    ``langfuse.observation.model.name`` 的入口。``_inject_genai_semconv_attrs``
    不再写入 model 相关属性。

    跨字段 vendor 一致性：request 与 response 共用同一 ``vendor_hint``，避免
    ``gemini/text-embedding-004`` request 与 ``text-embedding-004`` response 被
    家族前缀表分别识别成 ``gemini`` 与 ``openai``，造成 Langfuse 拆两行。
    """
    model = kwargs.get("model")
    response_model = _extract_response_model(response_obj)

    # vendor 单一事实源：原串前缀优先（LiteLLM 调度必带 ``vendor/``），其次响应裸名系族识别。
    system = extract_vendor(model) or extract_vendor(response_model)

    normalized_model = _normalize_model_name(model, vendor_hint=system) if model else None
    normalized_response_model = _normalize_model_name(response_model, vendor_hint=system) if response_model else None

    if not _is_writable_span(span):
        return

    # 覆盖 LiteLLM 原始写入的 request/response model（归一化为 ``vendor/model`` 全名）
    if normalized_model:
        _safe_set_span_attribute(span, "gen_ai.request.model", normalized_model)
    if normalized_response_model:
        _safe_set_span_attribute(span, "gen_ai.response.model", normalized_response_model)

    if system:
        _safe_set_span_attribute(span, "gen_ai.system", system)

    # Langfuse 私有强制覆盖键：最高优先级，确保 Model Costs 视图收敛到同一 ``vendor/model`` 行。
    langfuse_model = normalized_response_model or normalized_model
    if langfuse_model:
        _safe_set_span_attribute(span, "langfuse.observation.model.name", langfuse_model)

    # 诊断字段：保留原始调度模型名，便于排查。
    if model:
        _safe_set_span_attribute(span, "gen_ai.original_model", str(model))
    if response_model and str(response_model) != str(model):
        _safe_set_span_attribute(span, "gen_ai.original_response_model", str(response_model))

    # Cost
    cost = _extract_total_cost(kwargs, response_obj)
    if cost is not None:
        _safe_set_span_attribute(span, "gen_ai.usage.cost", cost)
        _safe_set_span_attribute(
            span,
            "langfuse.observation.cost_details",
            json.dumps({"total": cost}),
        )

    # 补全 OTel GenAI semconv 1.28+ 非模型属性
    _inject_genai_semconv_attrs(span, kwargs, response_obj)


def _inject_genai_semconv_attrs(
    span: Any,
    kwargs: dict,
    response_obj: Any,
) -> None:
    """在 LLM span 上写入 OTel GenAI semconv 1.28+ 非模型标准属性。

    涵盖 attribute（fail-soft，单个失败不影响其他）：
        gen_ai.operation.name,
        gen_ai.request.temperature, gen_ai.request.top_p, gen_ai.request.max_tokens,
        gen_ai.usage.input_tokens, gen_ai.usage.output_tokens,
        gen_ai.response.id, gen_ai.response.finish_reasons

    模型属性（gen_ai.request.model / gen_ai.response.model /
    gen_ai.system / langfuse.observation.model.name）由
    ``_apply_model_normalization`` 统一写入，本函数不再涉及。
    """
    if not _is_writable_span(span):
        return

    try:
        # gen_ai.system 已由 _apply_model_normalization 写入，此处不重复
        _safe_set_span_attribute(span, "gen_ai.operation.name", "chat")

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
            raw_model = kwargs.get("model", "unknown")
            model = _normalize_model_name(raw_model, vendor_hint=extract_vendor(raw_model))
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
            raw_model = kwargs.get("model", "unknown")
            model = _normalize_model_name(raw_model, vendor_hint=extract_vendor(raw_model))
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

    使用 ``pricing_lookup_model_name`` 而非 ``_normalize_model_name``：定价路径需要
    裸名作为 LiteLLM catalog 查表键（``observability_model_name`` 在 2026-05-21 反转
    口径后输出 ``vendor/model`` 全名，与定价查表语义已不再耦合）。
    """
    model = pricing_lookup_model_name(kwargs.get("model"))
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

        # 原始方法可能因 standard_logging_object 缺失等原因内部失败，
        # 但它已经将 gen_ai.request.model = kwargs["model"]（原始值如
        # "openai/gpt-5-mini"）写入 span。包裹 try/except 确保后续归一化
        # 始终执行，覆盖原始值。
        try:
            original_set_attributes(self, span, kwargs, response_obj)
        except Exception:
            pass

        try:
            _apply_model_normalization(span, kwargs, response_obj)
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
