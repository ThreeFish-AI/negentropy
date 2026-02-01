"""
SandboxRunner 抽象基类
支持多种沙箱后端的统一接口
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any


class SandboxBackend(Enum):
    """沙箱后端类型"""

    MICROSANDBOX = "microsandbox"  # 推荐: microVM 隔离
    DOCKER = "docker"  # 备选: 容器隔离
    WASM = "wasm"  # 轻量: WebAssembly


@dataclass
class SandboxConfig:
    """沙箱配置 - 通用参数"""

    name: str = "agent-sandbox"
    image: str = "python:3.11-slim"
    memory_mb: int = 256
    cpu_cores: float = 0.5
    timeout_seconds: int = 30
    network_enabled: bool = False
    allow_file_access: bool = False


@dataclass
class SandboxResult:
    """沙箱执行结果"""

    success: bool
    stdout: str
    stderr: str
    exit_code: int
    execution_time_ms: float
    metadata: dict = None  # 额外信息 (如资源使用)


class BaseSandboxRunner(ABC):
    """
    沙箱执行器抽象基类

    使用方式:
        runner = MicrosandboxRunner(config)
        result = await runner.execute("print('Hello!')")
    """

    def __init__(self, config: SandboxConfig | None = None):
        self._config = config or SandboxConfig()

    @property
    @abstractmethod
    def backend(self) -> SandboxBackend:
        """返回后端类型"""
        pass

    @abstractmethod
    async def execute(self, code: str) -> SandboxResult:
        """
        执行代码

        Args:
            code: 要执行的代码字符串

        Returns:
            SandboxResult: 执行结果
        """
        pass

    @abstractmethod
    async def execute_file(self, file_path: str) -> SandboxResult:
        """执行文件"""
        pass

    async def execute_safe(self, code: str) -> SandboxResult:
        """
        带预检查的安全执行

        在执行前进行静态分析，拦截危险代码模式
        """
        danger_patterns = [
            "os.system",
            "subprocess",
            "__import__",
            "eval(",
            "exec(",
            "open(",
            "import socket",
            "import requests",
        ]
        for pattern in danger_patterns:
            if pattern in code:
                return SandboxResult(
                    success=False,
                    stdout="",
                    stderr=f"Security violation: '{pattern}' is not allowed",
                    exit_code=-2,
                    execution_time_ms=0,
                )
        return await self.execute(code)

    async def health_check(self) -> bool:
        """检查沙箱服务是否可用"""
        try:
            result = await self.execute("print('health')")
            return result.success and "health" in result.stdout
        except Exception:
            return False

    async def cleanup(self) -> None:
        """清理资源 (子类可覆写)"""
        pass
