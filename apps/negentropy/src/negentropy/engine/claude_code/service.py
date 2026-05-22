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
        try:
            if ClaudeCodeService._check_sdk():
                result = await ClaudeCodeService._invoke_sdk(prompt, config, abort_event)
            else:
                result = await ClaudeCodeService._invoke_cli(prompt, config, abort_event)
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
            return ClaudeCodeResult(status="error", summary="", error="cancelled")
        except Exception as exc:
            logger.warning("claude_code_invoke_failed", error=str(exc))
            return ClaudeCodeResult(status="error", summary="", error=str(exc))

    # ------------------------------------------------------------------
    # SDK 路径
    # ------------------------------------------------------------------

    @staticmethod
    async def _invoke_sdk(
        prompt: str,
        config: ClaudeCodeConfig,
        abort_event: asyncio.Event | None,
    ) -> ClaudeCodeResult:
        import claude_code_sdk

        options = claude_code_sdk.ClaudeCodeOptions(
            system_prompt=config.system_prompt,
            allowed_tools=config.get_effective_allowed_tools(),
            max_turns=config.max_turns,
            permission_mode=config.permission_mode,
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

        async for msg in claude_code_sdk.query(prompt=prompt, options=options):
            # ResultMessage
            if hasattr(msg, "result") and msg.result:
                result_text = msg.result
            if hasattr(msg, "session_id") and msg.session_id:
                session_id = msg.session_id
            if hasattr(msg, "cost_usd") and msg.cost_usd:
                cost = msg.cost_usd
            if hasattr(msg, "num_turns") and msg.num_turns:
                turns = msg.num_turns

            if abort_event and abort_event.is_set():
                break

        return ClaudeCodeResult(
            status="success",
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
    ) -> ClaudeCodeResult:
        args = ClaudeCodeService._build_cli_args(prompt, config)

        try:
            proc = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=config.cwd,
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
            async for line in proc.stdout:
                if abort_event and abort_event.is_set():
                    proc.terminate()
                    break
                decoded = line.decode("utf-8", errors="replace").strip()
                if not decoded:
                    continue
                try:
                    event = json.loads(decoded)
                except json.JSONDecodeError:
                    continue

                evt_type = event.get("type")
                if evt_type == _EVT_RESULT:
                    result_text = event.get("result", "")
                    session_id = event.get("session_id")
                    cost = event.get("cost_usd", 0.0)
                    turns = event.get("num_turns", 0)
                elif evt_type == _EVT_ASSISTANT:
                    content = event.get("content", "")
                    if content and not result_text:
                        result_text = content
        except asyncio.CancelledError:
            proc.terminate()
            await proc.wait()
            raise
        finally:
            if proc.returncode is None:
                proc.terminate()
                await proc.wait()

        status = "success" if proc.returncode == 0 else "error"
        return ClaudeCodeResult(
            status=status,
            summary=result_text[:_SUMMARY_MAX_LEN],
            session_id=session_id,
            cost_usd=cost,
            turn_count=turns,
        )

    @staticmethod
    def _build_cli_args(prompt: str, config: ClaudeCodeConfig) -> list[str]:
        args = [
            config.cli_path,
            "-p",
            prompt,
            "--output-format",
            "stream-json",
            "--max-turns",
            str(config.max_turns),
            "--permission-mode",
            config.permission_mode,
        ]
        if config.resume_session_id:
            args += ["--resume", config.resume_session_id]
        if config.model:
            args += ["--model", config.model]
        if config.system_prompt:
            args += ["--system-prompt", config.system_prompt]
        if config.cwd:
            args += ["--cwd", config.cwd]
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
        return {
            "success": False,
            "message": f"Claude Code prompt test failed: {test_result.error}",
            "version": version_out,
        }
