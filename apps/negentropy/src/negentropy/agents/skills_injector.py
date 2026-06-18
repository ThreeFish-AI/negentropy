"""
Skills → Agent system prompt injector — Progressive Disclosure 完整闭环。

设计目标（对齐 Anthropic Claude Skills / Google ADK Skills / OpenAI Codex Skills）：

- **Layer 1（描述常驻）**：把 Agent 关联的每个 Skill 的 ``name + description``（短）
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
import time
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


def _parse_skill_ref(ref: str) -> tuple[str, str]:
    """拆分 ``name@version_spec`` 为 (name, spec)；无 ``@`` 时 spec=``*``（最新）。

    支持的 spec 形态（与 packaging.specifiers.SpecifierSet 对齐）：
    - ``*``         任意版本（默认行为，等价于无 @）
    - ``1.0.0``     精确锁定（实际生成 ``==1.0.0`` 比对）
    - ``~1.0``      tilde range：>=1.0, <2.0
    - ``^1.0``      caret range：>=1.0, <2.0（npm 习惯，转 ~ 处理）
    - ``>=1.0,<2``  原生 specifier 字符串
    """
    text = (ref or "").strip()
    if not text:
        return "", "*"
    if "@" not in text:
        return text, "*"
    name, _, spec = text.rpartition("@")
    name = name.strip()
    spec = spec.strip() or "*"
    if not name:
        # 整段都在 @ 后（罕见误传），退化为最新
        return text.lstrip("@"), "*"
    return name, spec


# 全局共享 Jinja2 沙箱环境（参考 Anthropic 安全建议：禁用 autoescape，因 prompt 上下文非 HTML；
# StrictUndefined 让缺失变量直接抛错而非静默渲染为空，便于调试模板）
_JINJA_ENV = SandboxedEnvironment(autoescape=False, undefined=StrictUndefined)


class SkillToolMissingError(RuntimeError):
    """``enforcement_mode=strict`` 模式下缺失 ``required_tools`` 时抛出。

    被 ``model_resolver._load_subagent_row`` 捕获，当前 Agent 退化为无 system prompt
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

    - 同时支持字符串名（如 ``"arxiv-fetch"``）、``name@version_spec``（Phase 3）
      与 UUID；
    - 权限规则：``owner_id`` 拥有的 Skill 全可见；其它 Skill 仅当
      ``visibility == PUBLIC`` 时可见；
    - 仅返回 ``is_enabled=True`` 的 Skill；
    - **Phase 3 版本锚定**：当 ref 形如 ``name@1.0.0`` 时，Skill 加载后再去
      ``skill_versions`` 查匹配版本快照覆盖 ResolvedSkill 字段；找不到匹配
      → fail-soft warning + 退化为 Skill 当前字段（保持向后兼容）；
    - 任何异常 → 记录 warning 并跳过该条，不冒泡（fail-soft）。
    """
    if not skill_refs:
        return []

    raw_refs = [str(r).strip() for r in skill_refs if str(r).strip()]
    if not raw_refs:
        return []

    # 解析 name@spec：用 dict 记 lookup_key (name 或 UUID 字符串) → spec，便于后续按行匹配
    parsed_specs: dict[str, str] = {}
    for ref in raw_refs:
        name, spec = _parse_skill_ref(ref)
        # 同一 name 出现多次取最严格（保留最后一次写入即可，调用方常用单引用）
        parsed_specs[name] = spec

    uuid_refs: list[UUID] = []
    name_refs: list[str] = []
    for lookup in parsed_specs.keys():
        if _is_uuid(lookup):
            try:
                uuid_refs.append(UUID(lookup))
            except ValueError:
                name_refs.append(lookup)
        else:
            name_refs.append(lookup)

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
        # Phase 3：根据 parsed_specs 决定是否覆盖为历史快照。
        spec = parsed_specs.get(skill.name) or parsed_specs.get(str(skill.id)) or "*"
        snapshot = await _resolve_version_snapshot(session, skill, spec) if spec and spec != "*" else None
        if snapshot is not None:
            out.append(
                ResolvedSkill(
                    id=str(skill.id),
                    name=skill.name,
                    display_name=snapshot.get("display_name") or skill.display_name,
                    description=snapshot.get("description") or skill.description,
                    prompt_template=snapshot.get("prompt_template", skill.prompt_template),
                    required_tools=tuple(snapshot.get("required_tools") or []),
                    is_enabled=skill.is_enabled,
                    enforcement_mode=str(snapshot.get("enforcement_mode") or "warning") or "warning",
                    resources=tuple(snapshot.get("resources") or ()),
                )
            )
        else:
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

    # Phase 3: refs 已由 parsed_specs 替代；unresolved 比对仅用 parsed_specs.keys()
    # （即 lookup key 集合，name 或 UUID 字符串）。
    lookup_keys = set(parsed_specs.keys())
    if len(out) + len(permission_filtered_names) < len(lookup_keys):
        unresolved = (
            lookup_keys
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


async def _resolve_version_snapshot(session, skill: Skill, spec: str) -> dict[str, Any] | None:
    """按 SemVer spec 在 ``skill_versions`` 表查匹配快照（Phase 3）。

    支持的 spec 形态：
    - 精确 ``1.0.0`` → 视为 ``==1.0.0``
    - tilde ``~1.0`` → ``>=1.0,<2.0``
    - caret ``^1.0`` → ``>=1.0,<2.0``（npm 习惯）
    - 原生 specifier 字符串 ``>=1.0,<2``

    匹配失败 fail-soft：返回 None，调用方使用 Skill 当前字段。
    """
    if not spec or spec == "*":
        return None
    try:
        from packaging.specifiers import InvalidSpecifier, SpecifierSet
        from packaging.version import InvalidVersion, Version

        from negentropy.models.skill import SkillVersion

        # 归一化几种简写
        normalized = spec.strip()
        if normalized.startswith("~"):
            base = normalized[1:].strip()
            try:
                bv = Version(base)
                upper = f"{bv.major + 1}.0.0"
                normalized = f">={base},<{upper}"
            except InvalidVersion:
                normalized = f"=={base}"
        elif normalized.startswith("^"):
            base = normalized[1:].strip()
            try:
                bv = Version(base)
                upper = f"{bv.major + 1}.0.0"
                normalized = f">={base},<{upper}"
            except InvalidVersion:
                normalized = f"=={base}"
        elif "," not in normalized and not normalized.startswith((">", "<", "=", "!", "~")):
            normalized = f"=={normalized}"

        try:
            spec_set = SpecifierSet(normalized)
        except InvalidSpecifier:
            _logger.warning(
                "skill_version_invalid_spec",
                skill=skill.name,
                spec=spec,
            )
            return None

        rows = (await session.execute(select(SkillVersion).where(SkillVersion.skill_id == skill.id))).scalars().all()
        candidates: list[tuple[Version, dict[str, Any]]] = []
        for row in rows:
            try:
                v = Version(row.version)
            except InvalidVersion:
                continue
            if v in spec_set:
                candidates.append((v, dict(row.snapshot or {})))
        if not candidates:
            _logger.warning(
                "skill_version_no_match",
                skill=skill.name,
                spec=spec,
            )
            return None
        # 取 spec 范围内最大版本
        candidates.sort(key=lambda t: t[0], reverse=True)
        return candidates[0][1]
    except Exception as exc:
        _logger.warning(
            "skill_version_resolve_failed",
            skill=skill.name,
            spec=spec,
            error=str(exc),
        )
        return None


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


# =============================================================================
# 全局技能（is_global）— 全系统所有 Agent 自动注入
# =============================================================================
#
# 设计取舍（与「精准挂载某几个 Agent 的 skills 数组」对照）：
# - ``resolve_skills`` 只认 ``Agent.skills`` 显式引用，而 6 个内置 Agent 经
#   ``agent_presets._build_payload`` 硬编码 ``skills=[]`` 且会被 "Sync Negentropy"
#   覆盖；故引入 ``is_global`` 这条正交语义，在指令装配热路径统一并入，
#   覆盖一核五翼与**未来新增的任何 Agent**，无需逐 Agent 维护。
# - 双注入点且互斥：DB 命中走 ``model_resolver._load_subagent_row``（与显式技能
#   合并为单一 ``<available_skills>`` 块）；DB 未命中走 ``_dynamic_instruction``
#   fallback 路径（``append_global_skills_block`` 追加块）。二者按
#   ``resolve_subagent_instruction`` 是否返回 None 互斥，避免重复块。


# fallback 路径的全局技能块 60s TTL 缓存（与 model_resolver._CACHE_TTL 同量级），
# 避免每次 LLM 请求都查 DB。键固定（全局技能对 PUBLIC/system 是全员同一份）。
_GLOBAL_BLOCK_TTL = 60.0
_global_block_cache: dict[str, tuple[str, float]] = {}


async def resolve_global_skills(session, *, owner_id: str = "") -> list[ResolvedSkill]:
    """加载全系统「全局技能」(``is_global=True``)，供并入所有 Agent 的 Progressive Disclosure。

    与 ``resolve_skills`` 的差异：
    - 不按 ``Agent.skills`` ref 过滤，而是扫 ``is_enabled AND is_global``；
    - 可见性放宽为 ``visibility==PUBLIC`` 或 ``is_system`` 或 ``owner_id`` 匹配
      （全局技能本就面向全员，PUBLIC/system 为常态）；
    - **强制 ``enforcement_mode="warning"``**（安全不变量）：被注入到的 Agent 不一定
      具备 ``required_tools``，strict 会让其在 ``build_progressive_disclosure_prompt``
      抛 ``SkillToolMissingError`` 而退化为「无 system prompt」；全局技能以「可见即可用」
      为原则，缺工具仅记 warning，**永不阻塞任何 Agent 启动**；
    - 任何异常 → warning 日志 + 返回 ``[]``（fail-soft）。
    """
    try:
        stmt = select(Skill).where(Skill.is_enabled.is_(True)).where(Skill.is_global.is_(True))
        result = await session.execute(stmt)
        rows = result.scalars().all()
    except Exception as exc:  # pragma: no cover - DB 故障兜底
        _logger.warning("resolve_global_skills_failed", error=str(exc))
        return []

    out: list[ResolvedSkill] = []
    for skill in rows:
        visible = (
            skill.visibility == PluginVisibility.PUBLIC
            or bool(getattr(skill, "is_system", False))
            or (bool(owner_id) and skill.owner_id == owner_id)
        )
        if not visible:
            continue
        out.append(
            ResolvedSkill(
                id=str(skill.id),
                name=skill.name,
                display_name=skill.display_name,
                description=skill.description,
                prompt_template=skill.prompt_template,
                required_tools=tuple(skill.required_tools or []),
                is_enabled=skill.is_enabled,
                # 安全不变量：全局注入恒 warning，绝不因缺工具阻塞 Agent 启动。
                enforcement_mode="warning",
                resources=tuple(skill.resources or ()) if hasattr(skill, "resources") else (),
            )
        )
    return out


def merge_skills(*groups: Iterable[ResolvedSkill]) -> list[ResolvedSkill]:
    """按 ``name`` 去重合并多组 ResolvedSkill；先出现者优先（显式技能 > 全局技能）。"""
    seen: set[str] = set()
    merged: list[ResolvedSkill] = []
    for group in groups:
        for s in group:
            if s.name in seen:
                continue
            seen.add(s.name)
            merged.append(s)
    return merged


async def _get_global_skills_block_cached() -> str:
    """渲染全局技能 ``<available_skills>`` 块（PUBLIC/system 视角），带 60s TTL 缓存。"""
    now = time.monotonic()
    entry = _global_block_cache.get("public")
    if entry is not None and now - entry[1] < _GLOBAL_BLOCK_TTL:
        return entry[0]

    from negentropy.db.session import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            skills = await resolve_global_skills(session, owner_id="")
        block = format_skills_block(skills)
    except Exception as exc:  # pragma: no cover - DB 故障兜底
        _logger.warning("global_skills_block_failed", error=str(exc))
        block = ""
    _global_block_cache["public"] = (block, now)
    return block


async def append_global_skills_block(base_prompt: str | None) -> str:
    """把全局技能块追加到 ``base_prompt``（``_dynamic_instruction`` fallback 路径用）。

    用于 DB 未命中、Agent 指令回退到代码 fallback 时，仍让该 Agent 获得全局技能。
    与 DB 路径（``_load_subagent_row`` 合并注入）互斥：仅当上游 ``resolve_subagent_instruction``
    返回 ``None`` 时被调用。防御性地跳过「base 已含 ``<available_skills>`` 块」的异常情形，
    避免重复注入。
    """
    base = (base_prompt or "").rstrip()
    if "<available_skills>" in base:
        return base
    block = await _get_global_skills_block_cached()
    if not block:
        return base
    return f"{base}\n\n{block}" if base else block


def invalidate_global_skills_cache() -> None:
    """清空全局技能块缓存（Skill 写操作后由 API 调用，实现强一致）。"""
    _global_block_cache.clear()
