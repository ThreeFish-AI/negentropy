"""Faculty Agent 工厂函数与单例导出。"""

from .action import action_agent, create_action_agent
from .contemplation import contemplation_agent, create_contemplation_agent
from .influence import create_influence_agent, influence_agent
from .internalization import create_internalization_agent, internalization_agent
from .perception import create_perception_agent, perception_agent

__all__ = [
    # 单例（供 root_agent 直接委派）
    "perception_agent",
    "internalization_agent",
    "contemplation_agent",
    "action_agent",
    "influence_agent",
    # 工厂函数（供流水线创建独立实例）
    "create_perception_agent",
    "create_internalization_agent",
    "create_contemplation_agent",
    "create_action_agent",
    "create_influence_agent",
]
