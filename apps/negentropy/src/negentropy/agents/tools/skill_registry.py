"""
Skill Registry Faculty Tools — Layer 2 按需展开触发器

为 ADK agent 提供两个工具：

- ``list_available_skills()``：兜底自校验，让 LLM 在任何时刻都能枚举当前 owner 可见的
  enabled Skills（即便注入器漏掉，也有最后一道补救）。
- ``expand_skill(name, variables)``：当 LLM 决定使用某个 Skill 时调用，服务器侧用
  Jinja2 沙箱环境渲染 ``prompt_template`` 并附上资源摘要 —— 这是 Progressive
  Disclosure 的完整闭环（Anthropic Claude Skills 与 Google ADK Skills 的核心思想）。

设计准则：
- **fail-soft**：任何异常都返回 ``{"error": ...}`` 字典，不抛给 LLM 作为 stack trace；
- **owner 视角**：从 ``tool_context`` 取 ``user_id``，不传则视为 ``anonymous``；
- **不直接执行 LLM**：仅把展开后的 prompt 文本返回，调用方自行决定如何消费。

参考文献：
[1] S. Yao et al., "ReAct: Synergizing Reasoning and Acting in Language Models,"
    *Proc. ICLR*, 2023.
[2] Anthropic, "Agent Skills: Progressive Disclosure," *Claude Code Documentation*, 2026.
"""

from __future__ import annotations

import os
from typing import Any

from google.adk.tools import ToolContext

import negentropy.db.session as db_session
from negentropy.agents.skills_injector import (
    format_skill_invocation,
    format_skill_resources,
    resolve_skills,
    validate_required_tools,
)
from negentropy.logging import get_logger

_logger = get_logger("negentropy.tools.skill_registry")


def _resolve_owner_id(tool_context: ToolContext | None) -> str:
    if tool_context is None:
        return "anonymous"
    invocation = getattr(tool_context, "invocation_context", None)
    if invocation is not None:
        user_id = getattr(invocation, "user_id", None)
        if user_id:
            return str(user_id)
    session = getattr(tool_context, "session", None)
    if session is not None:
        user_id = getattr(session, "user_id", None)
        if user_id:
            return str(user_id)
    return "anonymous"


def _layer2_disabled() -> bool:
    return os.environ.get("NEGENTROPY_SKILLS_LAYER2_ENABLED", "true").lower() in ("0", "false", "no")


async def list_available_skills(tool_context: ToolContext) -> dict[str, Any]:
    """枚举当前 owner 可见且已启用的 Skills（兜底自校验工具）。

    Returns:
        ``{"status": "success", "skills": [{"name", "description", "resources_count"}, ...]}``
    """
    if _layer2_disabled():
        return {"status": "disabled", "skills": []}

    owner_id = _resolve_owner_id(tool_context)
    try:
        async with db_session.AsyncSessionLocal() as session:
            from sqlalchemy import select

            from negentropy.models.plugin_common import PluginVisibility
            from negentropy.models.skill import Skill

            stmt = (
                select(Skill)
                .where(Skill.is_enabled.is_(True))
                .where((Skill.owner_id == owner_id) | (Skill.visibility == PluginVisibility.PUBLIC))
                .order_by(Skill.priority.desc(), Skill.created_at.desc())
            )
            result = await session.execute(stmt)
            rows = result.scalars().all()
        return {
            "status": "success",
            "skills": [
                {
                    "name": s.name,
                    "description": s.description or s.display_name or "",
                    "resources_count": len(s.resources or []) if hasattr(s, "resources") else 0,
                    "required_tools": list(s.required_tools or []),
                }
                for s in rows
            ],
        }
    except Exception as exc:
        _logger.warning("list_available_skills_failed", error=str(exc), owner_id=owner_id)
        return {"status": "failed", "error": str(exc), "skills": []}


async def expand_skill(
    name: str,
    tool_context: ToolContext,
    variables: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """按 name 加载 Skill 并展开 prompt_template（Layer 2 按需）。

    Args:
        name: Skill 名（不区分大小写不行；必须精确匹配）。
        variables: 渲染模板用的变量字典；缺失变量会触发 StrictUndefined 错误，由
            ``format_skill_invocation`` fail-soft 降级为返回原始模板。

    Returns:
        ``{"status": "success", "skill_name": ..., "prompt": ..., "resources": [...],
        "missing_tools": [...]}`` 或 ``{"status": "failed", "error": "..."}``。
    """
    if _layer2_disabled():
        return {"status": "disabled", "error": "Skills Layer 2 is disabled"}

    if not name or not isinstance(name, str):
        return {"status": "failed", "error": "skill name is required"}

    owner_id = _resolve_owner_id(tool_context)
    try:
        async with db_session.AsyncSessionLocal() as session:
            resolved = await resolve_skills(session, [name], owner_id=owner_id)
        if not resolved:
            return {"status": "failed", "error": "skill_not_found", "name": name}
        skill = resolved[0]
        if not skill.prompt_template and not skill.resources:
            return {
                "status": "empty",
                "skill_name": skill.name,
                "prompt": "",
                "resources": [],
                "missing_tools": [],
                "message": "Skill has no prompt_template or resources",
            }
        prompt = format_skill_invocation(skill, variables=variables or {})
        if not prompt:
            prompt = format_skill_resources(skill, eager=True)
        return {
            "status": "success",
            "skill_name": skill.name,
            "prompt": prompt,
            "resources": [dict(r) for r in skill.resources],
            "missing_tools": validate_required_tools(skill, agent_tools=None) if skill.required_tools else [],
        }
    except Exception as exc:
        _logger.warning("expand_skill_failed", name=name, owner_id=owner_id, error=str(exc))
        return {"status": "failed", "error": str(exc), "name": name}
