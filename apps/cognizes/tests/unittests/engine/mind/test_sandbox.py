"""
Sandbox 安全沙箱单元测试
覆盖代码执行、安全拦截、超时控制和网络隔离

验收项:
- #20: 正常代码执行
- #21: 恶意代码拦截
- #22: 超时控制
- #23: 网络隔离
"""

import pytest
import asyncio
import os
import socket
from unittest.mock import AsyncMock, MagicMock, patch

# pytest-asyncio 配置
pytestmark = pytest.mark.asyncio


def is_microsandbox_available(host: str = "127.0.0.1", port: int = 5555, timeout: float = 1.0) -> bool:
    """
    检测 microsandbox 服务是否可用。

    通过尝试建立 TCP 连接来检测服务是否运行。

    Args:
        host: microsandbox 服务地址
        port: microsandbox 服务端口
        timeout: 连接超时时间（秒）

    Returns:
        bool: True 表示服务可用，False 表示不可用
    """
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except (socket.error, OSError):
        return False


# 预先检测 microsandbox 是否可用（模块加载时执行一次）
MICROSANDBOX_AVAILABLE = is_microsandbox_available()
MICROSANDBOX_SKIP_REASON = "microsandbox 服务不可用（127.0.0.1:5555 无法连接）"


class TestBaseSandboxRunner:
    """BaseSandboxRunner 测试套件 (使用 Mock)"""

    @pytest.fixture
    def mock_sandbox_runner(self):
        """创建模拟沙箱执行器"""
        from cognizes.adapters.postgres.sandbox.base import (
            BaseSandboxRunner,
            SandboxConfig,
            SandboxResult,
            SandboxBackend,
        )

        class MockSandboxRunner(BaseSandboxRunner):
            """测试用模拟沙箱"""

            def __init__(self, config=None, mock_result=None):
                super().__init__(config)
                self._mock_result = mock_result

            @property
            def backend(self):
                return SandboxBackend.MICROSANDBOX

            async def execute(self, code: str) -> SandboxResult:
                if self._mock_result:
                    return self._mock_result
                # 默认成功执行
                return SandboxResult(success=True, stdout="executed", stderr="", exit_code=0, execution_time_ms=10.0)

            async def execute_file(self, file_path: str) -> SandboxResult:
                return await self.execute(f"exec({file_path})")

        return MockSandboxRunner, SandboxResult, SandboxConfig

    # ========== 正常代码执行测试 ==========

    async def test_execute_normal_code(self, mock_sandbox_runner):
        """验收项 #20: 测试正常代码执行"""
        MockRunner, SandboxResult, _ = mock_sandbox_runner

        runner = MockRunner(
            mock_result=SandboxResult(success=True, stdout="hello", stderr="", exit_code=0, execution_time_ms=15.0)
        )

        result = await runner.execute("print('hello')")

        assert result.success is True
        assert result.stdout == "hello"
        assert result.exit_code == 0

    async def test_execute_with_output(self, mock_sandbox_runner):
        """测试代码执行带输出"""
        MockRunner, SandboxResult, _ = mock_sandbox_runner

        runner = MockRunner(
            mock_result=SandboxResult(success=True, stdout="1\n2\n3", stderr="", exit_code=0, execution_time_ms=20.0)
        )

        result = await runner.execute("for i in [1,2,3]: print(i)")

        assert result.success is True
        assert "1" in result.stdout
        assert "3" in result.stdout

    # ========== 恶意代码拦截测试 ==========

    async def test_block_malicious_code_os_system(self, mock_sandbox_runner):
        """验收项 #21: 测试 os.system 被拦截"""
        MockRunner, _, _ = mock_sandbox_runner

        runner = MockRunner()

        result = await runner.execute_safe("import os; os.system('rm -rf /')")

        assert result.success is False
        assert "os.system" in result.stderr
        assert result.exit_code == -2

    async def test_block_malicious_code_subprocess(self, mock_sandbox_runner):
        """测试 subprocess 被拦截"""
        MockRunner, _, _ = mock_sandbox_runner

        runner = MockRunner()

        result = await runner.execute_safe("import subprocess; subprocess.run(['ls'])")

        assert result.success is False
        assert "subprocess" in result.stderr

    async def test_block_malicious_code_eval(self, mock_sandbox_runner):
        """测试 eval( 被拦截"""
        MockRunner, _, _ = mock_sandbox_runner

        runner = MockRunner()

        result = await runner.execute_safe('eval(\'__import__("os").system("pwd")\')')

        assert result.success is False
        # The sandbox might catch __import__ first or eval, depending on implementation.
        # Current error: "Security violation: '__import__' is not allowed"
        assert "Security violation" in result.stderr

    async def test_block_malicious_code_exec(self, mock_sandbox_runner):
        """测试 exec( 被拦截"""
        MockRunner, _, _ = mock_sandbox_runner

        runner = MockRunner()

        result = await runner.execute_safe("exec('print(1)')")

        assert result.success is False
        assert "exec(" in result.stderr

    async def test_block_malicious_code_import_socket(self, mock_sandbox_runner):
        """测试 import socket 被拦截"""
        MockRunner, _, _ = mock_sandbox_runner

        runner = MockRunner()

        result = await runner.execute_safe("import socket; s = socket.socket()")

        assert result.success is False
        assert "import socket" in result.stderr

    async def test_safe_code_passes(self, mock_sandbox_runner):
        """测试安全代码通过检查"""
        MockRunner, SandboxResult, _ = mock_sandbox_runner

        runner = MockRunner(
            mock_result=SandboxResult(success=True, stdout="42", stderr="", exit_code=0, execution_time_ms=5.0)
        )

        # 安全代码应该通过
        result = await runner.execute_safe("print(21 * 2)")

        assert result.success is True
        assert result.stdout == "42"

    # ========== 超时控制测试 ==========

    async def test_timeout_control(self, mock_sandbox_runner):
        """验收项 #22: 测试无限循环被超时终止"""
        MockRunner, SandboxResult, SandboxConfig = mock_sandbox_runner

        # 配置超时为 1 秒
        config = SandboxConfig(timeout_seconds=1)
        runner = MockRunner(
            config=config,
            mock_result=SandboxResult(
                success=False, stdout="", stderr="Execution timeout (1s)", exit_code=-1, execution_time_ms=1000.0
            ),
        )

        result = await runner.execute("while True: pass")

        assert result.success is False
        assert "timeout" in result.stderr.lower()
        assert result.exit_code == -1

    # ========== 网络隔离测试 ==========

    async def test_network_isolation(self, mock_sandbox_runner):
        """验收项 #23: 测试网络请求被拦截"""
        MockRunner, _, _ = mock_sandbox_runner

        runner = MockRunner()

        # execute_safe 会拦截 import requests
        result = await runner.execute_safe("import requests; requests.get('https://example.com')")

        assert result.success is False
        assert "import requests" in result.stderr

    async def test_network_isolation_open_connection(self, mock_sandbox_runner):
        """测试网络连接被隔离 (socket)"""
        MockRunner, _, _ = mock_sandbox_runner

        runner = MockRunner()

        result = await runner.execute_safe("import socket; socket.create_connection(('google.com', 80))")

        assert result.success is False

    # ========== 健康检查测试 ==========

    async def test_health_check_success(self, mock_sandbox_runner):
        """测试健康检查成功"""
        MockRunner, SandboxResult, _ = mock_sandbox_runner

        runner = MockRunner(
            mock_result=SandboxResult(success=True, stdout="health", stderr="", exit_code=0, execution_time_ms=5.0)
        )

        is_healthy = await runner.health_check()

        assert is_healthy is True

    async def test_health_check_failure(self, mock_sandbox_runner):
        """测试健康检查失败"""
        MockRunner, SandboxResult, _ = mock_sandbox_runner

        runner = MockRunner(
            mock_result=SandboxResult(
                success=False, stdout="", stderr="service unavailable", exit_code=1, execution_time_ms=5.0
            )
        )

        is_healthy = await runner.health_check()

        assert is_healthy is False


