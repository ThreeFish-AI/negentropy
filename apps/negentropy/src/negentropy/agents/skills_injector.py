"""
Skills → SubAgent system prompt injector — Progressive Disclosure 最小闭环。

设计目标（对齐 Anthropic Claude Skills / Google ADK Skills / OpenAI Codex Skills）：

- **Layer 1（描述常驻）**：把 SubAgent 关联的每个 Skill 的 `name + description`（短）
  注入到系统 prompt 顶部 `<available_skills>` 块，让 LLM 在所有调用中都能"看见"
  自己拥有哪些技能；
- **Layer 2（模板按需）**：当 LLM 决定调用某个 Skill 时，触发器（未来扩展）调用
  ``format_skill_invocation`` 把完整 ``prompt_template`` 展开返回——避免长模板常驻
  挤占上下文窗口；
- **Tool 白名单 fail-soft**：``validate_required_tools`` 返回缺失工具列表，仅供
  warning 与 UI 提示；不阻断 SubAgent 启动（fail-close 留待后续 Phase）。

不引入新表、不改 schema、不要求 SKILL.md 文件系统；只把已有 ``skills.prompt_template``
等四字段从"存而不用"升级为"按层级消费"。
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import or_, select

from negentropy.logging import get_logger
from negentropy.models.plugin_common import PluginVisibility
from negentropy.models.skill import Skill

_logger = get_logger("negentropy.agents.skills_injector")

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)


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
    # 同时记录 name 与 id：refs 既可能写 name 也可能写 UUID；后续 unresolved 减法
    # 必须把两种引用形态都消掉，否则被权限过滤掉的 Skill 会因 UUID 没被匹配
    # 而再次落入 info 级别的 unresolved 日志，破坏「不同原因走不同级别」的诊断意图。
    permission_filtered_names: list[str] = []
    permission_filtered_ids: set[str] = set()
    for skill in rows:
        # 权限过滤：owner 全可见；其它仅 PUBLIC（SHARED 需要授权表，简化为不可见）。
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
            )
        )

    if permission_filtered_names:
        # 比 unresolved 更严重：用户明确写了名字、Skill 也存在，只是当前 owner 看不到。
        # 升到 warning 级别，便于 ops 在排查 SubAgent prompt 缺 Skills 时一眼定位。
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

    格式约定：
    - 空列表 → 空字符串（便于直接 string concat）；
    - 每个 Skill 一行：``- {name}: {description or display_name or "(no description)"}``；
    - 块前后用 XML 风格标签包裹，便于 LLM 主动识别可用 Skill 集合。
    """
    if not skills:
        return ""
    lines = ["<available_skills>"]
    for s in skills:
        desc = s.description or s.display_name or "(no description)"
        lines.append(f"- {s.name}: {desc}")
    lines.append("</available_skills>")
    return "\n".join(lines)


def format_skill_invocation(skill: ResolvedSkill) -> str:
    """生成单个 Skill 的完整调用模板（Layer 2 — 模板按需）。

    供未来"用户/LLM 选择某个 Skill 后展开完整 prompt_template"的触发器使用；
    当前 Phase 仅暴露接口，未在 instruction provider 中调用。
    """
    if not skill.prompt_template:
        return ""
    return f'<skill name="{skill.name}">\n{skill.prompt_template}\n</skill>'


def validate_required_tools(
    skill: ResolvedSkill,
    agent_tools: Iterable[str] | None,
) -> list[str]:
    """返回 ``skill.required_tools`` 中不在 ``agent_tools`` 内的元素。

    - 仅做集合差；不区分 MCP / 内置工具命名空间；
    - 调用方使用：UI 红色 warning + 后端启动时记录 ``log.info`` 即可，**禁止 fail-close**
      （Phase 1 的最小可用原则；Phase 2 可升级为强校验并阻塞 SubAgent 启用）。
    """
    if not skill.required_tools:
        return []
    available = set(agent_tools or [])
    return [t for t in skill.required_tools if t not in available]


def build_progressive_disclosure_prompt(
    base_prompt: str | None,
    skills: list[ResolvedSkill],
) -> str:
    """把 ``base_prompt`` 与 ``<available_skills>`` 块拼接为最终 instruction。

    - skills 为空 → 直接返回 ``base_prompt or ""``；
    - skills 块插入到 ``base_prompt`` **之后**（紧贴主指令尾部，距离意图最近）；
    - 拼接前后保留单个换行，避免 prompt 内多余空行。
    """
    block = format_skills_block(skills)
    base = (base_prompt or "").rstrip()
    if not block:
        return base
    if not base:
        return block
    return f"{base}\n\n{block}"
