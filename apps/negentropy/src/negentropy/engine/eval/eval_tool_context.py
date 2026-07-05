"""EvalToolContext —— ADK ToolContext 的 eval 专用 mock（R9-a 完整工具集 agent-loop）。

提供 ADK ``ToolContext`` 的**最小接口**，使真实工具函数（``search_knowledge_base`` /
``save_to_memory`` / ``execute_code`` 等）在 eval 中以**降级但安全**的方式运行：

- ``search_knowledge_base`` → 查真实 KB（read-only，安全）；
- ``save_to_memory`` → 写 ephemeral dict（不持久化，安全）；
- ``execute_code`` → MicroSandbox 沙箱（已在 V3 实现）。

综述 §3「skill 指导真实多步任务行为」—— mock ToolContext 让 eval 中的 agent-loop 能调用
**完整工具集**而非仅 execute_code，更接近真实部署态语义。

参考文献：
[1] C. Jiang et al., "Self-Improving Agents in the Era of Experience," 2026. §3 Skills / §5 Environment。
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from uuid import uuid4


class EvalToolContext:
    """ADK ToolContext 的 eval mock——提供工具函数所需的最小接口。

    所有工具在 eval 中以安全降级模式运行：read-only 工具查真实数据源；write 工具写 ephemeral dict。
    不创建真实 ADK session（避免完整 Runner 的重依赖）。
    """

    def __init__(
        self,
        *,
        agent_name: str = "eval_agent",
        user_id: str = "eval_user",
        app_name: str = "negentropy",
        thread_id: str | None = None,
    ) -> None:
        self.state: dict[str, Any] = {}  # ephemeral state（save_to_memory 写此 dict）
        self._user_id = user_id
        self._agent_name = agent_name
        self.function_call_id = f"eval-{uuid4().hex[:8]}"
        self.tool_call_id = self.function_call_id

        # session mock（工具函数读 .id / .user_id / .app_name）
        self.session = SimpleNamespace(
            id=thread_id or uuid4().hex,
            user_id=user_id,
            app_name=app_name,
        )

        # invocation_context mock（工具函数读 .agent_name / .user_id）
        self.invocation_context = SimpleNamespace(
            agent_name=agent_name,
            user_id=user_id,
            session=self.session,
        )

    async def search_memory(self, query: str, **kwargs: Any) -> list[Any]:
        """ADK MemoryService.search_memory mock——eval 中返回空（不依赖真实记忆系统）。"""
        return []

    @property
    def user_content(self) -> Any:
        """ADK user_content mock——eval 中无用户消息。"""
        return None

    def __repr__(self) -> str:
        return f"EvalToolContext(agent={self._agent_name}, user={self._user_id})"


__all__ = ["EvalToolContext"]