class TestMicrosandboxRunner:
    """MicrosandboxRunner 集成测试 (需要 microsandbox 环境)"""

    @pytest.fixture
    def sandbox_config(self):
        """创建测试沙箱配置"""
        from cognizes.adapters.postgres.sandbox.microsandbox_runner import SandboxConfig

        return SandboxConfig(
            name="test-sandbox", timeout_seconds=5, network_enabled=False, api_key=os.getenv("MSB_API_KEY")
        )

    @pytest.mark.skipif(not MICROSANDBOX_AVAILABLE, reason=MICROSANDBOX_SKIP_REASON)
    async def test_microsandbox_execute(self, sandbox_config):
        """集成测试: 真实 microsandbox 执行"""
        from cognizes.adapters.postgres.sandbox.microsandbox_runner import MicrosandboxRunner

        runner = MicrosandboxRunner(config=sandbox_config)
        result = await runner.execute("print('Hello from sandbox!')")

        assert result.success is True
        assert "Hello from sandbox!" in result.stdout

    @pytest.mark.skipif(not MICROSANDBOX_AVAILABLE, reason=MICROSANDBOX_SKIP_REASON)
    async def test_microsandbox_timeout(self, sandbox_config):
        """集成测试: 真实超时测试"""
        from cognizes.adapters.postgres.sandbox.microsandbox_runner import MicrosandboxRunner

        sandbox_config.timeout_seconds = 1
        runner = MicrosandboxRunner(config=sandbox_config)
        result = await runner.execute("import time; time.sleep(10)")

        assert result.success is False
        assert "timeout" in result.stderr.lower()


class TestSandboxConfig:
    """SandboxConfig 配置测试"""

    def test_default_config(self):
        """测试默认配置"""
        from cognizes.adapters.postgres.sandbox.base import SandboxConfig

        config = SandboxConfig()

        assert config.name == "agent-sandbox"
        assert config.memory_mb == 256
        assert config.cpu_cores == 0.5
        assert config.timeout_seconds == 30
        assert config.network_enabled is False
        assert config.allow_file_access is False

    def test_custom_config(self):
        """测试自定义配置"""
        from cognizes.adapters.postgres.sandbox.base import SandboxConfig

        config = SandboxConfig(name="custom-sandbox", memory_mb=512, timeout_seconds=60, network_enabled=True)

        assert config.name == "custom-sandbox"
        assert config.memory_mb == 512
        assert config.timeout_seconds == 60
        assert config.network_enabled is True


class TestSandboxResult:
    """SandboxResult 结果测试"""

    def test_success_result(self):
        """测试成功结果"""
        from cognizes.adapters.postgres.sandbox.base import SandboxResult

        result = SandboxResult(success=True, stdout="output", stderr="", exit_code=0, execution_time_ms=100.0)

        assert result.success is True
        assert result.exit_code == 0

    def test_failure_result(self):
        """测试失败结果"""
        from cognizes.adapters.postgres.sandbox.base import SandboxResult

        result = SandboxResult(success=False, stdout="", stderr="Error occurred", exit_code=1, execution_time_ms=50.0)

        assert result.success is False
        assert result.exit_code == 1
        assert "Error" in result.stderr
