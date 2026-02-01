"""
Runner 工厂模块

提供统一的 ADK Runner 创建接口，整合 SessionService 和 MemoryService。
遵循 AGENTS.md 中的 Reuse-Driven 与 Orthogonal Decomposition 原则。
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from google.adk.runners import Runner

from negentropy.agents.agent import root_agent
from negentropy.config import settings
from negentropy.engine.memory_factory import get_memory_service
from negentropy.engine.session_factory import get_session_service

if TYPE_CHECKING:
    from google.adk.agents.base_agent import BaseAgent


# 模块级单例缓存
_runner_instance: Runner | None = None


def get_runner(
    *,
    app_name: str | None = None,
    agent: "BaseAgent | None" = None,
    auto_create_session: bool = True,
) -> Runner:
    """
    获取 Runner 实例 (工厂函数)

    Args:
        app_name: 应用名称，默认从 settings.app_name 读取
        agent: 根 Agent 实例，默认使用 root_agent
        auto_create_session: 是否自动创建 Session，默认 True

    Returns:
        ADK Runner 实例，已配置 PostgreSQL 后端的 SessionService 和 MemoryService
    """
    global _runner_instance

    # 若已有缓存且未指定自定义参数，直接返回
    if _runner_instance is not None and app_name is None and agent is None:
        return _runner_instance

    runner = Runner(
        app_name=app_name or settings.app_name,
        agent=agent or root_agent,
        session_service=get_session_service(),
        memory_service=get_memory_service(),
        auto_create_session=auto_create_session,
    )

    # 仅在使用默认参数时缓存
    if app_name is None and agent is None:
        _runner_instance = runner

    return runner


def reset_runner() -> None:
    """重置单例缓存 (用于测试)"""
    global _runner_instance
    _runner_instance = None
