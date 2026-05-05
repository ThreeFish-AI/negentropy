"""
Skill Templates 包 — 内置 Skill 模板加载器

设计目标：
- 用 YAML 文件作为模板分发载体（每个文件一个 Skill）；
- 加载时进行字段完整性 + SemVer 合法性校验，失败仅 warning 跳过；
- 通过 ``GET /interface/skills/templates`` 暴露给前端，``POST
  /interface/skills/from-template`` 把模板物化为用户的 Skill 行。

参考文献：
[1] OpenAI, "Codex Skills: Manifest, Scripts, and Assets," *OpenAI Developers
    Documentation*, 2026.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from packaging.version import InvalidVersion, Version

from negentropy.logging import get_logger

_logger = get_logger("negentropy.agents.skill_templates")

_TEMPLATES_DIR = Path(__file__).parent

_REQUIRED_FIELDS = ("template_id", "name", "category", "version")


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
    )


def load_all() -> list[SkillTemplate]:
    """扫描同目录下所有 ``*.yaml`` 文件，逐一解析为 ``SkillTemplate``。

    单个文件失败 → warning 并跳过；不冒泡到调用方。
    """
    templates: list[SkillTemplate] = []
    for path in sorted(_TEMPLATES_DIR.glob("*.yaml")):
        try:
            raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            _logger.warning("skill_template_yaml_error", path=str(path), error=str(exc))
            continue
        if not isinstance(raw, dict):
            _logger.warning("skill_template_not_mapping", path=str(path))
            continue
        coerced = _coerce_template(raw)
        if coerced is not None:
            templates.append(coerced)
    return templates


__all__ = ["SkillTemplate", "load_all"]
