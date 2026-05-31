"""ClaudeCodeService — 封装 Claude Code CLI / SDK 调用。"""

from __future__ import annotations

import asyncio
import json
import shutil
import time
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

_SUMMARY_MAX_LEN = 2000

# 子进程 stdout 读取：手动分块 + 抬高 StreamReader 缓冲上限，规避 asyncio readline() 默认
# 64KiB 上限导致的 LimitOverrunError（stream-json 单行可达数 MiB，如大 tool_result）。
_STREAM_READER_LIMIT = 16 * 1024 * 1024  # 16 MiB
_READ_CHUNK = 64 * 1024  # 每次读取块大小


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

    @staticmethod
    async def invoke(
        prompt: str,
        config: ClaudeCodeConfig,
        abort_event: asyncio.Event | None = None,
    ) -> ClaudeCodeResult:
        """调用 Claude Code 并等待完整结果。

        用于 ADK Tool（tool call 内等待）和 Scheduler Handler。
        """
        t0 = time.monotonic()
        # 可变容器：内部协程一旦从 stream 起始 init 事件解析出 session_id 即写入，
        # 使超时/取消（wait_for 丢弃内部局部结果）路径仍能回带 session_id，让下一迭代续接。
        session_holder: dict[str, str | None] = {"session_id": None}
        try:
            if ClaudeCodeService._check_sdk():
                coro = ClaudeCodeService._invoke_sdk(prompt, config, abort_event, session_holder)
            else:
                coro = ClaudeCodeService._invoke_cli(prompt, config, abort_event, session_holder)
            result = await asyncio.wait_for(coro, timeout=config.timeout_seconds)
            elapsed = time.monotonic() - t0
            logger.info(
                "claude_code_invoke_done",
                status=result.status,
                elapsed_s=round(elapsed, 2),
                turns=result.turn_count,
                cost=result.cost_usd,
                sdk=ClaudeCodeService._sdk_available,
            )
            return result
        except asyncio.CancelledError:
            return ClaudeCodeResult(
                status="error", summary="", session_id=session_holder.get("session_id"), error="cancelled"
            )
        except TimeoutError:
            sid = session_holder.get("session_id")
            logger.warning("claude_code_invoke_timeout", timeout=config.timeout_seconds, session_id=sid)
            return ClaudeCodeResult(
                status="timeout", summary="", session_id=sid, error=f"exceeded timeout ({config.timeout_seconds}s)"
            )
        except Exception as exc:
            logger.warning("claude_code_invoke_failed", error=str(exc))
            return ClaudeCodeResult(
                status="error", summary="", session_id=session_holder.get("session_id"), error=str(exc)
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
    ) -> ClaudeCodeResult:
        args = ClaudeCodeService._build_cli_args(prompt, config)

        try:
            proc = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=config.cwd,
                limit=_STREAM_READER_LIMIT,  # 抬高 StreamReader 缓冲（兜底；主防线为手动分块读取）
            )
        except FileNotFoundError:
            return ClaudeCodeResult(
                status="error",
                summary="",
                error=f"claude CLI not found at '{config.cli_path}'",
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
                    result_text = event.get("result", "")
                    if event.get("session_id"):
                        session_id = event.get("session_id")
                        if session_holder is not None:
                            session_holder["session_id"] = session_id
                    # claude CLI 的 result 事件字段为 ``total_cost_usd``；兼容旧字段 ``cost_usd``。
                    cost = event.get("total_cost_usd") or event.get("cost_usd") or 0.0
                    turns = event.get("num_turns", 0)
                elif evt_type == _EVT_ASSISTANT:
                    content = event.get("content", "")
                    if content and not result_text:
                        result_text = content
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
                timeout_seconds=15.0,
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
