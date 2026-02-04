"""
MicrosandboxRunner: 基于 microsandbox 的安全沙箱

核心特性:
- microVM 级别隔离 (独立内核)
- <200ms 冷启动
- MCP 原生支持
- OCI 镜像兼容
"""

import asyncio
import os
from pathlib import Path

from microsandbox import PythonSandbox  # pip install microsandbox

from .base import BaseSandboxRunner, SandboxBackend, SandboxConfig, SandboxResult


class MicrosandboxRunner(BaseSandboxRunner):
    """基于 microsandbox 的轻量级沙箱执行器"""

    def __init__(self, config: SandboxConfig | None = None):
        super().__init__(config)
        # 从环境变量获取 API 密钥，如未配置则使用 config 中的值
        self._api_key = self._config.api_key or os.getenv("MSB_API_KEY")

    @property
    def backend(self) -> SandboxBackend:
        return SandboxBackend.MICROSANDBOX

    async def execute(self, code: str) -> SandboxResult:
        """在 microVM 中安全执行代码"""
        import time
        import aiohttp

        start = time.time()

        # Manually manage sandbox lifecycle to pass configuration params
        sandbox = PythonSandbox(
            name=self._config.name,
            api_key=self._api_key,
        )
        sandbox._session = aiohttp.ClientSession()

        try:
            # Start with validation params
            # Note: Microsandbox SDK 0.1.8 start() supports: image, memory, cpus, timeout.
            # Network config is not exposed in start(), likely determined by server config or image.
            await sandbox.start(
                image=self._config.image,
                memory=self._config.memory_mb,
                cpus=self._config.cpu_cores,
                timeout=self._config.timeout_seconds,
            )

            # 执行代码
            execution = await asyncio.wait_for(sandbox.run(code), timeout=self._config.timeout_seconds)

            stdout = await execution.output()
            stderr = await execution.errors() if hasattr(execution, "errors") else ""
            exit_code = execution.exit_code if hasattr(execution, "exit_code") else 0

            return SandboxResult(
                success=(exit_code == 0),
                stdout=stdout,
                stderr=stderr,
                exit_code=exit_code,
                execution_time_ms=(time.time() - start) * 1000,
                metadata=None,
            )

        except asyncio.TimeoutError:
            return SandboxResult(
                success=False,
                stdout="",
                stderr=f"Execution timeout ({self._config.timeout_seconds}s)",
                exit_code=-1,
                execution_time_ms=(time.time() - start) * 1000,
                metadata=None,
            )
        except Exception as e:
            return SandboxResult(
                success=False,
                stdout="",
                stderr=str(e),
                exit_code=-1,
                execution_time_ms=(time.time() - start) * 1000,
                metadata=None,
            )
        finally:
            try:
                await sandbox.stop()
            except Exception:
                pass
            if sandbox._session:
                await sandbox._session.close()

    async def execute_safe(self, code: str) -> SandboxResult:
        """带基础安全检查的执行"""
        # 过滤危险模式
        dangerous = ["os.system", "subprocess", "__import__", "eval(", "exec("]
        for pattern in dangerous:
            if pattern in code:
                return SandboxResult(
                    success=False,
                    stdout="",
                    stderr=f"Blocked: {pattern}",
                    exit_code=-2,
                    execution_time_ms=0,
                    metadata=None,
                )
        return await self.execute(code)

    async def execute_file(self, file_path: str) -> SandboxResult:
        """执行文件"""
        code = Path(file_path).read_text(encoding="utf-8")
        return await self.execute(code)
