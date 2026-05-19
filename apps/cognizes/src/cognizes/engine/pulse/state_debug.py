"""状态调试面板数据接口"""

from dataclasses import dataclass
from typing import Any
import json


@dataclass
class StateDebugInfo:
    """状态调试信息"""

    thread_id: str
    current_state: dict[str, Any]
    state_history: list[dict]  # 最近 N 次状态变更
    prefix_breakdown: dict[str, dict]  # 按前缀分组的状态


class StateDebugService:
    """状态调试服务"""

    def __init__(self, pool):
        self._pool = pool

    async def get_debug_info(self, thread_id: str) -> StateDebugInfo:
        """获取线程的调试信息"""
        async with self._pool.acquire() as conn:
            # 获取当前状态
            thread = await conn.fetchrow("SELECT state FROM threads WHERE id = $1", thread_id)

            # 获取状态变更历史
            history = await conn.fetch(
                """
                SELECT
                    created_at,
                    content->'state_delta' as delta
                FROM events
                WHERE thread_id = $1
                  AND content ? 'state_delta'
                ORDER BY created_at DESC
                LIMIT 20
            """,
                thread_id,
            )

            current_state = json.loads(thread["state"]) if thread else {}

            # 按前缀分组
            prefix_breakdown = {"session": {}, "user": {}, "app": {}, "temp": {}}

            for key, value in current_state.items():
                if key.startswith("user:"):
                    prefix_breakdown["user"][key[5:]] = value
                elif key.startswith("app:"):
                    prefix_breakdown["app"][key[4:]] = value
                elif key.startswith("temp:"):
                    prefix_breakdown["temp"][key[5:]] = value
                else:
                    prefix_breakdown["session"][key] = value

            return StateDebugInfo(
                thread_id=thread_id,
                current_state=current_state,
                state_history=[{"time": str(h["created_at"]), "delta": json.loads(h["delta"])} for h in history],
                prefix_breakdown=prefix_breakdown,
            )
