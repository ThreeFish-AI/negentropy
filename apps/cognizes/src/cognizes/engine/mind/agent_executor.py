"""
AgentExecutor: Agent 执行编排器 - 管理 Thought -> Action -> Observation 循环
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import AsyncGenerator


class ExecutionStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    MAX_STEPS_REACHED = "max_steps_reached"


@dataclass
class ThinkingStep:
    step_number: int
    thought: str
    action: str | None
    action_input: dict | None
    observation: str | None
    timestamp: datetime


@dataclass
class ExecutionResult:
    status: ExecutionStatus
    final_answer: str | None
    steps: list[ThinkingStep]
    total_duration_ms: float
    error: str | None = None


class AgentExecutor:
    def __init__(self, llm_client, tool_registry, *, max_steps: int = 10, timeout_seconds: float = 300.0):
        self._llm = llm_client
        self._tool_registry = tool_registry
        self._max_steps = max_steps
        self._timeout = timeout_seconds

    async def run(self, user_input: str, *, run_id: str | None = None) -> ExecutionResult:
        start_time = datetime.now()
        steps = []
        for step_num in range(1, self._max_steps + 1):
            # 检查超时
            if (datetime.now() - start_time).total_seconds() > self._timeout:
                return ExecutionResult(
                    ExecutionStatus.TIMEOUT,
                    None,
                    steps,
                    (datetime.now() - start_time).total_seconds() * 1000,
                    "Execution timeout",
                )
            # 调用 LLM
            llm_response = await self._llm.generate(user_input)  # 简化示例
            thought, action, action_input, is_final = self._parse_response(llm_response)

            step = ThinkingStep(step_num, thought, action, action_input, None, datetime.now())
            if is_final:
                steps.append(step)
                return ExecutionResult(
                    ExecutionStatus.COMPLETED, thought, steps, (datetime.now() - start_time).total_seconds() * 1000
                )
            if action:
                try:
                    observation = await self._tool_registry.invoke_tool(action, action_input or {}, run_id=run_id)
                    step.observation = str(observation)
                except Exception as e:
                    step.observation = f"Error: {e}"
            steps.append(step)

        return ExecutionResult(
            ExecutionStatus.MAX_STEPS_REACHED,
            None,
            steps,
            (datetime.now() - start_time).total_seconds() * 1000,
            f"Max steps ({self._max_steps}) reached",
        )

    def _parse_response(self, response: str) -> tuple[str, str | None, dict | None, bool]:
        if "Final Answer:" in response:
            return response.split("Final Answer:")[-1].strip(), None, None, True
        thought = action = None
        action_input = {}
        if "Thought:" in response:
            thought = response.split("Thought:")[-1].split("Action:")[0].strip()
        if "Action:" in response:
            action = response.split("Action:")[-1].split("Action Input:")[0].strip()
        return thought or "", action, action_input, False
