def __getattr__(name: str):
    if name in {"agent", "root_agent"}:
        from negentropy.agents.agent import root_agent

        return root_agent
    if name == "runner":
        from negentropy.engine.factories import get_runner

        return get_runner()
    raise AttributeError(f"module 'negentropy' has no attribute {name}")


__all__ = ["agent", "root_agent", "runner"]
