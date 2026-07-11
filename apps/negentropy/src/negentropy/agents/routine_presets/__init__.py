"""
Routine Presets 包 — 内置 Routine 预设模版加载器（DB 为源）。

设计目标（Phase 2）：
- 定义源 SSOT 收敛到 ``negentropy.definitions``（kind=routine_preset），整段 YAML 入库、
  界面表单编辑器维护；原 ``routine_presets/*.yaml`` 文件已删除。
- ``load_all()`` 由「glob 目录」改为「查 DB 行 + 跑现有 ``_coerce_preset``」——
  ``RoutinePreset`` dataclass 与校验逻辑保持不变，下游 ``GET /routines/templates``
  的 ``source=builtin`` 分支透明生效。
- 向 Definition Registry 注册 ``routine_preset`` 的校验器/元信息提取器，使经表单
  create/update 时做服务端校验（非法源 422 不落库）。

参考文献：
[1] 本模块对标 ``skill_templates/__init__.py`` 的加载器模式。
[2] Anthropic, "Building Effective Agents," *Anthropic Blog*, 2024.
    Evaluator-Optimizer 模式 + Command Gate 门控。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

import yaml
from packaging.version import InvalidVersion, Version

from negentropy.agents.definitions import (
    DefinitionParseError,
    register_meta_extractor,
    register_validator,
)
from negentropy.logging import get_logger

_logger = get_logger("negentropy.agents.routine_presets")

_KIND = "routine_preset"

_REQUIRED_FIELDS = ("preset_id", "display_name", "description", "category", "version", "goal", "acceptance_criteria")

_VALID_APPROVAL_MODES: frozenset[str] = frozenset({"auto", "first", "every"})

_META_KEYS = (
    "display_name",
    "description",
    "category",
    "version",
    "approval_mode",
)


@dataclass(frozen=True)
class RoutinePreset:
    """加载后的 Routine 预设。"""

    # ── 元信息 ──────────────────────────────────────────────
    preset_id: str
    display_name: str
    description: str
    category: str
    version: str
    features_showcase: list[str] = field(default_factory=list)

    # ── RoutineCreateRequest 预填字段 ────────────────────────
    title: str = ""
    goal: str = ""
    acceptance_criteria: str = ""
    verification_command: str | None = None
    max_iterations: int | None = None
    max_cost_usd: float | None = None
    success_score_threshold: int = 85
    no_progress_patience: int = 3
    approval_mode: Literal["auto", "first", "every"] = "auto"
    config: dict[str, Any] = field(default_factory=dict)


def _coerce_preset(raw: dict[str, Any]) -> RoutinePreset | None:
    """字段校验 + 默认值合并；失败返回 None。"""
    missing = [k for k in _REQUIRED_FIELDS if not raw.get(k)]
    if missing:
        _logger.warning("routine_preset_missing_fields", missing=missing)
        return None

    version_str = str(raw.get("version") or "")
    try:
        Version(version_str)
    except InvalidVersion:
        _logger.warning("routine_preset_invalid_semver", preset_id=raw.get("preset_id"), version=version_str)
        return None

    approval = str(raw.get("approval_mode") or "auto")
    if approval not in _VALID_APPROVAL_MODES:
        _logger.warning("routine_preset_invalid_approval_mode", preset_id=raw.get("preset_id"), value=approval)
        return None

    return RoutinePreset(
        preset_id=str(raw["preset_id"]).strip(),
        display_name=str(raw["display_name"]).strip(),
        description=str(raw["description"]).strip(),
        category=str(raw["category"]).strip(),
        version=version_str,
        features_showcase=list(raw.get("features_showcase") or []),
        title=str(raw.get("title") or raw["display_name"]).strip(),
        goal=str(raw.get("goal") or "").strip(),
        acceptance_criteria=str(raw.get("acceptance_criteria") or "").strip(),
        verification_command=raw.get("verification_command") or None,
        max_iterations=int(raw["max_iterations"]) if raw.get("max_iterations") is not None else None,
        max_cost_usd=float(raw["max_cost_usd"]) if raw.get("max_cost_usd") is not None else None,
        success_score_threshold=int(raw.get("success_score_threshold", 85)),
        no_progress_patience=int(raw.get("no_progress_patience", 3)),
        approval_mode=approval,  # type: ignore[arg-type]
        config=dict(raw.get("config") or {}),
    )


# ── Definition Registry 适配器（校验器 / 元信息）─────────────────────


def _validate(raw: Any, source: str) -> None:
    """经表单 create/update 时的服务端硬校验（映射为 422）。"""
    if not isinstance(raw, dict):
        raise DefinitionParseError("Routine 预设源顶层必须是 mapping")
    missing = [k for k in _REQUIRED_FIELDS if not raw.get(k)]
    if missing:
        raise DefinitionParseError(f"Routine 预设缺少必填字段: {', '.join(missing)}")
    version_str = str(raw.get("version") or "")
    try:
        Version(version_str)
    except InvalidVersion as exc:
        raise DefinitionParseError(f"Routine 预设 version 非合法 SemVer: {version_str!r}") from exc
    approval = str(raw.get("approval_mode") or "auto")
    if approval not in _VALID_APPROVAL_MODES:
        raise DefinitionParseError(f"Routine 预设 approval_mode 非法: {approval!r}（允许 auto/first/every）")


def _meta(raw: Any, body: str) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    return {k: raw[k] for k in _META_KEYS if k in raw}


register_validator(_KIND, _validate)
register_meta_extractor(_KIND, _meta)


async def load_all() -> list[RoutinePreset]:
    """查 ``definitions(kind=routine_preset, is_enabled)`` 行，逐一解析为 ``RoutinePreset``。

    单行解析失败 → warning 并跳过；不冒泡到调用方（与原文件加载语义一致）。
    """
    from sqlalchemy import select

    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.definition import Definition

    presets: list[RoutinePreset] = []
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
            _logger.warning("routine_preset_yaml_error", key=row.key, error=str(exc))
            continue
        if not isinstance(raw, dict):
            _logger.warning("routine_preset_not_mapping", key=row.key)
            continue
        coerced = _coerce_preset(raw)
        if coerced is not None:
            presets.append(coerced)
    return presets


__all__ = ["RoutinePreset", "load_all"]
