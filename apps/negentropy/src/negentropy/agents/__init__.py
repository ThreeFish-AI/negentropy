def __getattr__(name: str):
    if name == "root_agent":
        from .agent import root_agent

        return root_agent
    raise AttributeError(f"module 'negentropy.agents' has no attribute {name}")


__all__ = [
    "root_agent",
    # 系部 (Faculties)
    "faculties",
    # 流水线 (Pipelines)
    "pipelines",
    # 工具 (Tools)
    "tools",
]
