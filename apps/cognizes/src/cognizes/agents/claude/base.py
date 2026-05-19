"""Base Agent class for Claude Agent SDK implementation."""

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Agent 基类，定义统一接口."""

    def __init__(self, name: str, config: dict[str, Any] | None = None):
        """初始化 Agent.

        Args:
            name: Agent 名称
            config: Agent 配置参数
        """
        self.name = name
        self.config = config or {}
        self._skills_cache: dict[str, Any] = {}
        logger.info(f"Initialized {self.name} agent with config: {self.config}")

    @abstractmethod
    async def process(self, input_data: dict[str, Any]) -> dict[str, Any]:
        """基础处理方法，子类必须实现.

        Args:
            input_data: 输入数据

        Returns:
            处理结果字典，包含 success、data 等字段
        """
        pass

    async def call_skill(self, skill_name: str, params: dict[str, Any]) -> dict[str, Any]:
        """调用 Claude Skill.

        Args:
            skill_name: Skill 名称
            params: Skill 参数

        Returns:
            Skill 调用结果
        """
        try:
            # Use fallback implementation to avoid JSON schema compatibility issues
            # The official SDK has issues with jsonschema draft-03
            logger.info(f"Using fallback skill implementation for {skill_name}")
            from .skills import SkillInvoker

            invoker = SkillInvoker()
            return await invoker.call_skill(skill_name, params)

            # SDK import commented out to avoid JSON schema errors
            # If SDK features are needed in the future, ensure jsonschema compatibility
            # try:
            #     from claude_agent_sdk.tools import Skill
            #     result = await Skill(skill_name, params)
            #     return {"success": True, "data": result}
            # except ImportError:
            #     # Fallback to our implementation
            #     logger.info(f"Using fallback skill implementation for {skill_name}")
            #     from .skills import SkillInvoker
            #     invoker = SkillInvoker()
            #     return await invoker.call_skill(skill_name, params)
        except Exception as e:
            logger.error(f"Error calling skill {skill_name}: {str(e)}")
            return {"success": False, "error": str(e)}

    async def batch_call_skill(self, calls: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """批量调用 Skills，提高并发性能.

        Args:
            calls: 调用列表，每个元素包含 skill 和 params 字段

        Returns:
            批量调用结果列表
        """
        tasks = [self.call_skill(call["skill"], call["params"]) for call in calls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Convert any exceptions to error dictionaries
        processed_results: list[dict[str, Any]] = []
        for result in results:
            if isinstance(result, Exception):
                processed_results.append({"success": False, "error": str(result)})
            elif isinstance(result, dict):
                processed_results.append(result)
            else:
                processed_results.append(
                    {
                        "success": False,
                        "error": f"Unexpected result type: {type(result)}",
                    }
                )

        return processed_results

    async def validate_input(self, input_data: dict[str, Any]) -> bool:
        """验证输入数据.

        Args:
            input_data: 输入数据

        Returns:
            验证是否通过
        """
        return isinstance(input_data, dict)

    async def log_processing(self, input_data: dict[str, Any], output_data: dict[str, Any]) -> None:
        """记录处理日志.

        Args:
            input_data: 输入数据
            output_data: 输出数据
        """
        logger.info(f"{self.name} processed: {input_data} -> {output_data.get('success', False)}")
