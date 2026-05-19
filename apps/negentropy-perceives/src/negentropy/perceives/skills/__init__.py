"""Skills 适配层: AI Agent 可调用的组合技能。

提供技能注册、发现和执行机制。
"""

from ._base import Skill, SkillMetadata
from ._registry import get_skill, list_skills, register_skill

# 触发技能注册
from . import definitions as _definitions  # noqa: F401

__all__ = [
    "Skill",
    "SkillMetadata",
    "get_skill",
    "list_skills",
    "register_skill",
]
