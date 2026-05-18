"""技能注册与发现机制。"""

from __future__ import annotations

from typing import Type

from ._base import Skill, SkillMetadata

_SKILL_REGISTRY: dict[str, Type[Skill]] = {}


def register_skill(cls: Type[Skill]) -> Type[Skill]:
    """类装饰器: 注册技能到全局注册表。"""
    meta = cls.metadata()
    _SKILL_REGISTRY[meta.name] = cls
    return cls


def get_skill(name: str) -> Type[Skill]:
    """按名称获取技能类。"""
    if name not in _SKILL_REGISTRY:
        available = sorted(_SKILL_REGISTRY.keys())
        raise ValueError(f"Unknown skill: '{name}'. Available: {available}")
    return _SKILL_REGISTRY[name]


def list_skills() -> dict[str, SkillMetadata]:
    """列出所有已注册技能的元数据。"""
    return {name: cls.metadata() for name, cls in _SKILL_REGISTRY.items()}
