"""Human-in-the-Loop 工具实现"""

from dataclasses import dataclass
from typing import Any
import asyncio


@dataclass
class ConfirmationRequest:
    """确认请求"""

    action: str
    importance: str  # low, medium, high, critical
    timeout_seconds: int = 60


class HumanInTheLoop:
    """Human-in-the-Loop 管理器"""

    def __init__(self):
        self._pending_confirmations: dict[str, asyncio.Future] = {}

    async def request_confirmation(self, request_id: str, request: ConfirmationRequest) -> dict[str, Any]:
        """
        请求用户确认
        返回: {"confirmed": bool, "user_input": str}
        """
        future = asyncio.Future()
        self._pending_confirmations[request_id] = future

        try:
            result = await asyncio.wait_for(future, timeout=request.timeout_seconds)
            return result
        except asyncio.TimeoutError:
            return {"confirmed": False, "user_input": "timeout"}
        finally:
            self._pending_confirmations.pop(request_id, None)

    def resolve_confirmation(self, request_id: str, confirmed: bool, user_input: str = "") -> None:
        """解决确认请求 (前端调用)"""
        if request_id in self._pending_confirmations:
            future = self._pending_confirmations[request_id]
            if not future.done():
                future.set_result({"confirmed": confirmed, "user_input": user_input})
