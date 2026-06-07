"""ClaudeCodeService — 封装 Claude Code CLI / SDK 调用。"""

from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import time
from collections.abc import Awaitable, Callable
from contextlib import suppress
from typing import Any

from negentropy.engine.utils.subprocess_env import inherited_env_without_engine_venv
from negentropy.logging import get_logger

from .credentials import is_console_api_key
from .models import ClaudeCodeConfig, ClaudeCodeResult

logger = get_logger("negentropy.engine.claude_code.service")

# stream-json 事件类型常量
_EVT_ASSISTANT = "assistant"
_EVT_TOOL_USE = "tool_use"
_EVT_TOOL_RESULT = "tool_result"
_EVT_RESULT = "result"
_EVT_SYSTEM = "system"
_EVT_USER = "user"

_SUMMARY_MAX_LEN = 2000

# --- 可恢复错误分类（机制层）：CC 会话上下文窗口耗尽 ---
# 单一事实源：runner / decision 经此常量与 metrics 键比对，避免魔法字符串散落。
ERROR_KIND_CONTEXT_EXHAUSTED = "context_exhausted"

# 可恢复错误：``--resume <id>`` 指向的会话已不存在（CLI 以 rc=1 立即退出，
# stderr: "No conversation found with session ID: <id>"）。根因：routine 跨迭代续接的
# claude_session_id 在 worktree 重建 / 进程重启 / CC 会话存储清理后失效。若不自愈，
# 每轮迭代立即失败（0 turns / $0）并连续累计为 unrecoverable —— 即「会话续接死亡螺旋」。
# 处置（策略层 Runner）：清空 routine.claude_session_id 冷启动，并在迭代内以新会话重试。
ERROR_KIND_SESSION_NOT_FOUND = "session_not_found"
# 会话失效的 stderr 文本信号（大小写无关）；CC 各版本措辞稳定为此句式。
_SESSION_NOT_FOUND_RE = re.compile(r"No conversation found with session ID", re.IGNORECASE)

# 上下文耗尽的「文本信号」（主据）：大小写无关匹配 result 事件正文。实测 CLI 形态为
# {is_error:true, subtype:"success", result:"API Error: The model has reached its
# context window limit."}（subtype 误导，故不能依赖 subtype，须以 is_error + 文本为准）。
# 多模式并列吸收未来 CC 措辞漂移，最大化召回；仅在 returncode!=0 时触发，不误伤成功路径。
_CONTEXT_EXHAUSTION_RE = re.compile(
    r"context window|context length|context limit|reached its context"
    r"|maximum context|prompt is too long|exceeds the maximum",
    re.IGNORECASE,
)
# 「结构信号」（辅据）：result 事件 subtype 若命中已知上下文类错误码亦判定（OR 文本信号）。
_CONTEXT_SUBTYPES = frozenset({"error_max_context", "error_context_length", "error_context_window"})


def _classify_result_error(
    result_event: dict[str, Any] | None,
    returncode: int | None,
    *,
    stderr_text: str | None = None,
) -> str | None:
    """据 CLI 的 result 事件 / stderr / 退出码识别「可恢复错误类型」（纯函数，无 IO）。

    仅在 ``returncode != 0`` 时考察，按优先级：
    1. 会话失效（stderr 信号）：``stderr`` 命中 ``_SESSION_NOT_FOUND_RE`` → ``ERROR_KIND_SESSION_NOT_FOUND``。
       须先于 result 事件判定——会话失效时 CLI 在产出任何 result 事件前即退出，``result_event`` 缺席。
    2. 上下文耗尽（result 事件双信号 OR）：
       - 文本信号：result 正文命中 ``_CONTEXT_EXHAUSTION_RE``（主据，实测 subtype 不可靠）；
       - 结构信号：``is_error is True`` 且 subtype ∈ ``_CONTEXT_SUBTYPES``（前瞻冗余）。
       命中任一 → ``ERROR_KIND_CONTEXT_EXHAUSTED``。
    否则 ``None``（含成功路径、result 事件缺席且无 stderr 信号）。
    """
    if returncode == 0:
        return None
    # 1) 会话失效：stderr 文本信号优先（result 事件此时通常缺席）
    if stderr_text and _SESSION_NOT_FOUND_RE.search(stderr_text):
        return ERROR_KIND_SESSION_NOT_FOUND
    if not result_event:
        return None
    is_err = result_event.get("is_error") is True
    subtype = result_event.get("subtype")
    text = result_event.get("result")
    if not isinstance(text, str):
        text = json.dumps(text, ensure_ascii=False, default=str) if text is not None else ""
    sig_text = bool(_CONTEXT_EXHAUSTION_RE.search(text))
    sig_subtype = is_err and subtype in _CONTEXT_SUBTYPES
    if sig_text or sig_subtype:
        return ERROR_KIND_CONTEXT_EXHAUSTED
    return None


# 「全过程」动作级审计：单字段截断上限（防 DB / SSE 膨胀）。
_EVENT_FIELD_CAP = 16 * 1024  # 16 KiB / 字段

# on_event sink：服务逐条把归一化动作回调给调用方（Runner）用于实时发布。best-effort。
EventSink = Callable[[dict[str, Any]], Awaitable[None]]


def _cap(value: Any, limit: int = _EVENT_FIELD_CAP) -> Any:
    """字符串超长则截断并加可见标记；非字符串原样返回。

    输出长度严格 ``≤ limit``（标记预算从 head 中扣除），使返回值可安全写入定长列
    （如 String(255) 的 title），避免溢出。
    """
    if isinstance(value, str) and len(value) > limit:
        marker = f"…[truncated {len(value) - limit} chars]"
        head = max(0, limit - len(marker))
        return value[:head] + marker
    return value


def _coerce_content(content: Any) -> str:
    """把 tool_result / assistant 的 content 归一为字符串。

    真实 CLI 的 ``content`` 可能是字符串，或 ``[{type:"text",text:...}, ...]`` 块列表；
    后者提取并拼接 text，其它块降级为 JSON，确保审计完整不丢信息。
    """
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                text = block.get("text")
                if isinstance(text, str):
                    parts.append(text)
                else:
                    parts.append(json.dumps(block, ensure_ascii=False, default=str))
            else:
                parts.append(str(block))
        return "\n".join(parts)
    return str(content)


