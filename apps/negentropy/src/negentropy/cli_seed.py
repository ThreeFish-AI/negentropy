"""``negentropy seed-demo`` —— 首启可见的演示数据种子（opt-in、幂等）。

让新用户首启即看到「产品在运转」的可见信号（一条欢迎会话 + 一条示例记忆 + 一条示例事实），
兑现 Proactive Navigation 与「消除首启空白认知摩擦」。不依赖嵌入向量（``embedding=NULL``），
故在零云嵌入下亦可经关键词检索命中，配合 LLM Key 激活即可对话。

幂等：所有 demo 行以 ``metadata.seed_marker="negentropy-demo"`` 标记，重复执行自动跳过。
``--reset``：仅清除带该标记的行后重建，**绝不触碰用户真实数据**。

非自动执行（opt-in CLI），对既有部署与测试零爆炸半径。

用户对齐：``user_id`` 默认 ``dev-user``，与前端 ``NEXT_PUBLIC_AGUI_USER_ID`` 默认值一致
（见 apps/negentropy-ui/.env.example），故 demo 数据首启即在 UI 可见。

参考文献：
[1] N. Forsgren, J. Humble, and G. Kim, "Accelerate: The Science of Lean Software
    and DevOps," IT Revolution Press, 2018（Time to first value）。
"""

from __future__ import annotations

import argparse
import asyncio
import json
from uuid import uuid4

from sqlalchemy import text

_DEMO_MARKER = "negentropy-demo"
_DEFAULT_USER = "dev-user"  # 与 NEXT_PUBLIC_AGUI_USER_ID 默认对齐
_MARKER_JSON = json.dumps({"seed_marker": _DEMO_MARKER})

_WELCOME_USER_MSG = "你好！请介绍一下 Negentropy 的核心能力。"
_WELCOME_AGENT_MSG = (
    "你好！我是 Negentropy —— 一个以「单根五翼」架构对抗信息熵增的自进化认知系统。"
    "这是一条演示回复，配置好 LLM Key 后即可获得真实流式对话。（demo seed）"
)


async def _reset_demo(session) -> None:  # type: ignore[no-untyped-def]
    """仅删除带 demo 标记的行；events 经 thread FK ondelete=CASCADE 级联清除。"""
    # 依赖顺序：先删 memories/facts（按标记），再删 threads（级联 events）
    for table in ("memories", "facts"):
        await session.execute(
            text(f"DELETE FROM negentropy.{table} WHERE metadata @> :m::jsonb"),
            {"m": _MARKER_JSON},
        )
    await session.execute(
        text("DELETE FROM negentropy.threads WHERE metadata @> :m::jsonb"),
        {"m": _MARKER_JSON},
    )


async def _demo_exists(session) -> bool:  # type: ignore[no-untyped-def]
    row = (
        await session.execute(
            text("SELECT 1 FROM negentropy.threads WHERE metadata @> :m::jsonb LIMIT 1"),
            {"m": _MARKER_JSON},
        )
    ).first()
    return row is not None


async def _seed_demo(user_id: str) -> None:
    from negentropy.db import AsyncSessionLocal
    from negentropy.models.internalization import Fact, Memory
    from negentropy.models.pulse import Event, Thread

    async with AsyncSessionLocal() as session:
        async with session.begin():
            if await _demo_exists(session):
                print(f"✔ 演示数据已存在（marker={_DEMO_MARKER}），跳过。使用 --reset 重建。")
                return

            # 1) 欢迎会话（metadata.title_source="manual" 免触发会话标题 inspector）
            thread = Thread(
                app_name="negentropy",
                user_id=user_id,
                state={},
                version=1,
                metadata_={
                    "seed_marker": _DEMO_MARKER,
                    "title": "Welcome · Negentropy Demo",
                    "title_source": "manual",
                },
            )
            session.add(thread)
            await session.flush()  # 取 thread.id 供 events/memories 外键引用

            invocation = uuid4()
            # 2) 一轮欢迎对话（content 采用 ADK/Gemini parts 形式）
            session.add(
                Event(
                    thread_id=thread.id,
                    invocation_id=invocation,
                    author="user",
                    event_type="message",
                    content={"parts": [{"text": _WELCOME_USER_MSG}], "role": "user"},
                    actions={},
                )
            )
            session.add(
                Event(
                    thread_id=thread.id,
                    invocation_id=invocation,
                    author="agent",
                    event_type="message",
                    content={"parts": [{"text": _WELCOME_AGENT_MSG}], "role": "agent"},
                    actions={},
                )
            )

            # 3) 示例记忆（episodic，无 embedding，关键词可检索）
            session.add(
                Memory(
                    thread_id=thread.id,
                    user_id=user_id,
                    app_name="negentropy",
                    memory_type="episodic",
                    content="（示例记忆）用户正在探索 Negentropy 的首启演示流程。",
                    embedding=None,
                    metadata_={"seed_marker": _DEMO_MARKER},
                )
            )

            # 4) 示例事实（用户画像；key 受唯一约束 user×app×fact_type×key）
            session.add(
                Fact(
                    thread_id=thread.id,
                    user_id=user_id,
                    app_name="negentropy",
                    fact_type="preference",
                    key="preferred_language",
                    value={"lang": "zh-CN"},
                    embedding=None,
                    metadata_={"seed_marker": _DEMO_MARKER},
                )
            )

        print(f"✔ 演示数据已写入（user_id={user_id}）：1 会话 + 2 事件 + 1 记忆 + 1 事实。")


async def _seed_demo_with_reset(user_id: str, reset: bool) -> None:
    if reset:
        from negentropy.db import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            async with session.begin():
                await _reset_demo(session)
        print("✔ 已清除旧演示数据（按 seed_marker 标记）。")
    await _seed_demo(user_id)


def run_seed_demo_sync(args: argparse.Namespace) -> int:
    """同步入口：供 cli.py 调用。"""
    try:
        asyncio.run(_seed_demo_with_reset(args.user, args.reset))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"✘ 演示数据写入失败: {type(exc).__name__}: {exc}", flush=True)
        return 1
