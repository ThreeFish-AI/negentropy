"""
Action Faculty Tools - 行动系部专用工具

提供代码执行、文件操作能力。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from google.adk.tools import ToolContext

from negentropy.engine.sandbox import SandboxBackend, SandboxConfig, create_sandbox_runner
from negentropy.logging import get_logger

logger = get_logger("negentropy.tools.action")

_MAX_READ_BYTES = 200_000


def _resolve_workspace_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "AGENTS.md").exists():
            return parent
        if (parent / "pyproject.toml").exists():
            return parent
    return Path.cwd().resolve()


def _resolve_safe_path(path: str) -> Path:
    root = _resolve_workspace_root()
    candidate = Path(path).expanduser()
    if not candidate.is_absolute():
        candidate = (root / candidate).resolve()
    else:
        candidate = candidate.resolve()
    if not candidate.is_relative_to(root):
        raise ValueError(f"Unsafe path access rejected: {candidate}")
    return candidate


async def execute_code(code: str, language: str, tool_context: ToolContext) -> dict[str, Any]:
    """在沙箱环境中执行代码。

    Args:
        code: 要执行的代码
        language: 编程语言

    Returns:
        执行结果
    """
    if language.lower() != "python":
        return {"status": "failed", "error": f"Unsupported language: {language}"}

    runner = create_sandbox_runner(
        backend=SandboxBackend.MICROSANDBOX,
        config=SandboxConfig(),
    )
    try:
        result = await runner.execute_safe(code)
        status = "success" if result.success else "failed"
        return {
            "status": status,
            "backend": runner.backend.value,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.exit_code,
            "execution_time_ms": result.execution_time_ms,
        }
    except Exception as exc:
        logger.error("sandbox execution failed", exc_info=exc)
        return {"status": "failed", "error": str(exc)}


def read_file(path: str, tool_context: ToolContext) -> dict[str, Any]:
    """读取文件内容。

    Args:
        path: 文件路径

    Returns:
        文件内容
    """
    try:
        resolved = _resolve_safe_path(path)
        if not resolved.exists():
            return {"status": "failed", "error": f"File not found: {resolved}"}
        if resolved.is_dir():
            return {"status": "failed", "error": f"Path is a directory: {resolved}"}
        data = resolved.read_bytes()
        truncated = len(data) > _MAX_READ_BYTES
        if truncated:
            data = data[:_MAX_READ_BYTES]
        content = data.decode("utf-8", errors="replace")
        return {
            "status": "success",
            "path": str(resolved),
            "bytes": len(data),
            "truncated": truncated,
            "content": content,
        }
    except Exception as exc:
        logger.error("read_file failed", exc_info=exc)
        return {"status": "failed", "error": str(exc)}


def write_file(path: str, content: str, tool_context: ToolContext) -> dict[str, Any]:
    """写入文件内容。

    Args:
        path: 文件路径
        content: 文件内容

    Returns:
        写入结果
    """
    try:
        resolved = _resolve_safe_path(path)
        resolved.parent.mkdir(parents=True, exist_ok=True)
        resolved.write_text(content, encoding="utf-8")
        return {
            "status": "success",
            "path": str(resolved),
            "bytes": len(content.encode("utf-8")),
        }
    except Exception as exc:
        logger.error("write_file failed", exc_info=exc)
        return {"status": "failed", "error": str(exc)}