def _cap_json(obj: Any, limit: int = _EVENT_FIELD_CAP) -> Any:
    """对放入 payload 的任意对象做体积保护：序列化超 limit 时降级为截断预览。"""
    try:
        s = json.dumps(obj, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        s = str(obj)
    if len(s) > limit:
        return {"_truncated": True, "preview": s[:limit] + f"…[truncated {len(s) - limit} chars]"}
    return obj


def _tool_title(name: str | None, tool_input: Any) -> str | None:
    """为 tool_use 生成简短人读标题，如 ``Read src/app.py`` / ``Bash: pytest -q``。"""
    if not name:
        return None
    if not isinstance(tool_input, dict):
        return name
    for key in (
        "file_path",
        "path",
        "notebook_path",
        "command",
        "pattern",
        "query",
        "url",
        # TaskCreate/TaskUpdate 等工具的语义字段：subject（短标题）优先于 description（长描述）
        "subject",
        "description",
    ):
        val = tool_input.get(key)
        if isinstance(val, str) and val:
            # 上限 200：容纳绝大多数真实 workspace 路径/命令（"Read " + 200 < 255 DB 标题列上限）；
            # 仍保留头部截断——command/pattern/query/subject/description 的头部即主信息，路径则交由前端「路径感知」单行
            # 截断保留文件名尾部。
            short = val if len(val) <= 200 else val[:200] + "…"
            sep = ": " if key in ("command", "pattern", "query", "subject", "description") else " "
            return f"{name}{sep}{short}"
    return name


def _evt(
    event_type: str,
    payload: dict[str, Any],
    *,
    tool_name: str | None = None,
    title: str | None = None,
    cost_usd: float | None = None,
) -> dict[str, Any]:
    """构造一条归一化动作记录（不含 seq —— seq 由调用方按到达顺序定格）。"""
    return {"event_type": event_type, "tool_name": tool_name, "title": title, "payload": payload, "cost_usd": cost_usd}


def _normalize_stream_event(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """把单条 Claude Code stream-json 事件归一化为 0..N 条「动作」审计记录。

    防御式解析真实 CLI 形态（assistant / user 的 ``message.content`` 块列表），对未知或
    缺失结构一律降级保留，**绝不抛错或静默丢弃**。返回的 dict 含 event_type / tool_name /
    title / payload / cost_usd（不含 seq —— seq 由调用方按到达顺序定格）。
    """
    if not isinstance(raw, dict):
        return [_evt("unknown", {"raw": _cap_json(raw)})]

    etype = raw.get("type")

    # system/init：模型、cwd、可用工具、permission_mode、session_id
    if etype == _EVT_SYSTEM and raw.get("subtype") == "init":
        return [
            _evt(
                "system",
                {
                    "model": raw.get("model"),
                    "cwd": raw.get("cwd"),
                    "tools": raw.get("tools"),
                    "permission_mode": raw.get("permissionMode") or raw.get("permission_mode"),
                    "session_id": raw.get("session_id"),
                },
                title="init",
            )
        ]

    # system/api_retry：Claude Code 内部 API 重试（含认证失败 401、限流 429 等）
    if etype == _EVT_SYSTEM and raw.get("subtype") == "api_retry":
        return [
            _evt(
                "system_retry",
                {
                    "error": raw.get("error"),
                    "error_status": raw.get("error_status"),
                    "attempt": raw.get("attempt"),
                    "max_retries": raw.get("max_retries"),
                    "retry_delay_ms": raw.get("retry_delay_ms"),
                },
                title=f"api_retry (HTTP {raw.get('error_status', '?')})",
            )
        ]

    # system/compact_boundary：CC auto-compact 触发（上下文压缩边界）
    if etype == _EVT_SYSTEM and raw.get("subtype") == "compact_boundary":
        meta = raw.get("compact_metadata", {})
        return [
            _evt(
                "system_compact",
                {"trigger": meta.get("trigger"), "pre_tokens": meta.get("pre_tokens")},
                title=f"context compact ({meta.get('trigger', 'unknown')})",
            )
        ]

    # system/plan_review：NegentropyEngine Plan 自动审阅产出
    if etype == _EVT_SYSTEM and raw.get("subtype") == "plan_review":
        # 从 raw 中提取结构化审阅数据；若 raw 是原始审计事件则从顶层取，否则从 payload 嵌套取
        review_data = raw.get("review_result") or {}
        return [
            _evt(
                "plan_review",
                {
                    "verdict": review_data.get("verdict", "unknown"),
                    "score": review_data.get("score"),
                    "module_reviews": review_data.get("module_reviews", []),
                    "feedback": review_data.get("feedback", ""),
                    "reflection": review_data.get("reflection", ""),
                    "judge_prompt": review_data.get("judge_prompt"),
                    "judge_raw": review_data.get("judge_raw"),
                    # 兼容：保留原始数据供 fallback
                    "raw": _cap_json(raw),
                },
                title=f"plan_review ({review_data.get('verdict', 'unknown')}, score={review_data.get('score', '?')})",
            )
        ]

    # system/* 其余非 init/api_retry/compact_boundary/plan_review（task_started / task_completed 等）
    if etype == _EVT_SYSTEM:
        subtype = raw.get("subtype") or "unknown"
        return [_evt("system", {"raw": _cap_json(raw)}, title=subtype)]

    # assistant：message.content 块列表 → text / tool_use / thinking；兼容旧扁平 content
    if etype == _EVT_ASSISTANT:
        content = (raw.get("message") or {}).get("content", raw.get("content"))
        out: list[dict[str, Any]] = []
        if isinstance(content, list):
            for block in content:
                if not isinstance(block, dict):
                    out.append(_evt("assistant", {"text": _cap(str(block))}))
                    continue
                btype = block.get("type")
                if btype == "tool_use":
                    name = block.get("name")
                    out.append(
                        _evt(
                            "tool_use",
                            {"tool_id": block.get("id"), "input": _cap_json(block.get("input"))},
                            tool_name=name,
                            title=_tool_title(name, block.get("input")),
                        )
                    )
                elif btype == "text":
                    out.append(_evt("assistant", {"text": _cap(block.get("text", ""))}))
                elif btype == "thinking":
                    out.append(
                        _evt(
                            "assistant",
                            {"text": _cap(block.get("thinking") or block.get("text", ""))},
                            title="thinking",
                        )
                    )
                else:
                    out.append(_evt("assistant", {"raw": _cap_json(block)}))
        elif isinstance(content, str) and content.strip():
            out.append(_evt("assistant", {"text": _cap(content)}))
        return out

    # user：tool_result 块（工具结果回流）
    if etype == _EVT_USER:
        content = (raw.get("message") or {}).get("content", raw.get("content"))
        out = []
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == _EVT_TOOL_RESULT:
                    out.append(
                        _evt(
                            "tool_result",
                            {
                                "tool_use_id": block.get("tool_use_id"),
                                "output": _cap(_coerce_content(block.get("content"))),
                                "is_error": bool(block.get("is_error", False)),
                            },
                        )
                    )
        return out

    # result：最终产出 + 成本 / 轮数 / usage
    if etype == _EVT_RESULT:
        res = raw.get("result")
        res_str = res if isinstance(res, str) else json.dumps(res, ensure_ascii=False, default=str)
        return [
            _evt(
                "result",
                {
                    "result": _cap(res_str),
                    "num_turns": raw.get("num_turns"),
                    "usage": raw.get("usage"),
                    "is_error": bool(raw.get("is_error", False)),
                },
                title=raw.get("subtype"),
                cost_usd=raw.get("total_cost_usd") or raw.get("cost_usd"),
            )
        ]

    # 未知 / 其它 type → 保留原始（截断），绝不丢弃
    return [_evt(str(etype or "unknown"), {"raw": _cap_json(raw)})]


async def _emit_events(
    raw: dict[str, Any],
    events_holder: list[dict[str, Any]] | None,
    on_event: EventSink | None,
    *,
    max_events: int | None = None,
) -> None:
    """归一化单条 raw 事件 → 定格 seq 累积进 events_holder（封顶）→ best-effort 实时回调。

    seq 在单迭代内单调递增（= 入 holder 时的下标），既供写回持久化，也随实时事件外溢，
    保证「实时 seq == 持久化 seq」，前端据此去重合并。
    """
    if events_holder is None:
        return
    from negentropy.config import settings

    cap = max_events or settings.routine.max_events_per_iter
    for evt in _normalize_stream_event(raw):
        if len(events_holder) >= cap:
            if events_holder and events_holder[-1].get("event_type") != "_truncated":
                events_holder.append(
                    {
                        "seq": len(events_holder),
                        "event_type": "_truncated",
                        "tool_name": None,
                        "title": f"动作数超过 {cap} 上限，后续动作未记录",
                        "payload": {},
                        "cost_usd": None,
                    }
                )
            return
        evt["seq"] = len(events_holder)
        events_holder.append(evt)
        if on_event is not None:
            with suppress(Exception):
                await on_event(evt)


# 子进程 stdout 读取：手动分块 + 抬高 StreamReader 缓冲上限，规避 asyncio readline() 默认
# 64KiB 上限导致的 LimitOverrunError（stream-json 单行可达数 MiB，如大 tool_result）。
_STREAM_READER_LIMIT = 16 * 1024 * 1024  # 16 MiB
_READ_CHUNK = 64 * 1024  # 每次读取块大小
_BUF_CAP = 32 * 1024 * 1024  # buf 上界（32 MiB），超出 warn 并清空防内存膨胀


class ClaudeCodeService:
    """封装 Claude Code CLI 调用。优先 claude-code-sdk，降级 CLI 子进程。"""

    _sdk_available: bool | None = None  # 延迟探测，模块级缓存

    @classmethod
    def _check_sdk(cls) -> bool:
        if cls._sdk_available is None:
            try:
                import claude_code_sdk  # noqa: F401

                cls._sdk_available = True
            except ImportError:
                cls._sdk_available = False
        return cls._sdk_available

    # ------------------------------------------------------------------
    # 子进程凭证注入（根因修复：headless Routine 子进程须出示真实 Anthropic 凭证）
    # ------------------------------------------------------------------

    @staticmethod
    def _credential_env(credential: str | None) -> dict[str, str | None]:
        """计算凭证对环境的「覆盖项」：值为 str → 设置；值为 None → 删除该键。

        - ``sk-ant-api…`` 前缀 → Console API Key，走 ``ANTHROPIC_API_KEY``（x-api-key）；
        - 否则（含 ``sk-ant-oat…`` 订阅 OAuth 令牌、其它）→ 走 ``ANTHROPIC_AUTH_TOKEN`` +
          ``CLAUDE_CODE_OAUTH_TOKEN``（Bearer）。
        - 删除「未选中」的另一类凭证键，消除 Claude Code 内 key/token 的优先级歧义。
        - **绝不触碰 ``ANTHROPIC_BASE_URL``**（须保持指向 coding-proxy 根 ``/v1/messages``）。

        注：``sk-ant-oat…`` OAuth 令牌与 ``sk-ant-api…`` Console Key 同享 ``sk-ant-`` 前缀但
        认证头不同，故须用 ``is_console_api_key`` 精确判别，不能用 ``sk-ant-`` 笼统前缀。

        ``credential`` 为空 → 返回空字典（不施加任何覆盖，等价继承父环境）。
        """
        if not credential:
            return {}
        if is_console_api_key(credential):
            return {
                "ANTHROPIC_API_KEY": credential,
                "ANTHROPIC_AUTH_TOKEN": None,
                "CLAUDE_CODE_OAUTH_TOKEN": None,
            }
        return {
            "ANTHROPIC_AUTH_TOKEN": credential,
            "CLAUDE_CODE_OAUTH_TOKEN": credential,
            "ANTHROPIC_API_KEY": None,
        }

    @staticmethod
    def _build_subprocess_env(
        credential: str | None,
        *,
        compact_threshold_pct: int | None = None,
    ) -> dict[str, str]:
        """构建子进程环境：``os.environ`` 副本叠加凭证覆盖（不就地修改 ``os.environ``）。

        基线为「``os.environ`` 副本剥离引擎自身 venv/uv 激活变量」（``inherited_env_without_engine_venv``）——
        CC 子进程在隔离 worktree（另一项目，自有 .venv）内运行，不应继承引擎的 ``VIRTUAL_ENV`` /
        ``UV_RUN_RECURSION_DEPTH``（ISSUE-120：物理隔离须延伸到 Python 环境）。叠加凭证覆盖后返回。
        ``compact_threshold_pct`` 注入 ``CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`` 控制 CC auto-compact
        触发时机（值越小压缩越早，预留更多 headroom；None=使用 CLI 默认值）。
        """
        env = inherited_env_without_engine_venv()
        for key, value in ClaudeCodeService._credential_env(credential).items():
            if value is None:
                env.pop(key, None)
            else:
                env[key] = value
        if compact_threshold_pct is not None:
            env["CLAUDE_AUTOCOMPACT_PCT_OVERRIDE"] = str(compact_threshold_pct)
        return env

    # ------------------------------------------------------------------
    # 凭证直连验证（绕过 coding-proxy，检出无效 Anthropic API Key）
    # ------------------------------------------------------------------

    @staticmethod
    async def _verify_anthropic_credential_direct(credential: str) -> dict[str, Any] | None:
        """直连 ``api.anthropic.com`` 验证 Console API Key（``sk-ant-api…``）有效性（绕过 coding-proxy）。

        coding-proxy 主 tier (zhipu) 用自有 key 完全忽略客户端 ``x-api-key``——
        Test Connection 经 proxy 的 prompt 测试永远无法检出无效/过期/吊销的 Console API Key。
        本方法绕过 proxy 发送最小请求（haiku, max_tokens=1），仅验证 key 是否通过认证层。

        **仅适用于 Console API Key**：调用方须先以 ``is_console_api_key`` 过滤。
        ``sk-ant-oat…`` 订阅 OAuth 令牌不能经此直连验证——Anthropic 已禁第三方 OAuth 直连
        （x-api-key 报 invalid、Bearer 报 not supported），令牌仅在 Claude Code CLI 内部有效，
        故对其跳过直连、降级走 coding-proxy 的 prompt 测试。

        Returns:
            ``None`` = 验证通过（或非认证类错误）；``dict`` = 凭证无效，应立即返回给前端。
        """
        import httpx

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": credential,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-haiku-4-5-20251001",
                        "max_tokens": 1,
                        "messages": [{"role": "user", "content": "ok"}],
                    },
                )
                if resp.status_code == 401:
                    body = resp.json()
                    msg = body.get("error", {}).get("message", "invalid x-api-key")
                    return {
                        "success": False,
                        "message": f"Anthropic API Key 无效：{msg}（直连 api.anthropic.com 验证）",
                        "detail": "Key 被远程 API 拒绝，请检查是否过期/吊销/权限不足。",
                    }
                # 200 / 400 / 404 / 429 等都说明 key 通过了认证层（非 401 即视为有效）。
                return None
        except Exception as exc:
            logger.warning("anthropic_credential_direct_verify_error", error=str(exc))
            return None  # 网络问题不阻断后续 proxy 测试

    @staticmethod
    async def invoke(
        prompt: str,
        config: ClaudeCodeConfig,
        abort_event: asyncio.Event | None = None,
        on_event: EventSink | None = None,
    ) -> ClaudeCodeResult:
        """调用 Claude Code 并等待完整结果。

        用于 ADK Tool（tool call 内等待）和 Scheduler Handler。

        ``on_event``：可选「全过程」动作回调，服务每解析出一个归一化动作即 best-effort
        回调一次（供 Runner 实时发布 SSE）。无论成功 / 超时 / 取消 / 出错，已捕获的动作
        都会回带到 ``ClaudeCodeResult.events``（含 seq），供写回持久化。
        """
        t0 = time.monotonic()
        # 可变容器：内部协程一旦从 stream 起始 init 事件解析出 session_id 即写入，
        # 使超时/取消（wait_for 丢弃内部局部结果）路径仍能回带 session_id，让下一迭代续接。
        session_holder: dict[str, str | None] = {"session_id": None}
        # 同理：动作事件外溢容器，超时/取消/出错路径回带已捕获的部分事件流。
        events_holder: list[dict[str, Any]] = []
        try:
            if ClaudeCodeService._check_sdk():
                coro = ClaudeCodeService._invoke_sdk(
                    prompt, config, abort_event, session_holder, events_holder, on_event
                )
            else:
                coro = ClaudeCodeService._invoke_cli(
                    prompt, config, abort_event, session_holder, events_holder, on_event
                )
            result = await asyncio.wait_for(coro, timeout=config.timeout_seconds)
            result.events = events_holder
            elapsed = time.monotonic() - t0
            logger.info(
                "claude_code_invoke_done",
                status=result.status,
                elapsed_s=round(elapsed, 2),
                turns=result.turn_count,
                cost=result.cost_usd,
                events=len(events_holder),
                sdk=ClaudeCodeService._sdk_available,
            )
            return result
        except asyncio.CancelledError:
            return ClaudeCodeResult(
                status="error",
                summary="",
                session_id=session_holder.get("session_id"),
                error="cancelled",
                events=list(events_holder),
            )
        except TimeoutError:
            sid = session_holder.get("session_id")
            logger.warning("claude_code_invoke_timeout", timeout=config.timeout_seconds, session_id=sid)
            return ClaudeCodeResult(
                status="timeout",
                summary="",
                session_id=sid,
                error=f"exceeded timeout ({config.timeout_seconds}s)",
                events=list(events_holder),
            )
        except Exception as exc:
            logger.warning("claude_code_invoke_failed", error=str(exc))
            return ClaudeCodeResult(
                status="error",
                summary="",
                session_id=session_holder.get("session_id"),
                error=str(exc),
                events=list(events_holder),
            )

    # ------------------------------------------------------------------
    # SDK 路径
    # ------------------------------------------------------------------

    @staticmethod
    async def _invoke_sdk(
        prompt: str,
        config: ClaudeCodeConfig,
        abort_event: asyncio.Event | None,
        session_holder: dict[str, str | None] | None = None,
        events_holder: list[dict[str, Any]] | None = None,
        on_event: EventSink | None = None,
    ) -> ClaudeCodeResult:
        import claude_code_sdk

        options = claude_code_sdk.ClaudeCodeOptions(
            system_prompt=config.system_prompt,
            allowed_tools=config.get_effective_allowed_tools(),
            max_turns=config.max_turns,
            permission_mode=config.effective_permission_mode(),
            cwd=config.cwd,
        )
        # MCP 服务器配置：SDK 直接接受 dict 格式（{name: config}）。
        if config.mcp_config:
            options.mcp_servers = config.mcp_config
        # 明确禁止的工具：即使 allowed_tools 包含也不可调用。
        if config.disallowed_tools:
            options.disallowed_tools = config.disallowed_tools
        if config.resume_session_id:
            options.resume = config.resume_session_id
        if config.model:
            options.model = config.model
        # 额外只读源目录（镜像 CLI --add-dir）。新版 SDK 暴露 ``add_dirs``（list[str | Path]）；
        # 旧版无该字段时仅告警——CLI 才是当前已装且权威的执行路径。
        if config.add_dirs:
            if hasattr(options, "add_dirs"):
                options.add_dirs = list(config.add_dirs)
            else:
                logger.warning(
                    "claude_code_sdk_add_dirs_unsupported",
                    reason="ClaudeCodeOptions has no 'add_dirs'; CLI path authoritative",
                )
        # settings.json（承载只读 deny 规则）；新版 SDK 暴露 ``settings``。
        if config.settings and hasattr(options, "settings"):
            options.settings = config.settings
        # 镜像 CLI 路径：注入真实 Anthropic 凭证。优先经 SDK 的 ``options.env``（避免全局 os.environ
        # 突变带来的并发不安全）；旧版 SDK 无该字段时仅告警——CLI 才是当前已装且权威的执行路径。
        if config.credential:
            if hasattr(options, "env"):
                options.env = ClaudeCodeService._build_subprocess_env(config.credential)
            else:
                logger.warning(
                    "claude_code_sdk_credential_inject_unsupported",
                    reason="ClaudeCodeOptions has no 'env' field; credential not injected on SDK path",
                )

        result_text = ""
        session_id = None
        cost = 0.0
        turns = 0
        error_text = None

        async for msg in claude_code_sdk.query(prompt=prompt, options=options):
            # ResultMessage
            if hasattr(msg, "result") and msg.result:
                result_text = msg.result
            if hasattr(msg, "session_id") and msg.session_id:
                session_id = msg.session_id
                if session_holder is not None:
                    session_holder["session_id"] = session_id
            # claude-code-sdk ResultMessage 暴露 ``total_cost_usd``；兼容旧字段 ``cost_usd``。
            cost_val = getattr(msg, "total_cost_usd", None) or getattr(msg, "cost_usd", None)
            if cost_val:
                cost = cost_val
            if hasattr(msg, "num_turns") and msg.num_turns:
                turns = msg.num_turns
            if hasattr(msg, "is_error") and msg.is_error:
                error_text = result_text or "SDK returned error"

            if abort_event and abort_event.is_set():
                break

        # SDK 路径仅捕获最终 result 作为审计事件——中间动作的 SDK 消息结构与 stream-json
        # 差异较大，不做逐块归一化；CLI 路径才是「全过程」动作捕获的权威实现（当前未装 SDK）。
        await _emit_events(
            {
                "type": _EVT_RESULT,
                "result": result_text,
                "total_cost_usd": cost,
                "num_turns": turns,
                "is_error": bool(error_text),
            },
            events_holder,
            on_event,
            max_events=config.max_events_per_iter,
        )

        status = "error" if error_text else "success"
        # 错误分类（机制层）：SDK 路径用 is_error + result 文本判定（returncode 以 1 代指错误）。
        error_kind = _classify_result_error({"is_error": True, "result": result_text}, 1) if error_text else None
        return ClaudeCodeResult(
            status=status,
            error=error_text,
            summary=result_text[:_SUMMARY_MAX_LEN],
            session_id=session_id,
            cost_usd=cost,
            turn_count=turns,
            error_kind=error_kind,
        )

    # ------------------------------------------------------------------
    # CLI 子进程路径（降级）
    # ------------------------------------------------------------------

    @staticmethod
    async def _invoke_cli(
        prompt: str,
        config: ClaudeCodeConfig,
        abort_event: asyncio.Event | None,
        session_holder: dict[str, str | None] | None = None,
        events_holder: list[dict[str, Any]] | None = None,
        on_event: EventSink | None = None,
    ) -> ClaudeCodeResult:
        # ---- 交互模式路由：启用时走双向 stdin/stdout 路径 ----
        if config.interactive:
            return await ClaudeCodeService._invoke_cli_interactive(
                prompt,
                config,
                abort_event,
                session_holder,
                events_holder,
                on_event,
            )

        # ---- 预检：cwd 目录必须存在 ----
        if config.cwd and not os.path.isdir(config.cwd):
            return ClaudeCodeResult(
                status="error",
                summary="",
                error=f"working directory does not exist: '{config.cwd}'",
            )

        # ---- 预检：CLI 二进制必须可达 ----
        cli_resolved = shutil.which(config.cli_path)
        if not cli_resolved:
            hint = (
                f"resolved via PATH — ensure '{config.cli_path}' is on PATH "
                f"or set an absolute path in Interface / Tools / Claude Code config"
                if "/" not in config.cli_path
                else f"file does not exist: '{config.cli_path}'"
            )
            return ClaudeCodeResult(
                status="error",
                summary="",
                error=f"claude CLI not found: {hint}",
            )

        # 用 resolved 绝对路径替代裸名，消除 PATH 依赖
        config = ClaudeCodeConfig(
            cli_path=cli_resolved,
            model=config.model,
            system_prompt=config.system_prompt,
            allowed_tools=config.allowed_tools,
            disallowed_tools=config.disallowed_tools,
            cwd=config.cwd,
            max_turns=config.max_turns,
            timeout_seconds=config.timeout_seconds,
            permission_mode=config.permission_mode,
            mcp_config=config.mcp_config,
            resume_session_id=config.resume_session_id,
            credential=config.credential,  # 必须透传：否则注入凭证在此重建处被静默丢弃 → 退回 401
            compact_threshold_pct=config.compact_threshold_pct,
            add_dirs=config.add_dirs,  # 必须透传：否则 --add-dir 在此重建处被静默丢弃 → CC 读不到源码
            settings=config.settings,  # 必须透传：否则只读 deny 规则被静默丢弃 → 源码可写
        )

        args = ClaudeCodeService._build_cli_args(prompt, config)
        evt_max = config.max_events_per_iter  # per-routine 覆盖或 None（→ 全局默认）

        try:
            proc = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=config.cwd,
                # 注入真实 Anthropic 凭证到子进程环境（根因修复）。无凭证时等价继承父环境。
                env=ClaudeCodeService._build_subprocess_env(
                    config.credential, compact_threshold_pct=config.compact_threshold_pct
                ),
                limit=_STREAM_READER_LIMIT,  # 抬高 StreamReader 缓冲（兜底；主防线为手动分块读取）
            )
        except FileNotFoundError:
            return ClaudeCodeResult(
                status="error",
                summary="",
                error=f"claude CLI not found at '{config.cli_path}' (resolved: '{cli_resolved}')",
            )

        result_text = ""
        session_id = None
        cost = 0.0
        turns = 0
        last_result_event: dict[str, Any] | None = None

        try:
            async for event in ClaudeCodeService._iter_json_events(proc.stdout, abort_event):
                evt_type = event.get("type")
                if evt_type == _EVT_SYSTEM and event.get("subtype") == "init":
                    # stream 起始事件即携带 session_id：尽早捕获并外溢到 holder，
                    # 使超时/取消路径仍能回带 session_id（打断死亡螺旋）。
                    sid = event.get("session_id")
                    if sid:
                        session_id = sid
                        if session_holder is not None:
                            session_holder["session_id"] = sid
                elif evt_type == _EVT_RESULT:
                    # 保留原始 result 事件（含 is_error/subtype/result）供退出后错误分类。
                    last_result_event = event
                    result_text = event.get("result", "") or result_text
                    if event.get("session_id"):
                        session_id = event.get("session_id")
                        if session_holder is not None:
                            session_holder["session_id"] = session_id
                    # claude CLI 的 result 事件字段为 ``total_cost_usd``；兼容旧字段 ``cost_usd``。
                    cost = event.get("total_cost_usd") or event.get("cost_usd") or 0.0
                    turns = event.get("num_turns", 0)
                elif evt_type == _EVT_ASSISTANT and not result_text:
                    # 回退：result 事件缺席时，从 assistant 的 message.content **文本块**兜底取摘要。
                    # （历史实现误读扁平 event["content"]，对真实 CLI 恒为空——此处修复为读 message.content。）
                    blocks = (event.get("message") or {}).get("content")
                    if isinstance(blocks, list):
                        text = "\n".join(
                            b.get("text", "") for b in blocks if isinstance(b, dict) and b.get("type") == "text"
                        ).strip()
                    elif isinstance(blocks, str):
                        text = blocks.strip()
                    else:
                        text = ""
                    if text:
                        result_text = text

                # 「全过程」动作级捕获 + 实时回调（best-effort；suppress 异常，绝不影响主执行）
                await _emit_events(event, events_holder, on_event, max_events=evt_max)

                if abort_event and abort_event.is_set():
                    proc.terminate()
                    break
        except asyncio.CancelledError:
            proc.terminate()
            await proc.wait()
            raise
        finally:
            if proc.returncode is None:
                proc.terminate()
                await proc.wait()

        # 进程已退出，读取 stderr
        stderr_text = ""
        if proc.stderr:
            stderr_bytes = await proc.stderr.read()
            stderr_text = stderr_bytes.decode("utf-8", errors="replace").strip()

        # 干净成功 result 优先于退出码：当已捕获 subtype=success 且非 is_error 的 result 事件时判
        # success。交互式 stream-json 路径下 CLI 产出 result 后不自退、等更多 stdin，我方主动闭合
        # stdin 触发退出；若它未在优雅窗口内退出，finally 会 SIGTERM 之（rc=143/-15）——该退出码是
        # **我方拆解**的产物而非真实失败，否则已成功产出的 PLAN/IMPLEMENT 迭代会被误标 error、连累
        # Judge 评分（ISSUE-113）。非交互路径 rc 通常已为 0，此分支为防御性等价、消除两路径漂移。
        _res = last_result_event or {}
        _clean_success = _res.get("subtype") == "success" and not _res.get("is_error")
        status = "success" if (proc.returncode == 0 or _clean_success) else "error"
        error_msg = None
        if status == "error":
            parts = [f"CLI exited with code {proc.returncode}"]
            if stderr_text:
                parts.append(f"stderr: {stderr_text[:500]}")
            if not result_text and not stderr_text:
                parts.append("no output captured")
            error_msg = "; ".join(parts)

        # 错误分类（机制层）：识别"会话上下文耗尽"等可恢复错误，供策略层（Runner）据此自愈。
        error_kind = _classify_result_error(last_result_event, proc.returncode, stderr_text=stderr_text)

        return ClaudeCodeResult(
            status=status,
            summary=result_text[:_SUMMARY_MAX_LEN],
            session_id=session_id,
            cost_usd=cost,
            turn_count=turns,
            error=error_msg,
            error_kind=error_kind,
        )

    @staticmethod
    async def _iter_json_events(stdout, abort_event: asyncio.Event | None):
        """按块读取 stdout 并自行按 ``\\n`` 切分，逐条 yield 解析后的 stream-json 事件。

        刻意**不使用** ``readline()`` / ``async for line``：超长单行（stream-json 的大
        tool_result 可达数 MiB）只会累积进本地缓冲，绝不触发 asyncio 的 ``LimitOverrunError``
        （即历史故障「Separator is found, but chunk is longer than limit」的根因）。
        """
        buf = bytearray()
        while True:
            if abort_event and abort_event.is_set():
                return
            chunk = await stdout.read(_READ_CHUNK)
            if not chunk:  # EOF
                break
            buf.extend(chunk)
            if len(buf) > _BUF_CAP:
                logger.warning("claude_code_stream_buf_overflow", buf_len=len(buf), cap=_BUF_CAP)
                buf.clear()
            while True:
                nl = buf.find(b"\n")
                if nl < 0:
                    break
                raw = bytes(buf[:nl])
                del buf[: nl + 1]
                line = raw.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue
        # 冲洗无换行结尾的残余
        tail = bytes(buf).decode("utf-8", errors="replace").strip()
        if tail:
            try:
                yield json.loads(tail)
            except json.JSONDecodeError:
                pass

    @staticmethod
    def _build_cli_args(prompt: str, config: ClaudeCodeConfig) -> list[str]:
        args = [
            config.cli_path,
            "-p",
            prompt,
            "--output-format",
            "stream-json",
            "--verbose",
            "--max-turns",
            str(config.max_turns),
            "--permission-mode",
            config.effective_permission_mode(),
        ]
        if config.resume_session_id:
            args += ["--resume", config.resume_session_id]
        if config.model:
            args += ["--model", config.model]
        if config.system_prompt:
            args += ["--system-prompt", config.system_prompt]
        # NOTE: cwd 通过 create_subprocess_exec(..., cwd=) 设置，不传 CLI 参数
        # （claude CLI 不支持 --cwd 选项，传了会报 unknown option 错误）
        if config.allowed_tools:
            args += ["--allowed-tools", ",".join(config.allowed_tools)]
        # 明确禁止的工具列表。
        if config.disallowed_tools:
            args += ["--disallowed-tools", ",".join(config.disallowed_tools)]
        # 额外只读源目录：CLI 接受重复 ``--add-dir <path>``（逐目录，不接受逗号合并形式）。
        # 授予 CC 读取 worktree 之外的源项目（如待复刻的 Go 源码）；只读性由下方 --settings 锁定。
        if config.add_dirs:
            for d in config.add_dirs:
                args += ["--add-dir", d]
        # settings.json（JSON 字符串）：承载 permissions.deny，把 add_dirs 物理锁为只读。
        if config.settings:
            args += ["--settings", config.settings]
        # MCP 服务器配置：CLI --mcp-config 接受 JSON string 或文件路径。
        # 使用 {"mcpServers": {...}} 封装格式（与 .mcp.json 文件格式一致）。
        if config.mcp_config:
            args += ["--mcp-config", json.dumps({"mcpServers": config.mcp_config})]
        # 双向交互模式：允许通过 stdin 实时注入 tool_result 等结构化消息。
        # 用于 Routine 执行中 Engine 自动应答 AskUserQuestion。
        if config.interactive:
            args += ["--input-format", "stream-json"]
        return args

    # ------------------------------------------------------------------
    # 交互式工具自动应答（AskUserQuestion 拦截）
    # ------------------------------------------------------------------

    _ASK_USER_TOOL = "AskUserQuestion"
    _EXIT_PLAN_TOOL = "ExitPlanMode"
    _AUTO_ANSWER_TASK_KEY = "routine.auto_answer"
    _FALLBACK_ANSWER = "请基于任务目标和验收标准自行做出最佳判断，无需等待确认即可继续。"

    # Plan Review 问题识别关键词（用于区分「提交 Plan 等待审阅」vs「结构化选项问题」）
    _PLAN_REVIEW_KEYWORDS = frozenset({"审阅", "review", "plan", "方案", "计划", "approve", "refine", "完善"})

    @staticmethod
    def _is_plan_review_question(questions: list[dict]) -> bool:
        """判断 AskUserQuestion 是否属于「提交 Plan 等待审阅」。

        判据：
        1. 所有 question 都没有明确的 options → 开放式问答，视为 Plan 提交
        2. 首个 question 的 question 文本命中 _PLAN_REVIEW_KEYWORDS → 明确的审阅请求
        3. 否则 → 结构化选项问题，应走 generic auto-answer
        """
        if not questions:
            return True  # 无问题内容，默认走 plan review
        # 判据 1：没有任何 question 带 options
        has_any_options = any(
            isinstance(q.get("options"), list) and len(q["options"]) > 0 for q in questions if isinstance(q, dict)
        )
        if not has_any_options:
            return True  # 开放式问题 → Plan 提交
        # 判据 2：首个 question 文本命中审阅关键词
        first_q = questions[0] if isinstance(questions[0], dict) else {}
        q_text = (first_q.get("question", "") or "").lower()
        if any(kw in q_text for kw in ClaudeCodeService._PLAN_REVIEW_KEYWORDS):
            return True
        return False

    @staticmethod
    def _build_stdin_user_prompt(prompt: str) -> str:
        """构建写入 stdin 的初始 user prompt 消息行（``--input-format stream-json``）。

        关键：stream-json 输入模式下 CLI **忽略** ``-p <prompt>`` 命令行参数的取值，改从 stdin
        读取首条 ``user`` 消息作为任务输入。若不经 stdin 投喂 prompt，CLI 会永久阻塞等待 stdin，
        既不产出任何事件也不退出（直到外层超时或被 kill）——这是交互模式迭代「0 turns 挂起」的根因。

        协议格式：``{"type":"user","message":{"role":"user","content":"<prompt>"}}`` + ``\\n``
        """
        msg = {
            "type": "user",
            "message": {"role": "user", "content": prompt},
        }
        return json.dumps(msg, ensure_ascii=False) + "\n"

    @staticmethod
    def _build_stdin_tool_result(tool_use_id: str, content: str) -> str:
        """构建写入 stdin 的 stream-json tool_result 消息行。

        协议格式：``{"type":"user","message":{"role":"user","content":[tool_result block]}}`` + ``\\n``
        """
        msg = {
            "type": "user",
            "message": {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "content": content,
                    }
                ],
            },
        }
        return json.dumps(msg, ensure_ascii=False) + "\n"

    @staticmethod
    async def _auto_answer_question(
        questions: list[dict],
        context: dict[str, Any],
        *,
        model_override: str | None = None,
        timeout: float = 30.0,
    ) -> str:
        """调用 Engine LLM 生成 AskUserQuestion 的自动应答。

        基于 Routine 上下文（goal / acceptance_criteria）生成简洁确定性回答；
        当问题包含选项时，LLM 优先从选项中选择；失败时返回 fallback 硬编码回答。

        Returns:
            纯文本应答（非 JSON 包裹），CC 的 AskUserQuestion 工具可直接解析。
        """
        try:
            import litellm

            from negentropy.engine.utils.model_config import resolve_model_config_async

            goal = context.get("goal", "（未提供）")
            criteria = context.get("acceptance_criteria", "（未提供）")
            prompt = context.get("prompt", "（未提供）")

            # 构造问题文本（含选项信息）
            q_lines: list[str] = []
            for i, q in enumerate(questions):
                q_text = q.get("question", str(q)) if isinstance(q, dict) else str(q)
                line = f"  Q{i + 1}: {q_text}"
                opts = q.get("options") if isinstance(q, dict) else None
                if isinstance(opts, list) and opts:
                    opt_labels = []
                    for o in opts:
                        if isinstance(o, dict):
                            opt_labels.append(o.get("label", str(o)))
                        else:
                            opt_labels.append(str(o))
                    line += f"\n    选项: {', '.join(opt_labels)}"
                q_lines.append(line)
            q_text = "\n".join(q_lines)

            judge_prompt = (
                "你是一个自动化助手，正在代表任务负责人回答执行者提出的澄清问题。\n"
                "请基于下方任务上下文，给出简洁、确定性的回答。不要反问，不要模棱两可。\n\n"
                "**重要**：如果问题提供了选项，你必须从选项中选择最合适的（返回选项的 label 文本），不要自创答案。\n\n"
                f"# 任务目标\n{goal}\n\n"
                f"# 验收标准\n{criteria}\n\n"
                f"# 发送给执行者的原始 Prompt\n{prompt[:2000]}\n\n"
                f"# 执行者提出的问题\n{q_text}\n\n"
                '请以 JSON 格式回答：{"answers": ["answer1", "answer2", ...]}\n'
                "每个问题对应一个回答，保持简洁（每个回答不超过 100 字）。"
                "如果问题有选项，回答必须是选项之一的 label 原文。"
            )

            model, model_kwargs = await resolve_model_config_async(
                ClaudeCodeService._AUTO_ANSWER_TASK_KEY,
                explicit_model=model_override,
            )
            safe_kwargs = {
                k: v
                for k, v in model_kwargs.items()
                if k not in ("model", "messages", "temperature", "response_format")
            }

            response = await asyncio.wait_for(
                litellm.acompletion(
                    model=model,
                    messages=[{"role": "user", "content": judge_prompt}],
                    temperature=0.0,
                    response_format={"type": "json_object"},
                    **safe_kwargs,
                ),
                timeout=timeout,
            )
            content = response.choices[0].message.content or ""
            # 解析 JSON 提取 answers 并返回纯文本
            parsed = json.loads(content)
            if "answers" in parsed and isinstance(parsed["answers"], list):
                return "\n".join(str(a) for a in parsed["answers"])
            return content  # 非 answers 格式也返回纯文本
        except Exception as exc:
            logger.warning(
                "claude_code_auto_answer_failed",
                error=str(exc),
                fallback=True,
            )
            return ClaudeCodeService._FALLBACK_ANSWER

    @staticmethod
    async def _plan_review_answer(
        questions: list[dict],
        context: dict[str, Any],
        *,
        plan_text: str = "",
        model_override: str | None = None,
        timeout: float = 60.0,
    ) -> tuple[str, dict[str, Any] | None]:
        """PLAN 阶段专用自动应答：调用 PlanReviewer 进行方案审阅，返回审阅结果。

        审阅结果作为 AskUserQuestion 的回答注入回 CC：
        - approve → CC 收到批准，退出 Plan 模式开始实施
        - refine → CC 收到完善要求，继续在 Plan 模式迭代

        Returns:
            (answer_text, review_result_dict) 元组。
            answer_text 为纯文本（非 JSON 包裹），CC 的 AskUserQuestion 工具可直接解析；
            review_result_dict 包含结构化审阅数据供审计事件使用；
            审阅失败时为 None。
        """
        try:
            from negentropy.engine.routine.plan_reviewer import PlanReviewer

            reviewer = PlanReviewer(explicit_model=model_override, timeout_seconds=int(timeout))
            result = await reviewer.review(
                goal=context.get("goal", "（未提供）"),
                acceptance_criteria=context.get("acceptance_criteria", "（未提供）"),
                plan_text=plan_text,
                reflections=context.get("reflections"),
            )

            if not result.ok:
                logger.warning("plan_review_failed_fallback", error=result.error)
                return (
                    "审阅服务暂时不可用，请按你的最佳判断继续完善方案。",
                    None,
                )

            # 构造结构化审阅数据供审计事件
            review_data = {
                "verdict": result.verdict,
                "score": result.score,
                "module_reviews": [
                    {"module": m.module, "status": m.status, "comment": m.comment} for m in result.module_reviews
                ],
                "feedback": result.feedback,
                "reflection": result.reflection,
                "judge_prompt": result.judge_prompt,
                "judge_raw": result.judge_raw,
            }

            # 审阅成功：构造回答
            if result.verdict == "approve":
                answer_text = f"Plan 已通过审阅（评分 {result.score}/100）。请退出 Plan 模式，开始实施。"
            else:
                module_feedback = ""
                if result.module_reviews:
                    items = []
                    for m in result.module_reviews:
                        icon = "✅" if m.status == "pass" else "⚠️" if m.status == "warn" else "❌"
                        items.append(f"{icon} {m.module}: {m.comment}")
                    module_feedback = "\n\n模块评审：\n" + "\n".join(items)

                answer_text = (
                    f"Plan 需要完善（评分 {result.score}/100）。\n\n"
                    f"反馈：{result.feedback or '请进一步完善方案细节。'}"
                    f"{module_feedback}"
                )

            logger.info(
                "plan_review_completed",
                verdict=result.verdict,
                score=result.score,
                modules=len(result.module_reviews),
            )
            return (
                answer_text,
                review_data,
            )

        except Exception as exc:
            logger.warning("plan_review_exception_fallback", error=str(exc))
            return (
                "审阅服务暂时不可用，请按你的最佳判断继续完善方案。",
                None,
            )

    @staticmethod
    async def _invoke_cli_interactive(
        prompt: str,
        config: ClaudeCodeConfig,
        abort_event: asyncio.Event | None,
        session_holder: dict[str, str | None] | None = None,
        events_holder: list[dict[str, Any]] | None = None,
        on_event: EventSink | None = None,
    ) -> ClaudeCodeResult:
        """交互式 CLI 调用：支持通过 stdin 自动应答 AskUserQuestion。

        并发设计：
        - Reader 协程：遍历 stdout 事件流，检测 AskUserQuestion tool_use → 自动应答 → 放入 Queue
        - Writer 协程：从 Queue 取消息写入 stdin，收到 None sentinel 后关闭
        - 死锁预防：Writer 仅在 tool_use 后写入（sparse），stdin buffer 不会满
        """
        # 复用预检逻辑
        if config.cwd and not os.path.isdir(config.cwd):
            return ClaudeCodeResult(
                status="error", summary="", error=f"working directory does not exist: '{config.cwd}'"
            )

        cli_resolved = shutil.which(config.cli_path)
        if not cli_resolved:
            hint = (
                f"resolved via PATH — ensure '{config.cli_path}' is on PATH"
                if "/" not in config.cli_path
                else f"file does not exist: '{config.cli_path}'"
            )
            return ClaudeCodeResult(status="error", summary="", error=f"claude CLI not found: {hint}")

        config = ClaudeCodeConfig(
            cli_path=cli_resolved,
            model=config.model,
            system_prompt=config.system_prompt,
            allowed_tools=config.allowed_tools,
            disallowed_tools=config.disallowed_tools,
            cwd=config.cwd,
            max_turns=config.max_turns,
            timeout_seconds=config.timeout_seconds,
            permission_mode=config.permission_mode,
            mcp_config=config.mcp_config,
            resume_session_id=config.resume_session_id,
            credential=config.credential,
            interactive=config.interactive,
            auto_answer_context=config.auto_answer_context,
            compact_threshold_pct=config.compact_threshold_pct,
            add_dirs=config.add_dirs,  # 必须透传：否则 --add-dir 在交互式重建处被静默丢弃
            settings=config.settings,  # 必须透传：否则只读 deny 规则被静默丢弃
        )

        args = ClaudeCodeService._build_cli_args(prompt, config)

        try:
            proc = await asyncio.create_subprocess_exec(
                *args,
                stdin=asyncio.subprocess.PIPE,  # 双向通信核心
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=config.cwd,
                env=ClaudeCodeService._build_subprocess_env(
                    config.credential, compact_threshold_pct=config.compact_threshold_pct
                ),
                limit=_STREAM_READER_LIMIT,
            )
        except FileNotFoundError:
            return ClaudeCodeResult(
                status="error",
                summary="",
                error=f"claude CLI not found at '{config.cli_path}' (resolved: '{cli_resolved}')",
            )

        result_text = ""
        session_id = None
        cost = 0.0
        turns = 0
        last_result_event: dict[str, Any] | None = None
        write_queue: asyncio.Queue[str | None] = asyncio.Queue()
        auto_answer_count = 0

        # 从 config 或 settings 取上限；默认 5
        max_auto_answers = 5
        # per-routine 事件捕获上限或 None（→ _emit_events 读全局默认）
        evt_max = config.max_events_per_iter
        try:
            from negentropy.config import settings

            max_auto_answers = settings.routine.auto_answer_max_per_iteration
        except Exception:
            pass

        async def _reader() -> None:
            nonlocal result_text, session_id, cost, turns, auto_answer_count, last_result_event
            try:
                async for event in ClaudeCodeService._iter_json_events(proc.stdout, abort_event):
                    evt_type = event.get("type")

                    # 提取 session_id（尽早捕获，超时/取消路径仍可回带）
                    if evt_type == _EVT_SYSTEM and event.get("subtype") == "init":
                        sid = event.get("session_id")
                        if sid:
                            session_id = sid
                            if session_holder is not None:
                                session_holder["session_id"] = sid
                    elif evt_type == _EVT_RESULT:
                        # 保留原始 result 事件（含 is_error/subtype/result）供退出后错误分类。
                        last_result_event = event
                        result_text = event.get("result", "") or result_text
                        if event.get("session_id"):
                            session_id = event.get("session_id")
                            if session_holder is not None:
                                session_holder["session_id"] = session_id
                        cost = event.get("total_cost_usd") or event.get("cost_usd") or 0.0
                        turns = event.get("num_turns", 0)
                        # 关键：stream-json 输入模式下，CLI 产出 result 后**不会**自行退出，
                        # 而是保持 stdin 打开等待更多输入。须主动闭合 stdin 触发其干净退出，
                        # 否则进程挂起、stdout 无 EOF、reader 永不结束（三方循环死锁）。
                        # 先持久化本条 result 审计事件，再通知 writer 关闭 stdin 并跳出循环。
                        await _emit_events(event, events_holder, on_event, max_events=evt_max)
                        await write_queue.put(None)
                        break
                    elif evt_type == _EVT_ASSISTANT and not result_text:
                        blocks = (event.get("message") or {}).get("content")
                        if isinstance(blocks, list):
                            text = "\n".join(
                                b.get("text", "") for b in blocks if isinstance(b, dict) and b.get("type") == "text"
                            ).strip()
                        elif isinstance(blocks, str):
                            text = blocks.strip()
                        else:
                            text = ""
                        if text:
                            result_text = text

                    # 核心新增：检测 AskUserQuestion / ExitPlanMode tool_use → 自动应答
                    _skip_emit = False  # handler 手动发射后置 True，跳过底部 fallthrough
                    if evt_type == _EVT_ASSISTANT and auto_answer_count < max_auto_answers and proc.stdin is not None:
                        content_blocks = (event.get("message") or {}).get("content", [])
                        if isinstance(content_blocks, list):
                            for block in content_blocks:
                                if not (isinstance(block, dict) and block.get("type") == _EVT_TOOL_USE):
                                    continue
                                tool_name = block.get("name")
                                tool_use_id = block.get("id")

                                # ---- ExitPlanMode：自动批准退出 Plan 模式 ----
                                if tool_name == ClaudeCodeService._EXIT_PLAN_TOOL:
                                    auto_answer_count += 1
                                    answer = "Plan approved. You may exit plan mode now."
                                    msg = ClaudeCodeService._build_stdin_tool_result(tool_use_id, answer)
                                    await write_queue.put(msg)
                                    # 先发射原始事件，再发射审计事件（Fix 3：事件排序）
                                    await _emit_events(event, events_holder, on_event, max_events=evt_max)
                                    await _emit_events(
                                        {
                                            "type": "system",
                                            "subtype": "auto_answer",
                                            "tool_use_id": tool_use_id,
                                            "tool_name": tool_name,
                                            "answer_preview": answer[:500],
                                        },
                                        events_holder,
                                        on_event,
                                        max_events=evt_max,
                                    )
                                    logger.info(
                                        "claude_code_auto_answer_exit_plan",
                                        tool_use_id=tool_use_id,
                                        count=auto_answer_count,
                                    )
                                    _skip_emit = True
                                    continue  # 已手动发射原始事件，跳过末尾的统一发射

                                # ---- AskUserQuestion：智能路由 plan_review vs generic ----
                                if tool_name == ClaudeCodeService._ASK_USER_TOOL:
                                    tool_input = block.get("input", {})
                                    questions = tool_input.get("questions", [])
                                    if not questions:
                                        # 无 questions 字段，尝试把整个 input 当问题
                                        questions = [{"question": json.dumps(tool_input, ensure_ascii=False)}]

                                    ctx = config.auto_answer_context or {}
                                    plan_review_enabled = ctx.get("plan_review_enabled", False)
                                    plan_text = ctx.get("plan_summary") or result_text or ""

                                    # Fix 1：区分「Plan 提交审阅」vs「结构化选项问题」
                                    is_plan_submit = plan_review_enabled and ClaudeCodeService._is_plan_review_question(
                                        questions
                                    )
                                    audit_event: dict[str, Any] | None = None

                                    # ISSUE-123：PLAN 相位评审改由 PreToolUse 钩子同轮 deny+reason 回灌 CC
                                    # （headless 下 stdin tool_result 对 AskUserQuestion 无效）。此处不再内联
                                    # 评审/写 stdin（否则重复评审且干扰钩子已解析的工具）——仅发射原始事件供审计。
                                    if is_plan_submit and ctx.get("plan_review_via_hook"):
                                        await _emit_events(event, events_holder, on_event, max_events=evt_max)
                                        logger.info(
                                            "claude_code_plan_review_delegated_to_hook", tool_use_id=tool_use_id
                                        )
                                        _skip_emit = True
                                        continue

                                    if is_plan_submit:
                                        answer, review_data = await ClaudeCodeService._plan_review_answer(
                                            questions,
                                            ctx,
                                            plan_text=plan_text,
                                            model_override=ctx.get("plan_review_model"),
                                            timeout=ctx.get("plan_review_timeout", 60.0),
                                        )
                                        auto_answer_count += 1
                                        # 构造 plan_review 审计事件（稍后发射，Fix 3）
                                        audit_event = {
                                            "type": "system",
                                            "subtype": "plan_review",
                                            "tool_use_id": tool_use_id,
                                            "questions": _cap_json(questions),
                                            "answer_preview": answer[:500],
                                        }
                                        if review_data:
                                            audit_event["review_result"] = review_data
                                    else:
                                        answer = await ClaudeCodeService._auto_answer_question(
                                            questions,
                                            config.auto_answer_context or {},
                                            timeout=30.0,
                                        )
                                        auto_answer_count += 1
                                        # 构造 auto_answer 审计事件（稍后发射，Fix 3）
                                        audit_event = {
                                            "type": "system",
                                            "subtype": "auto_answer",
                                            "tool_use_id": tool_use_id,
                                            "questions": _cap_json(questions),
                                            "answer_preview": answer[:500],
                                        }

                                    msg = ClaudeCodeService._build_stdin_tool_result(tool_use_id, answer)
                                    await write_queue.put(msg)
                                    # Fix 3：先发射原始事件（AskUserQuestion tool_use），再发射审计事件
                                    await _emit_events(event, events_holder, on_event, max_events=evt_max)
                                    if audit_event:
                                        await _emit_events(audit_event, events_holder, on_event, max_events=evt_max)
                                    logger.info(
                                        "claude_code_auto_answer",
                                        tool_use_id=tool_use_id,
                                        answer_preview=answer[:100],
                                        count=auto_answer_count,
                                        is_plan_submit=is_plan_submit,
                                    )
                                    _skip_emit = True
                                    continue  # 已手动发射原始事件，跳过末尾的统一发射

                    # 审计事件捕获（未被 auto-answer 拦截的普通事件走此路径）
                    if not _skip_emit:
                        await _emit_events(event, events_holder, on_event, max_events=evt_max)

                    if abort_event and abort_event.is_set():
                        proc.terminate()
                        break
            except asyncio.CancelledError:
                proc.terminate()
                raise
            finally:
                # 通知 Writer 关闭 stdin
                await write_queue.put(None)

        async def _writer() -> None:
            """从 Queue 取消息写入 stdin；收到 None sentinel 后关闭。"""
            try:
                while True:
                    msg = await write_queue.get()
                    if msg is None:
                        break
                    if proc.stdin is None:
                        break
                    try:
                        proc.stdin.write(msg.encode("utf-8"))
                        await proc.stdin.drain()
                    except (BrokenPipeError, ConnectionResetError, OSError) as exc:
                        logger.warning("claude_code_stdin_write_failed", error=str(exc))
                        break
            finally:
                if proc.stdin is not None:
                    with suppress(Exception):
                        proc.stdin.close()
                        await proc.stdin.wait_closed()

        try:
            reader_task = asyncio.create_task(_reader(), name="cc-interactive-reader")
            writer_task = asyncio.create_task(_writer(), name="cc-interactive-writer")

            # 关键：先经 stdin 投喂初始 user prompt——stream-json 输入模式下 CLI 忽略 -p 参数，
            # 仅从 stdin 读取首条 user 消息作为任务输入。不投喂则 CLI 永久阻塞等待 stdin。
            await write_queue.put(ClaudeCodeService._build_stdin_user_prompt(prompt))

            # 超时由外层 invoke() 的 asyncio.wait_for 统一管控，
            # 与原 _invoke_cli 非交互路径一致，避免双重超时干扰。
            await asyncio.gather(reader_task, writer_task)

            # reader 收到 result 后已闭合 stdin，CLI 随即干净退出（rc=0）。给予短暂优雅窗口
            # 等其自然收尾，避免 finally 抢先 terminate() 误判为 SIGTERM(143) 而把成功迭代标记为
            # error。窗口内未退出（异常滞留）才落到 finally 的强制 terminate。
            if proc.returncode is None:
                with suppress(TimeoutError):
                    await asyncio.wait_for(proc.wait(), timeout=10.0)
        except asyncio.CancelledError:
            proc.terminate()
            await proc.wait()
            raise
        finally:
            if proc.returncode is None:
                proc.terminate()
                await proc.wait()

        # 进程已退出，读取 stderr
        stderr_text = ""
        if proc.stderr:
            stderr_bytes = await proc.stderr.read()
            stderr_text = stderr_bytes.decode("utf-8", errors="replace").strip()

        # 干净成功 result 优先于退出码：当已捕获 subtype=success 且非 is_error 的 result 事件时判
        # success。交互式 stream-json 路径下 CLI 产出 result 后不自退、等更多 stdin，我方主动闭合
        # stdin 触发退出；若它未在优雅窗口内退出，finally 会 SIGTERM 之（rc=143/-15）——该退出码是
        # **我方拆解**的产物而非真实失败，否则已成功产出的 PLAN/IMPLEMENT 迭代会被误标 error、连累
        # Judge 评分（ISSUE-113）。非交互路径 rc 通常已为 0，此分支为防御性等价、消除两路径漂移。
        _res = last_result_event or {}
        _clean_success = _res.get("subtype") == "success" and not _res.get("is_error")
        status = "success" if (proc.returncode == 0 or _clean_success) else "error"
        error_msg = None
        if status == "error":
            parts = [f"CLI exited with code {proc.returncode}"]
            if stderr_text:
                parts.append(f"stderr: {stderr_text[:500]}")
            if not result_text and not stderr_text:
                parts.append("no output captured")
            error_msg = "; ".join(parts)

        # 错误分类（机制层）：与非交互路径共用同一纯函数，杜绝两路径逻辑漂移。
        error_kind = _classify_result_error(last_result_event, proc.returncode, stderr_text=stderr_text)

        return ClaudeCodeResult(
            status=status,
            summary=result_text[:2000] if result_text else "",
            session_id=session_id,
            cost_usd=cost,
            turn_count=turns,
            error=error_msg,
            error_kind=error_kind,
            events=list(events_holder) if events_holder else [],
        )

    # ------------------------------------------------------------------
    # 连通性测试
    # ------------------------------------------------------------------

    @staticmethod
    async def test_connection(config: ClaudeCodeConfig) -> dict[str, Any]:
        """执行 claude --version + 简单 prompt 验证连通性。"""
        cli = config.cli_path or "claude"

        if not shutil.which(cli):
            return {
                "success": False,
                "message": f"claude CLI not found in PATH (tried '{cli}')",
            }

        # 1. 获取版本
        try:
            proc = await asyncio.create_subprocess_exec(
                cli,
                "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await asyncio.wait_for(proc.wait(), timeout=10.0)
            version_out = (await proc.stdout.read()).decode().strip()
        except Exception as exc:
            return {"success": False, "message": f"claude --version failed: {exc}"}

        # 1.5 直连验证 Console API Key（仅 sk-ant-api… 类型）
        #   coding-proxy 主 tier (zhipu) 用自有 key，不验证客户端凭证 → Test Connection 通过 ≠ 凭证有效。
        #   此步绕过 proxy 直连 api.anthropic.com，检出无效/过期/吊销的 Console Key。
        #   ``sk-ant-oat…`` 订阅 OAuth 令牌不走此路（Anthropic 已禁第三方 OAuth 直连，必误报）——
        #   跳过直连、降级走下方经 proxy 的 prompt 测试（zhipu 主 tier 可正常应答）。
        if is_console_api_key(config.credential):
            cred_error = await ClaudeCodeService._verify_anthropic_credential_direct(config.credential)
            if cred_error:
                return cred_error

        # 2. 简单 prompt 测试（经 coding-proxy）
        t0 = time.monotonic()
        test_result = await ClaudeCodeService.invoke(
            "respond with exactly: OK",
            ClaudeCodeConfig(
                cli_path=cli,
                max_turns=1,
                timeout_seconds=300.0,
                credential=config.credential,  # 透传凭证：Test Connection 亦须出示真实凭证
            ),
        )
        latency = round((time.monotonic() - t0) * 1000)

        if test_result.status == "success":
            return {
                "success": True,
                "message": f"Claude Code connected (version: {version_out})",
                "version": version_out,
                "latency_ms": latency,
            }
        error_detail = test_result.error or "unknown error (no error output captured)"
        return {
            "success": False,
            "message": f"Claude Code prompt test failed: {error_detail}",
            "version": version_out,
        }
