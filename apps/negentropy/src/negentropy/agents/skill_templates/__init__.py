"""
Skill Templates 包 — 内置 Skill 模板加载器（DB 为源）。

设计目标（Phase 1）：
- 定义源 SSOT 收敛到 ``negentropy.definitions``（kind=skill_template），整段 YAML 入库、
  界面表单编辑器维护；原 ``skill_templates/*.yaml`` 文件已删除。
- ``load_all()`` 由「glob 目录」改为「查 DB 行 + 跑现有 ``_coerce_template``」——
  ``SkillTemplate`` dataclass 与校验逻辑保持不变，下游 ``GET /interface/skills/templates``
  / ``POST /interface/skills/from-template`` 透明生效。
- 向 Definition Registry 注册 ``skill_template`` 的校验器/元信息提取器，使经表单
  create/update 时做服务端校验（非法源 422 不落库）。

参考文献：
[1] OpenAI, "Codex Skills: Manifest, Scripts, and Assets," *OpenAI Developers
    Documentation*, 2026.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import yaml
from packaging.version import InvalidVersion, Version

from negentropy.agents.definitions import (
    DefinitionParseError,
    register_meta_extractor,
    register_validator,
)
from negentropy.logging import get_logger

_logger = get_logger("negentropy.agents.skill_templates")

_KIND = "skill_template"

_REQUIRED_FIELDS = ("template_id", "name", "category", "version")

_META_KEYS = (
    "name",
    "display_name",
    "description",
    "category",
    "version",
    "is_global",
    "visibility",
    "enforcement_mode",
    "priority",
)


@dataclass(frozen=True)
class SkillTemplate:
    """加载后的 Skill 模板。"""

    template_id: str
    name: str
    display_name: str | None
    description: str | None
    category: str
    version: str
    visibility: str
    priority: int
    enforcement_mode: str
    prompt_template: str | None
    config_schema: dict[str, Any]
    default_config: dict[str, Any]
    required_tools: list[str]
    resources: list[dict[str, Any]] = field(default_factory=list)
    # 全局技能：模板物化为 Skill 行时落库 ``is_global``（详见 models/skill.py）。
    is_global: bool = False


def _coerce_template(raw: dict[str, Any]) -> SkillTemplate | None:
    """字段校验 + 默认值合并；失败返回 None。"""
    missing = [k for k in _REQUIRED_FIELDS if not raw.get(k)]
    if missing:
        _logger.warning("skill_template_missing_fields", missing=missing)
        return None

    version_str = str(raw.get("version") or "")
    try:
        Version(version_str)
    except InvalidVersion:
        _logger.warning("skill_template_invalid_semver", template_id=raw.get("template_id"), version=version_str)
        return None

    enforcement = str(raw.get("enforcement_mode") or "warning")
    if enforcement not in ("warning", "strict"):
        _logger.warning("skill_template_invalid_enforcement", template_id=raw.get("template_id"), value=enforcement)
        enforcement = "warning"

    visibility = str(raw.get("visibility") or "private")
    if visibility not in ("private", "shared", "public"):
        _logger.warning("skill_template_invalid_visibility", template_id=raw.get("template_id"), value=visibility)
        visibility = "private"

    return SkillTemplate(
        template_id=str(raw["template_id"]).strip(),
        name=str(raw["name"]).strip(),
        display_name=raw.get("display_name") or None,
        description=raw.get("description") or None,
        category=str(raw["category"]).strip(),
        version=version_str,
        visibility=visibility,
        priority=int(raw.get("priority") or 0),
        enforcement_mode=enforcement,
        prompt_template=raw.get("prompt_template"),
        config_schema=raw.get("config_schema") or {},
        default_config=raw.get("default_config") or {},
        required_tools=list(raw.get("required_tools") or []),
        resources=list(raw.get("resources") or []),
        is_global=bool(raw.get("is_global") or False),
    )


# ── Definition Registry 适配器（校验器 / 元信息）─────────────────────


def _validate(raw: Any, source: str) -> None:
    """经表单 create/update 时的服务端硬校验（映射为 422）。

    与 ``_coerce_template`` 一致的必填 + SemVer 硬约束；``enforcement_mode`` /
    ``visibility`` 非法值在 coerce 中软降级，非硬错误、不阻断保存。
    """
    if not isinstance(raw, dict):
        raise DefinitionParseError("Skill 模板源顶层必须是 mapping")
    missing = [k for k in _REQUIRED_FIELDS if not raw.get(k)]
    if missing:
        raise DefinitionParseError(f"Skill 模板缺少必填字段: {', '.join(missing)}")
    version_str = str(raw.get("version") or "")
    try:
        Version(version_str)
    except InvalidVersion as exc:
        raise DefinitionParseError(f"Skill 模板 version 非合法 SemVer: {version_str!r}") from exc


def _meta(raw: Any, body: str) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    return {k: raw[k] for k in _META_KEYS if k in raw}


register_validator(_KIND, _validate)
register_meta_extractor(_KIND, _meta)


async def load_all() -> list[SkillTemplate]:
    """查 ``definitions(kind=skill_template, is_enabled)`` 行，逐一解析为 ``SkillTemplate``。

    单行解析失败 → warning 并跳过；不冒泡到调用方（与原文件加载语义一致）。
    """
    from sqlalchemy import select

    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.definition import Definition

    templates: list[SkillTemplate] = []
    async with AsyncSessionLocal() as db:
        rows = (
            (
                await db.execute(
                    select(Definition)
                    .where(Definition.kind == _KIND, Definition.is_enabled.is_(True))
                    .order_by(Definition.sort_order, Definition.key)
                )
            )
            .scalars()
            .all()
        )
    for row in rows:
        try:
            raw = yaml.safe_load(row.source)
        except yaml.YAMLError as exc:
            _logger.warning("skill_template_yaml_error", key=row.key, error=str(exc))
            continue
        if not isinstance(raw, dict):
            _logger.warning("skill_template_not_mapping", key=row.key)
            continue
        coerced = _coerce_template(raw)
        if coerced is not None:
            templates.append(coerced)
    return templates


__all__ = ["SkillTemplate", "load_all"]
