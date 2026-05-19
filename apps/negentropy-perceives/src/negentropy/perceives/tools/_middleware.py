"""FastMCP 中间件：绑定任务级上下文并记录入口/收尾日志。

职责：
- 为每次 `on_call_tool` 生成 8 字符任务 ID，并绑定到 contextvars（贯穿整个 asyncio 任务树）
- 从 `MiddlewareContext.fastmcp_context` 读取 session_id，拼装 source（tool_name/session8）
- 首次见到某个 session 时，解析 HTTP 请求的 client IP / User-Agent 并输出一行登记日志
- 在 finally 段输出任务完成日志，附带总耗时与各 Stage 摘要

Why 中间件层：
- 这是 MCP 调用的最外层切面，能在任何 ops / pipeline 代码运行前先 bind 上下文
- `contextvars.Token.reset()` 保证即使异常也能释放，避免状态泄漏到下一次调用
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Set

from fastmcp.server.dependencies import get_http_request
from fastmcp.server.middleware import CallNext, Middleware, MiddlewareContext

from ..core.cancellation import current_cancel_scope
from ..core.task_context import (
    TaskTiming,
    new_task_id,
    source_var,
    task_id_var,
    timing_var,
)

logger = logging.getLogger(__name__)

# 已登记 session 的集合，用于避免重复打印客户端登记行。
# 注意：此集合在服务进程内单实例共享，足以覆盖 stdio（无 session）与 HTTP（长 session）两种场景。
_seen_sessions: Set[str] = set()


class TaskContextMiddleware(Middleware):
    """在每次工具调用入口/出口处管理任务上下文与摘要日志。"""

    async def on_call_tool(
        self,
        context: MiddlewareContext[Any],
        call_next: CallNext[Any, Any],
    ) -> Any:
        task_id = new_task_id()
        fmcp_ctx = context.fastmcp_context
        session_id = getattr(fmcp_ctx, "session_id", None) if fmcp_ctx else None
        session_short = (session_id or "stdio")[:8]
        tool_name = getattr(context.message, "name", "<unknown>")
        source = f"{tool_name}/{session_short}"

        # 首次见到 session：输出一次客户端信息扩展行（IP / UA）
        if session_id and session_id not in _seen_sessions:
            _seen_sessions.add(session_id)
            ip, ua = _extract_http_client_info()
            logger.info(
                "新会话已登记 session=%s client=%s ua=%s",
                session_id,
                ip,
                ua,
            )

        # 读取用户传入的 timeout 以便在入口日志中展示（实际超时由 ops 层执行）
        arguments = getattr(context.message, "arguments", None) or {}
        timeout_arg = arguments.get("timeout") if isinstance(arguments, dict) else None

        timing = TaskTiming(start_monotonic=time.monotonic())
        task_tok = task_id_var.set(task_id)
        src_tok = source_var.set(source)
        timing_tok = timing_var.set(timing)

        logger.info(
            "收到任务 tool=%s source=%s timeout=%s",
            tool_name,
            source,
            f"{timeout_arg}s" if timeout_arg else "default",
        )
        cancelled = False
        try:
            return await call_next(context)
        except asyncio.CancelledError:
            cancelled = True
            # ops 层通常已将 CancelledError 转为带错误的响应；若仍抛出，
            # 说明上游（MCP 传输/SDK）强行取消，我们在此仅登记信号与日志。
            scope = current_cancel_scope()
            if scope is not None and scope.reason is None:
                scope.mark_cancelled("client_cancelled")
            reason = scope.reason if scope is not None else "unknown"
            elapsed = time.monotonic() - timing.start_monotonic
            logger.warning(
                "任务取消 tool=%s source=%s reason=%s elapsed=%.2fs",
                tool_name,
                source,
                reason,
                elapsed,
            )
            raise
        except Exception as e:
            # anyio.ClosedResourceError：会话流在任务执行期间被关闭
            # （如客户端 DELETE /mcp 终止会话后任务才完成），防御性捕获避免
            # 未处理异常传播至 FastMCP TaskGroup 导致整个会话崩溃。
            # 使用 Exception 而非 BaseException，避免拦截 KeyboardInterrupt/SystemExit
            # 等非业务异常，同时 ClosedResourceError 作为 Exception 子类仍可被捕获。
            if type(e).__name__ == "ClosedResourceError":
                cancelled = True
                elapsed = time.monotonic() - timing.start_monotonic
                logger.warning(
                    "会话流已关闭 tool=%s source=%s elapsed=%.2fs",
                    tool_name,
                    source,
                    elapsed,
                )
            raise
        finally:
            if not cancelled:
                elapsed = time.monotonic() - timing.start_monotonic
                stage_summary = _format_stage_summary(timing)
                logger.info(
                    "任务完成 elapsed=%.2fs stages=%s",
                    elapsed,
                    stage_summary,
                )
            # 按 LIFO 顺序释放 ContextVar Token，避免嵌套场景下状态错乱
            timing_var.reset(timing_tok)
            source_var.reset(src_tok)
            task_id_var.reset(task_tok)


def _extract_http_client_info() -> tuple[str, str]:
    """尝试从当前 HTTP 请求中提取 client IP 与 User-Agent。

    stdio 传输下无 HTTP 请求，返回 `("-", "-")`。
    """

    try:
        req = get_http_request()
    except Exception:
        return "-", "-"
    if req is None:
        return "-", "-"
    client = getattr(req, "client", None)
    ip = getattr(client, "host", None) if client else None
    ua = ""
    headers = getattr(req, "headers", None)
    if headers is not None:
        try:
            ua = headers.get("user-agent", "") or ""
        except Exception:
            ua = ""
    return ip or "-", ua or "-"


def _format_stage_summary(timing: TaskTiming) -> str:
    """将 TaskTiming 的 stage_records 拼接为 `stage1(method,12ms,ok)→stage2(...)`。"""

    if not timing.stage_records:
        return "(no-stage)"
    parts: list[str] = []
    for stage, method, elapsed_ms, success in timing.stage_records:
        status = "ok" if success else "fail"
        method_display = method or "-"
        parts.append(f"{stage}({method_display},{elapsed_ms:.0f}ms,{status})")
    return "→".join(parts)
