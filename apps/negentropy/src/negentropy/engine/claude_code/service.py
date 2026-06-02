"""ClaudeCodeService — 封装 Claude Code CLI / SDK 调用。"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import time
from collections.abc import Awaitable, Callable
from contextlib import suppress
from typing import Any

from negentropy.logging import get_logger

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

# 「全过程」动作级审计：单字段截断上限 + 单迭代事件条数上限（防 DB / SSE 膨胀）。
_EVENT_FIELD_CAP = 16 * 1024  # 16 KiB / 字段
_MAX_EVENTS_PER_ITER = 1000  # 单迭代至多捕获的动作事件数

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
    for key in ("file_path", "path", "notebook_path", "command", "pattern", "query", "url"):
        val = tool_input.get(key)
        if isinstance(val, str) and val:
            # 上限 200：容纳绝大多数真实 workspace 路径/命令（"Read " + 200 < 255 DB 标题列上限）；
            # 仍保留头部截断——command/pattern/query 的头部即主信息，路径则交由前端「路径感知」单行
            # 截断保留文件名尾部。
            short = val if len(val) <= 200 else val[:200] + "…"
            sep = ": " if key in ("command", "pattern", "query") else " "
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

    # system/* 非 init（api_retry / task_started / task_completed / task_progress / task_notification / task_updated）
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
) -> None:
    """归一化单条 raw 事件 → 定格 seq 累积进 events_holder（封顶）→ best-effort 实时回调。

    seq 在单迭代内单调递增（= 入 holder 时的下标），既供写回持久化，也随实时事件外溢，
    保证「实时 seq == 持久化 seq」，前端据此去重合并。
    """
    if events_holder is None:
        return
    for evt in _normalize_stream_event(raw):
        if len(events_holder) >= _MAX_EVENTS_PER_ITER:
            if events_holder and events_holder[-1].get("event_type") != "_truncated":
                events_holder.append(
                    {
                        "seq": len(events_holder),
                        "event_type": "_truncated",
                        "tool_name": None,
                        "title": f"动作数超过 {_MAX_EVENTS_PER_ITER} 上限，后续动作未记录",
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

        - ``sk-ant-`` 前缀 → 真实 Anthropic API Key，走 ``ANTHROPIC_API_KEY``（x-api-key）；
        - 否则 → claude.ai 订阅 OAuth 长期令牌，走 ``ANTHROPIC_AUTH_TOKEN`` +
          ``CLAUDE_CODE_OAUTH_TOKEN``（Bearer）。
        - 删除「未选中」的另一类凭证键，消除 Claude Code 内 key/token 的优先级歧义。
        - **绝不触碰 ``ANTHROPIC_BASE_URL``**（须保持指向 coding-proxy 根 ``/v1/messages``）。

        ``credential`` 为空 → 返回空字典（不施加任何覆盖，等价继承父环境）。
        """
        if not credential:
            return {}
        if credential.startswith("sk-ant-"):
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
    def _build_subprocess_env(credential: str | None) -> dict[str, str]:
        """构建子进程环境：``os.environ`` 副本叠加凭证覆盖（不就地修改 ``os.environ``）。

        无凭证时返回纯继承副本，功能等价于不传 ``env=``，故不破坏交互式 / 开发 / 终端场景。
        """
        env = os.environ.copy()
        for key, value in ClaudeCodeService._credential_env(credential).items():
            if value is None:
                env.pop(key, None)
            else:
                env[key] = value
        return env

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
        if config.resume_session_id:
            options.resume = config.resume_session_id
        if config.model:
            options.model = config.model
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
        )

        status = "error" if error_text else "success"
        return ClaudeCodeResult(
            status=status,
            error=error_text,
            summary=result_text[:_SUMMARY_MAX_LEN],
            session_id=session_id,
            cost_usd=cost,
            turn_count=turns,
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
        )

        args = ClaudeCodeService._build_cli_args(prompt, config)

        try:
            proc = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=config.cwd,
                # 注入真实 Anthropic 凭证到子进程环境（根因修复）。无凭证时等价继承父环境。
                env=ClaudeCodeService._build_subprocess_env(config.credential),
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
                await _emit_events(event, events_holder, on_event)

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

        status = "success" if proc.returncode == 0 else "error"
        error_msg = None
        if proc.returncode != 0:
            parts = [f"CLI exited with code {proc.returncode}"]
            if stderr_text:
                parts.append(f"stderr: {stderr_text[:500]}")
            if not result_text and not stderr_text:
                parts.append("no output captured")
            error_msg = "; ".join(parts)

        return ClaudeCodeResult(
            status=status,
            summary=result_text[:_SUMMARY_MAX_LEN],
            session_id=session_id,
            cost_usd=cost,
            turn_count=turns,
            error=error_msg,
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
        return args

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

        # 2. 简单 prompt 测试
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
