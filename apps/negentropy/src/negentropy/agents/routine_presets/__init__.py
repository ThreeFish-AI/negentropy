"""
Routine Presets 包 — 内置 Routine 预设模版加载器

设计目标：
- 用 YAML 文件作为预设分发载体（每个文件一个模版）；
- 加载时进行字段完整性 + SemVer 合法性 + approval_mode 合法性校验，失败仅 warning 跳过；
- 经合并端点 ``GET /routines/templates`` 暴露给前端（与用户自建模板合并为统一列表），
  用户在前端 Templates 页选定模版后由 ``POST /routines`` 物化为自己的 Routine 行。

参考文献：
[1] 本模块对标 ``skill_templates/__init__.py`` 的加载器模式。
[2] Anthropic, "Building Effective Agents," *Anthropic Blog*, 2024.
    Evaluator-Optimizer 模式 + Command Gate 门控。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import yaml
from packaging.version import InvalidVersion, Version

from negentropy.logging import get_logger

_logger = get_logger("negentropy.agents.routine_presets")

_PRESETS_DIR = Path(__file__).parent

_REQUIRED_FIELDS = ("preset_id", "display_name", "description", "category", "version", "goal", "acceptance_criteria")

_VALID_APPROVAL_MODES: frozenset[str] = frozenset({"auto", "first", "every"})


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


def load_all() -> list[RoutinePreset]:
    """扫描同目录下所有 ``*.yaml`` 文件，逐一解析为 ``RoutinePreset``。

    单个文件失败 → warning 并跳过；不冒泡到调用方。
    """
    presets: list[RoutinePreset] = []
    for path in sorted(_PRESETS_DIR.glob("*.yaml")):
        try:
            raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            _logger.warning("routine_preset_yaml_error", path=str(path), error=str(exc))
            continue
        if not isinstance(raw, dict):
            _logger.warning("routine_preset_not_mapping", path=str(path))
            continue
        coerced = _coerce_preset(raw)
        if coerced is not None:
            presets.append(coerced)
    return presets


__all__ = ["RoutinePreset", "load_all"]
