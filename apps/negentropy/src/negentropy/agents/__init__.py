def __getattr__(name: str):
    if name == "root_agent":
        from .agent import root_agent

        return root_agent
    raise AttributeError(f"module 'negentropy.agents' has no attribute {name}")


__all__ = [
    "root_agent",
    # 状态管理
    "state",
    "state_manager",
    # 流水线
    "pipelines",
    # 工具
    "tools",
    # 输出模式
    "schemas",
    # 下一步行动
    "next_action",
]
