def __getattr__(name: str):
    if name == "root_agent":
        # Phase 4 接线：优先返回 DB 构造覆盖（flag-on 且已安装），否则回退代码 root_agent。
        from ._root_override import get_root_override

        override = get_root_override()
        if override is not None:
            return override
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
