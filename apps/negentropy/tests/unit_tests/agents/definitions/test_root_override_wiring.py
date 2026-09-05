"""Phase 4 接线 — DB root agent 覆盖槽与解析路径集成测试。

覆盖：
1. 覆盖槽 set/get/clear 基本语义；
2. flag-off：``refresh_root_override`` 返回 False 且不安装覆盖；两条解析路径回退代码 root；
3. flag-on：``refresh_root_override`` 安装 DB 覆盖；``negentropy.root_agent`` /
   ``negentropy.agents.root_agent`` / ``get_runner().agent`` 三路径均命中同一覆盖对象；
4. clear 后三路径回退代码 root_agent。

隔离：每个用例结束 clear_root_override + reset_runner，避免污染进程级单例 / 其他用例。
"""

from __future__ import annotations

import pytest

from negentropy.agents._root_override import (
    clear_root_override,
    get_root_override,
    set_root_override,
)


@pytest.fixture(autouse=True)
def _isolate_override():
    """每个用例前后清覆盖 + runner 缓存，保证进程级单例隔离。"""
    from negentropy.engine.factories.runner import reset_runner

    clear_root_override()
    reset_runner()
    yield
    clear_root_override()
    reset_runner()


def test_override_slot_semantics():
    assert get_root_override() is None

    class _Fake:
        name = "FakeRoot"

    fake = _Fake()
    set_root_override(fake)
    assert get_root_override() is fake
    clear_root_override()
    assert get_root_override() is None


@pytest.mark.asyncio
async def test_refresh_flag_off_no_override(monkeypatch):
    """显式 flag-off（NE_AGENTS_FROM_DB=0）→ refresh 返回 False，不安装覆盖；走代码 root。

    注：default-on 后 off 用例须显式设 falsy 值（未设 = 开启）。
    """
    monkeypatch.setenv("NE_AGENTS_FROM_DB", "0")
    from negentropy.agents.definitions.agent_factory import refresh_root_override

    installed = await refresh_root_override()
    assert installed is False
    assert get_root_override() is None

    import negentropy

    assert negentropy.root_agent.name == "NegentropyEngine"  # 代码 root


@pytest.mark.asyncio
async def test_refresh_flag_on_installs_and_all_paths_hit(monkeypatch):
    """flag-on → refresh 安装 DB 覆盖；三条解析路径命中同一对象；clear 后回退。"""
    monkeypatch.setenv("NE_AGENTS_FROM_DB", "1")
    from negentropy.agents.definitions.agent_factory import refresh_root_override

    installed = await refresh_root_override()
    assert installed is True
    override = get_root_override()
    assert override is not None
    assert override.name == "NegentropyEngine"
    # DB 组装的 root 有 8 个 sub_agents（5 faculties + 3 pipelines）
    assert len(override.sub_agents) == 8

    import negentropy
    import negentropy.agents

    assert negentropy.root_agent is override
    assert negentropy.agents.root_agent is override

    from negentropy.engine.factories.runner import get_runner, reset_runner

    reset_runner()
    runner = get_runner()
    assert runner.agent is override

    # clear → 三路径回退代码 root
    clear_root_override()
    reset_runner()
    assert get_root_override() is None
    assert negentropy.root_agent.name == "NegentropyEngine"
