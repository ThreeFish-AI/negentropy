"""ADK 工具调用遥测采集器 — before/after_tool_callback 写 tool_invocations 事实表。

设计蓝图：``docs/concepts/design/self-evolving-agents.md`` §3（遥测子系统）。
挂载于 root_agent（NegentropyEngine）的 ``before_tool_callback`` / ``after_tool_callback``
（ADK LlmAgent 完整支持，项目此前零使用）。before 记起始时间到 state（按 function_call_id
配对），after 构造 ``ToolInvocation`` 行 + fire-and-forget 写库（不阻塞工具返回）。

关键设计：
- **fire-and-forget**：callback 即使是 async，ADK Runner 也 ``await callback()`` 串行——直接在
  callback 内 await DB 写会让每次工具调用多一次 DB round-trip（1-5ms）。``_schedule_write``
  把写库移出关键路径，callback 主体仅做内存构造（json.dumps + sha256 <0.5ms）。
- **灰度**：``settings.observability.tool_telemetry_enabled=False`` 时 ``make_*`` 工厂返回 None，
  agent 不挂载 callback，零开销。
- **失败隔离**：全程 try/except 吞异常 + ceiling 256 防 OOM——遥测故障绝不影响工具调用。

参考文献：
[1] OpenTelemetry GenAI semconv, "execute_tool" span. trace_id/span_id 关联。
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
from typing import Any

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.logging import get_logger
from negentropy.models.tool_telemetry import (
    CALLER_KIND_ADK_AGENT,
    OUTCOME_SOURCE_NONE,
    STATUS_ERROR,
    STATUS_SUCCESS,
    TOOL_KIND_ADK_FUNCTION,
    TOOL_KIND_BUILTIN,
    TOOL_KIND_MCP,
    TOOL_KIND_SKILL,
    ToolInvocation,
)

logger = get_logger("negentropy.engine.observability.tool_telemetry")

_DIGEST_CAP = 16 * 1024  # input/output 截断上限（对齐 orchestrator._EVENT_FIELD_CAP）
_TELEMETRY_INFLIGHT_CEILING = 256  # fire-and-forget 反馈风暴硬上限

# before_tool_callback 记录起始时间的 state 键前缀（按 function_call_id 配对）
_START_KEY_PREFIX = "__tool_t_start::"

# 项目 skill 工具名集（_resolve_tool_kind 判定）
_SKILL_TOOL_NAMES: frozenset[str] = frozenset({"expand_skill", "list_available_skills"})

_pending_tool_telemetry: set[asyncio.Task] = set()


def _make_digest(value: str | None, cap: int = _DIGEST_CAP) -> str | None:
    """超限截断 + 附 sha256[:12] 短 hash，保证可溯源又不爆库。

    原样返回（str ≤ cap）或 None 透传；超限时返回
    ``<head>…[truncated N chars,sha256=abcdef123456]``（输出长度严格 ≤ cap）。
    """
    if value is None:
        return None
    if len(value) <= cap:
        return value
    short_hash = hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]
    marker = f"…[truncated {len(value) - cap} chars,sha256={short_hash}]"
    head = max(0, cap - len(marker))
    return value[:head] + marker


def _resolve_tool_kind(tool_name: str) -> str:
    """工具名 → tool_kind 映射。

    - ``expand_skill`` / ``list_available_skills`` → skill
    - ``transfer_to_agent`` / ``built_in_*`` → builtin（ADK 内置，少数可枚举）
    - ``mcp_*`` → mcp（当前未接入 agents/，预留）
    - 默认 → adk_function（主流量归项目工具）
    """
    if tool_name in _SKILL_TOOL_NAMES:
        return TOOL_KIND_SKILL
    if tool_name == "transfer_to_agent" or tool_name.startswith("built_in_"):
        return TOOL_KIND_BUILTIN
    if tool_name.startswith("mcp_"):
        return TOOL_KIND_MCP
    return TOOL_KIND_ADK_FUNCTION


def make_before_tool_callback() -> Any | None:
    """返回 ADK before_tool_callback。灰度关时返回 None（agent 不挂载，零开销）。"""
    if not settings.observability.tool_telemetry_enabled:
        return None

    async def _before_tool_callback(tool: Any, args: dict[str, Any], tool_context: Any) -> None:
        try:
            fc_id = getattr(tool_context, "function_call_id", None)
            if fc_id is None:
                return
            tool_context.state[f"{_START_KEY_PREFIX}{fc_id}"] = time.monotonic()
        except Exception:
            logger.debug("tool_telemetry_before_failed", exc_info=True)

    return _before_tool_callback


def make_after_tool_callback() -> Any | None:
    """返回 ADK after_tool_callback。灰度关时返回 None。"""
    if not settings.observability.tool_telemetry_enabled:
        return None

    async def _after_tool_callback(tool: Any, args: dict[str, Any], tool_context: Any, tool_response: Any) -> None:
        try:
            _emit_tool_invocation(tool, args, tool_context, tool_response)
        except Exception:
            logger.debug("tool_telemetry_after_failed", exc_info=True)

    return _after_tool_callback


def _emit_tool_invocation(
    tool: Any,
    args: dict[str, Any],
    tool_context: Any,
    tool_response: Any,
) -> None:
    """构造 ToolInvocation 行 + fire-and-forget 写库。"""
    # 1) latency（before/after monotonic 配对）
    fc_id = getattr(tool_context, "function_call_id", None)
    start = tool_context.state.get(f"{_START_KEY_PREFIX}{fc_id}") if fc_id and hasattr(tool_context, "state") else None
    latency_ms = int((time.monotonic() - start) * 1000) if start else None

    # 2) caller_kind（默认 adk_agent；state hook 覆盖，后续 routine/skill 切片注入）
    caller_kind = CALLER_KIND_ADK_AGENT
    try:
        caller_kind = tool_context.state.get("__caller_kind", CALLER_KIND_ADK_AGENT)
    except Exception:
        pass

    # 3) status（tool_response 含 error 键 → error）
    status = STATUS_SUCCESS
    error_class: str | None = None
    if isinstance(tool_response, dict):
        err = tool_response.get("error") or tool_response.get("__error")
        if err:
            status = STATUS_ERROR
            error_class = type(err).__name__ if not isinstance(err, str) else err

    # 4) trace_id/span_id（OTel context；未启用 OTel → None）
    trace_id, span_id = _extract_otel_span_ids()

    # 5) agent_name / thread_id
    agent_name = _safe_get_agent_name(tool_context)
    thread_id = _safe_get_thread_id(tool_context)

    # 5b) R6-b runtime canary 在线信号：expand_skill 调用打 skill_ref + canary_assignment（同步缓存读，
    # 不触 DB）。供 advance_runtime_canary 聚合候选桶 vs 基线桶的 error-rate（综述 §9.3 在线受控发布信号）。
    tool_name = getattr(tool, "name", "unknown")
    skill_ref: str | None = None
    canary_assignment: str | None = None
    if tool_name == "expand_skill" and isinstance(args, dict):
        skill_ref = str(args.get("name") or "") or None
        if skill_ref:
            canary_assignment = _resolve_skill_canary_assignment_sync(skill_ref, thread_id)

    # 6) 构造行 + fire-and-forget
    row = ToolInvocation(
        caller_kind=caller_kind,
        agent_name=agent_name,
        thread_id=thread_id,
        tool_kind=_resolve_tool_kind(tool_name),
        tool_ref=tool_name,
        tool_version="unversioned",
        skill_ref=skill_ref,
        status=status,
        latency_ms=latency_ms,
        error_class=error_class,
        input_digest=_make_digest(_safe_json(args)),
        output_digest=_make_digest(_safe_json(tool_response)),
        trace_id=trace_id,
        span_id=span_id,
        canary_assignment=canary_assignment,
        outcome_source=OUTCOME_SOURCE_NONE,
    )
    _schedule_write(row)


def _resolve_skill_canary_assignment_sync(skill_name: str, thread_id: str | None) -> str | None:
    """同步判定该会话看到的 skill version（runtime canary 命中桶 → 候选 version；否则 None）。

    读 ``queries._skill_canary_cache``（skills_injector 解析时异步填充）+ ``bucket_index`` 同步计算，
    不触 DB（热路径安全）。缓存未命中 / 无在途 runtime_canary / 未命中桶 → None（记为基线桶）。
    """
    try:
        from negentropy.engine.evolution.canary import bucket_index
        from negentropy.engine.evolution.queries import get_cached_skill_canary

        canary = get_cached_skill_canary(skill_name)
        if not canary:
            return None
        ratio = float(canary.get("bucket_ratio_pct") or 0.0)
        if ratio <= 0 or not thread_id:
            return None
        if bucket_index(None, None, bucket_key=thread_id) < ratio:
            return str(canary.get("proposed_version") or "")
    except Exception:  # noqa: BLE001  # 遥测热路径绝不因 canary 解析失败而中断
        return None
    return None


def _schedule_write(row: ToolInvocation) -> None:
    """fire-and-forget 写库（不阻塞工具返回）。ceiling 256 防 OOM。"""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return  # 不在事件循环中（同步测试路径等）→ 跳过

    if len(_pending_tool_telemetry) >= _TELEMETRY_INFLIGHT_CEILING:
        logger.warning("tool_telemetry_dropped_inflight_ceiling", inflight=len(_pending_tool_telemetry))
        return

    task = loop.create_task(_persist_row(row))
    _pending_tool_telemetry.add(task)
    task.add_done_callback(_pending_tool_telemetry.discard)
    try:
        from negentropy.engine.lifecycle import track_task

        track_task(task)
    except Exception:  # pragma: no cover
        pass


async def _persist_row(row: ToolInvocation) -> None:
    """单行 INSERT；吞异常（遥测失败不得影响主链路）。"""
    try:
        async with db_session.AsyncSessionLocal() as db:
            db.add(row)
            await db.commit()
    except Exception:
        logger.debug("tool_telemetry_persist_failed", exc_info=True)


def _extract_otel_span_ids() -> tuple[str | None, str | None]:
    """从当前 OTel span 取 trace_id/span_id；未启用 OTel 返回 (None, None)。"""
    try:
        from opentelemetry.trace import get_current_span

        ctx = get_current_span().get_span_context()
        if ctx and ctx.is_valid:
            return (f"{ctx.trace_id:032x}", f"{ctx.span_id:016x}")
    except Exception:
        pass
    return (None, None)


def _safe_json(value: Any) -> str | None:
    """安全 json 序列化（非可序列化类型 default=str；None 透传）。"""
    if value is None:
        return None
    try:
        return json.dumps(value, default=str, ensure_ascii=False)
    except Exception:
        return None


def _safe_get_agent_name(tool_context: Any) -> str | None:
    """从 tool_context 取 agent_name（经 invocation_context）。"""
    try:
        inv_ctx = getattr(tool_context, "_invocation_context", None)
        if inv_ctx is not None:
            return getattr(inv_ctx, "agent_name", None)
        return getattr(tool_context, "agent_name", None)
    except Exception:
        return None


def _safe_get_thread_id(tool_context: Any) -> str | None:
    """从 tool_context.session.id 取 thread_id。"""
    try:
        session = getattr(tool_context, "session", None)
        if session is not None:
            return str(getattr(session, "id", None) or "")
        return None
    except Exception:
        return None


__all__ = [
    "make_before_tool_callback",
    "make_after_tool_callback",
    "_make_digest",
    "_resolve_tool_kind",
]
