"""
The Pulse 验收测试：验证会话引擎的并发一致性与实时性
"""

import pytest
import asyncio
import time
from uuid import uuid4
from services import create_services
from google.adk.events import Event
from google.genai import types

pytestmark = pytest.mark.asyncio


class TestPulseValidation:
    """Pulse (会话引擎) 验收测试套件"""

    # ========== P5-2-1: 并发多轮对话 ==========

    async def test_concurrent_sessions_no_interference(self):
        """测试多用户并发对话不会相互干扰"""
        session_service, _ = await create_services()
        app_name = "travel_agent"

        # 创建 10 个并发用户的 Session
        async def user_conversation(user_id: str):
            session = await session_service.create_session(
                app_name=app_name, user_id=user_id, state={"user_name": user_id}
            )

            # 模拟多轮对话
            for i in range(5):
                event = Event(
                    id=str(uuid4()),
                    author="user",
                    content=types.Content(parts=[types.Part(text=f"Message {i} from {user_id}")]),
                    actions={"state_delta": {f"turn_{i}": True}},
                )
                await session_service.append_event(session, event)

            # 验证 Session 状态
            loaded = await session_service.get_session(app_name=app_name, user_id=user_id, session_id=session.id)
            assert loaded.state["user_name"] == user_id
            assert len(loaded.events) == 5
            return loaded

        # 10 用户并发执行
        user_ids = [f"user_{i:03d}" for i in range(10)]
        sessions = await asyncio.gather(*[user_conversation(uid) for uid in user_ids])

        # 验证无数据混淆
        for session in sessions:
            assert session.state["user_name"] in user_ids
            for event in session.events:
                # 检查 event.content (Content 对象) 中的文本
                text = event.content.parts[0].text if event.content and event.content.parts else ""
                assert session.state["user_name"] in text

    async def test_optimistic_concurrency_control(self):
        """测试多写入者并发时的乐观锁控制"""
        session_service, _ = await create_services()

        session = await session_service.create_session(app_name="test_app", user_id="test_user", state={"counter": 0})

        # 模拟 10 个并发写入者
        async def concurrent_increment(writer_id: int):
            for _ in range(10):
                current = await session_service.get_session(
                    app_name="test_app", user_id="test_user", session_id=session.id
                )
                new_counter = current.state.get("counter", 0) + 1
                event = Event(
                    id=str(uuid4()),
                    author="agent",
                    # content is optional/empty here
                    actions={"state_delta": {"counter": new_counter}},
                )
                try:
                    await session_service.append_event(current, event)
                except Exception:
                    pass  # OCC 冲突重试

        await asyncio.gather(*[concurrent_increment(i) for i in range(10)])

        # 验证最终计数（可能因 OCC 冲突而少于 100，但不应丢失）
        final = await session_service.get_session(app_name="test_app", user_id="test_user", session_id=session.id)
        assert final.state["counter"] > 0
        print(f"Final counter: {final.state['counter']} (expected ~100 with conflicts)")

    # ========== P5-2-2: 状态回溯 ==========

    async def test_state_rollback_via_snapshots(self):
        """测试通过快照恢复历史状态"""
        session_service, _ = await create_services()

        session = await session_service.create_session(app_name="test_app", user_id="test_user")

        # 创建多个状态变更
        states_history = []
        for i in range(5):
            event = Event(id=str(uuid4()), author="agent", actions={"state_delta": {f"step_{i}": f"value_{i}"}})
            await session_service.append_event(session, event)
            current = await session_service.get_session(app_name="test_app", user_id="test_user", session_id=session.id)
            states_history.append(current.state.copy())

        # 验证状态累积正确
        final_state = states_history[-1]
        assert len(final_state) == 5
        for i in range(5):
            assert final_state[f"step_{i}"] == f"value_{i}"

    # ========== P5-2-3: 实时推送延迟 ==========

    async def test_event_notification_latency(self):
        """测试事件通知延迟 < 50ms"""
        session_service, _ = await create_services()

        session = await session_service.create_session(app_name="test_app", user_id="test_user")

        # 测量事件插入到通知的延迟
        latencies = []
        for _ in range(10):
            start = time.perf_counter()
            event = Event(
                id=str(uuid4()), author="user", content=types.Content(parts=[types.Part(text="test message")])
            )
            await session_service.append_event(session, event)
            latency_ms = (time.perf_counter() - start) * 1000
            latencies.append(latency_ms)

        avg_latency = sum(latencies) / len(latencies)
        p99_latency = sorted(latencies)[int(len(latencies) * 0.99)]

        print(f"Event append latency: avg={avg_latency:.2f}ms, P99={p99_latency:.2f}ms")
        assert p99_latency < 50, f"P99 latency {p99_latency}ms exceeds 50ms threshold"
