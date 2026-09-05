def __getattr__(name: str):
    if name in {"agent", "root_agent"}:
        # Phase 4 接线：NE_AGENTS_FROM_DB 开启且已安装 DB 构造覆盖时优先返回覆盖，
        # 否则回退代码 root_agent（flag-off 零行为变化）。
        from negentropy.agents._root_override import get_root_override

        override = get_root_override()
        if override is not None:
            return override
        from negentropy.agents.agent import root_agent

        return root_agent
    if name == "runner":
        from negentropy.engine.factories import get_runner

        return get_runner()
    raise AttributeError(f"module 'negentropy' has no attribute {name}")


__all__ = ["agent", "root_agent", "runner"]
