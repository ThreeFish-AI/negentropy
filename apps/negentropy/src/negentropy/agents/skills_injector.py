"""
Skills → SubAgent system prompt injector — Progressive Disclosure 完整闭环。

设计目标（对齐 Anthropic Claude Skills / Google ADK Skills / OpenAI Codex Skills）：

- **Layer 1（描述常驻）**：把 SubAgent 关联的每个 Skill 的 ``name + description``（短）
  注入到系统 prompt 顶部 ``<available_skills>`` 块，让 LLM 在所有调用中都能"看见"
  自己拥有哪些技能；如果有 ``resources``，仅展示数量提示，避免 prompt 膨胀。
- **Layer 2（模板按需）**：``format_skill_invocation`` 用 Jinja2 沙箱环境渲染
  ``prompt_template``，由 ``expand_skill`` ADK tool（详见 ``agents/tools/skill_registry.py``）
  或 ``POST /interface/skills/{id}:invoke`` 端点触发。
- **Layer 3（资源挂载）**：``format_skill_resources`` 把 ``resources`` 数组按 type 渲染
  为 markdown 列表；默认 ``lazy=True``，仅在 Layer 2 展开时一并附上。具体读取由
  ``fetch_skill_resource`` 工具按需路由到 KG / Memory / Knowledge corpus。
- **Tool 白名单 fail-close 选项**：``enforcement_mode=strict`` 时缺失工具会抛
  ``SkillToolMissingError``；``warning`` 模式（默认）保持向后兼容仅记录差异。

不引入新表；通过 PostgreSQL JSONB 增量字段（``enforcement_mode`` / ``resources``）
支撑 Phase 2 增强。
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from jinja2 import StrictUndefined, TemplateError
from jinja2.sandbox import SandboxedEnvironment
from sqlalchemy import or_, select

from negentropy.logging import get_logger
from negentropy.models.plugin_common import PluginVisibility
from negentropy.models.skill import Skill

_logger = get_logger("negentropy.agents.skills_injector")

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)

# 全局共享 Jinja2 沙箱环境（参考 Anthropic 安全建议：禁用 autoescape，因 prompt 上下文非 HTML；
# StrictUndefined 让缺失变量直接抛错而非静默渲染为空，便于调试模板）
_JINJA_ENV = SandboxedEnvironment(autoescape=False, undefined=StrictUndefined)


class SkillToolMissingError(RuntimeError):
    """``enforcement_mode=strict`` 模式下缺失 ``required_tools`` 时抛出。

    被 ``model_resolver._load_subagent_row`` 捕获，当前 SubAgent 退化为无 system prompt
    启动并记录 error 级别日志，避免"看似启动但工具不全"的隐性故障。
    """


@dataclass(frozen=True)
class ResolvedSkill:
    """Resolved Skill 的最小投影，避免对外暴露 ORM 实例与 session 绑定。"""

    id: str
    name: str
    display_name: str | None
    description: str | None
    prompt_template: str | None
    required_tools: tuple[str, ...]
    is_enabled: bool
    # Phase 2 新增字段：均给默认值以保持向后兼容（现有测试无需改动）
    enforcement_mode: str = "warning"
    resources: tuple[dict[str, Any], ...] = ()


def _is_uuid(value: str) -> bool:
    return bool(_UUID_RE.match(value.strip()))


async def resolve_skills(
    session,
    skill_refs: Iterable[str] | None,
    *,
    owner_id: str,
) -> list[ResolvedSkill]:
    """按 name 或 UUID 列表加载 Skills，并按所有权 / 可见性过滤。

    - 同时支持字符串名（如 ``"arxiv-fetch"``）和 UUID；
    - 权限规则：``owner_id`` 拥有的 Skill 全可见；其它 Skill 仅当
      ``visibility == PUBLIC`` 时可见；
    - 仅返回 ``is_enabled=True`` 的 Skill；
    - 任何异常 → 记录 warning 并跳过该条，不冒泡（fail-soft）。
    """
    if not skill_refs:
        return []

    refs = [str(r).strip() for r in skill_refs if str(r).strip()]
    if not refs:
        return []

    uuid_refs: list[UUID] = []
    name_refs: list[str] = []
    for ref in refs:
        if _is_uuid(ref):
            try:
                uuid_refs.append(UUID(ref))
            except ValueError:
                name_refs.append(ref)
        else:
            name_refs.append(ref)

    conditions = []
    if uuid_refs:
        conditions.append(Skill.id.in_(uuid_refs))
    if name_refs:
        conditions.append(Skill.name.in_(name_refs))
    if not conditions:
        return []

    stmt = select(Skill).where(or_(*conditions)).where(Skill.is_enabled.is_(True))
    result = await session.execute(stmt)
    rows = result.scalars().all()

    out: list[ResolvedSkill] = []
    seen: set = set()
    permission_filtered_names: list[str] = []
    permission_filtered_ids: set[str] = set()
    for skill in rows:
        if skill.owner_id != owner_id and skill.visibility != PluginVisibility.PUBLIC:
            permission_filtered_names.append(skill.name)
            permission_filtered_ids.add(str(skill.id))
            continue
        if skill.id in seen:
            continue
        seen.add(skill.id)
        out.append(
            ResolvedSkill(
                id=str(skill.id),
                name=skill.name,
                display_name=skill.display_name,
                description=skill.description,
                prompt_template=skill.prompt_template,
                required_tools=tuple(skill.required_tools or []),
                is_enabled=skill.is_enabled,
                enforcement_mode=getattr(skill, "enforcement_mode", "warning") or "warning",
                resources=tuple(skill.resources or ()) if hasattr(skill, "resources") else (),
            )
        )

    if permission_filtered_names:
        _logger.warning(
            "skills_injector_permission_filtered",
            owner_id=owner_id,
            filtered=sorted(permission_filtered_names),
        )

    if len(out) + len(permission_filtered_names) < len(refs):
        unresolved = (
            set(refs)
            - {s.name for s in out}
            - {s.id for s in out}
            - set(permission_filtered_names)
            - permission_filtered_ids
        )
        if unresolved:
            _logger.info(
                "skills_injector_unresolved_refs",
                owner_id=owner_id,
                missing=sorted(unresolved),
            )

    return out


def format_skills_block(skills: list[ResolvedSkill]) -> str:
    """生成 ``<available_skills>`` 块（Layer 1 — 描述常驻）。

    - 空列表 → 空字符串；
    - 每个 Skill 一行：``- {name}: {description}``；附带 ``[N resources]`` 后缀（如有）；
    - 末尾追加一行说明，告知 LLM 可通过 ``expand_skill(name)`` 工具获取完整模板。
    """
    if not skills:
        return ""
    lines = ["<available_skills>"]
    for s in skills:
        desc = s.description or s.display_name or "(no description)"
        suffix = f" [{len(s.resources)} resources]" if s.resources else ""
        lines.append(f"- {s.name}: {desc}{suffix}")
    lines.append("</available_skills>")
    lines.append("To use a skill, call expand_skill(name) to retrieve its full template.")
    return "\n".join(lines)


def format_skill_invocation(skill: ResolvedSkill, variables: dict[str, Any] | None = None) -> str:
    """生成单个 Skill 的完整调用模板（Layer 2 — 模板按需）。

    - 没有 ``prompt_template`` 时返回空字符串；
    - 用 Jinja2 沙箱环境渲染 ``prompt_template``，``variables`` 透传为模板变量；
    - 渲染失败 → 返回原始 ``prompt_template``（fail-soft，避免阻塞 LLM 决策），错误日志便于排查；
    - 末尾自动附上 ``format_skill_resources``（Layer 3 资源摘要）。
    """
    template = skill.prompt_template or ""
    if not template:
        return ""
    try:
        rendered = _JINJA_ENV.from_string(template).render(**(variables or {}))
    except TemplateError as exc:
        _logger.warning(
            "skill_template_render_failed",
            skill=skill.name,
            error=str(exc),
        )
        rendered = template

    resources_block = format_skill_resources(skill, eager=True)
    body = rendered if not resources_block else f"{rendered}\n\n{resources_block}"
    return f'<skill name="{skill.name}">\n{body}\n</skill>'


def format_skill_resources(skill: ResolvedSkill, *, eager: bool = False) -> str:
    """渲染 Skill 资源清单（Layer 3 — 轻量挂载）。

    - ``eager=False`` 时仅返回数量提示 ``[N resources attached]``，避免常驻 prompt 膨胀；
    - ``eager=True`` 时按 ``type/ref/title`` 列为 markdown bullets，由 ``expand_skill``
      或 ``fetch_skill_resource`` 调用方按需消费；
    - ``url`` 类型 **不直接 fetch**，仅传 URL 字符串，避免 SSRF。
    """
    if not skill.resources:
        return ""
    if not eager:
        return f"[{len(skill.resources)} resources attached]"
    lines = ["<skill_resources>"]
    for idx, item in enumerate(skill.resources):
        item_type = str(item.get("type") or "inline")
        ref = item.get("ref") or ""
        title = item.get("title") or ref or item_type
        lines.append(f"- [{idx}] {item_type}: {title} ({ref})")
    lines.append("</skill_resources>")
    return "\n".join(lines)


def validate_required_tools(
    skill: ResolvedSkill,
    agent_tools: Iterable[str] | None,
) -> list[str]:
    """返回 ``skill.required_tools`` 中不在 ``agent_tools`` 内的元素。

    集合差；调用方自行决定 warning vs strict 阻断。
    """
    if not skill.required_tools:
        return []
    available = set(agent_tools or [])
    return [t for t in skill.required_tools if t not in available]


def build_progressive_disclosure_prompt(
    base_prompt: str | None,
    skills: list[ResolvedSkill],
    *,
    agent_tools: Iterable[str] | None = None,
) -> str:
    """把 ``base_prompt`` 与 ``<available_skills>`` 块拼接为最终 instruction。

    - skills 为空 → 直接返回 ``base_prompt or ""``；
    - skills 块插入到 ``base_prompt`` 之后（紧贴主指令尾部，距离意图最近）；
    - 当 ``agent_tools`` 提供且某 Skill ``enforcement_mode=strict`` 缺失工具时，
      抛 ``SkillToolMissingError`` —— 由调用方决定降级或失败启动；
    - ``warning`` 模式只记录 info 日志，保持向后兼容。
    """
    if agent_tools is not None:
        tools_set = list(agent_tools)
        for s in skills:
            missing = validate_required_tools(s, tools_set)
            if not missing:
                continue
            if s.enforcement_mode == "strict":
                _logger.error(
                    "skill_tool_missing_strict",
                    skill=s.name,
                    missing=missing,
                )
                raise SkillToolMissingError(f"Skill '{s.name}' enforcement_mode=strict but missing tools: {missing}")
            _logger.info(
                "skill_tool_missing_warning",
                skill=s.name,
                missing=missing,
            )

    block = format_skills_block(skills)
    base = (base_prompt or "").rstrip()
    if not block:
        return base
    if not base:
        return block
    return f"{base}\n\n{block}"
