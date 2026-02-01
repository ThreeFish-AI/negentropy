"""
Sandbox package initialization
Exposes the factory function for creating sandbox runners.
"""

from .base import SandboxBackend, SandboxConfig, BaseSandboxRunner


def create_sandbox_runner(
    backend: SandboxBackend = SandboxBackend.MICROSANDBOX, config: SandboxConfig | None = None
) -> BaseSandboxRunner:
    """
    创建沙箱执行器的工厂函数

    Args:
        backend: 沙箱后端类型
        config: 可选配置

    Returns:
        BaseSandboxRunner 实现
    """
    if backend == SandboxBackend.MICROSANDBOX:
        from .microsandbox_runner import MicrosandboxRunner

        return MicrosandboxRunner(config)
    elif backend == SandboxBackend.DOCKER:
        # TODO: Implement DockerSandboxRunner
        # from .docker_runner import DockerSandboxRunner
        # return DockerSandboxRunner(config)
        raise NotImplementedError("Docker backend not yet implemented")
    else:
        raise ValueError(f"Unsupported backend: {backend}")
