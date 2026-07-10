"""Definition 适配器注册中心。

职责（机制与策略分离）：
- **机制**（本模块）：把整段源文本按 ``format`` 解析为顶层对象（YAML mapping /
  Markdown frontmatter + body），计算校验和，抽取通用元信息。
- **策略**（各 kind 适配器，Phase 1..4 分别注册）：对解析结果做**领域校验**
  （复用现有 ``_coerce_template`` / ``_coerce_preset`` 等），并可覆写元信息抽取。

写库（create/update）前统一调用 :func:`parse_definition` 做服务端校验：解析或校验
失败即抛 :class:`DefinitionParseError`（API 层映射为 422，拒绝落库脏定义）。
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from typing import Any

import yaml

# ── 校验器 / 元信息提取器注册表（kind -> callable）───────────────────
# validator(raw_obj, source) -> None，非法时 raise DefinitionParseError。
_VALIDATORS: dict[str, Callable[[Any, str], None]] = {}
# extractor(raw_obj, body) -> dict，覆写通用元信息抽取。
_META_EXTRACTORS: dict[str, Callable[[Any, str], dict[str, Any]]] = {}

_ADAPTERS_LOADED = False


class DefinitionParseError(ValueError):
    """定义源解析 / 领域校验失败（API 层映射为 HTTP 422）。"""


def register_validator(kind: str, fn: Callable[[Any, str], None]) -> None:
    _VALIDATORS[kind] = fn


def register_meta_extractor(kind: str, fn: Callable[[Any, str], dict[str, Any]]) -> None:
    _META_EXTRACTORS[kind] = fn


def compute_checksum(source: str) -> str:
    """sha256(source) —— 物化器据此跳过未变行、前端据此判定 dirty。"""
    return hashlib.sha256((source or "").encode("utf-8")).hexdigest()


def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """解析 ``---\\n<yaml>\\n---\\n<body>`` 形式的 Markdown frontmatter。

    无 frontmatter 时返回 ``({}, text)``；frontmatter 非 mapping 时返回 ``({}, text)``
    交由上层判定。健壮处理 CRLF 与首行空白。
    """
    if not text:
        return {}, ""
    stripped = text.lstrip("﻿")  # 去 BOM
    if not stripped.startswith("---"):
        return {}, text
    # 以行为单位定位第二个 '---' 分隔符
    lines = stripped.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text
    end_idx: int | None = None
    for i in range(1, len(lines)):
        if lines[i].strip() in ("---", "..."):
            end_idx = i
            break
    if end_idx is None:
        return {}, text
    fm_block = "\n".join(lines[1:end_idx])
    body = "\n".join(lines[end_idx + 1 :])
    try:
        fm = yaml.safe_load(fm_block) or {}
    except yaml.YAMLError:
        return {}, text
    if not isinstance(fm, dict):
        return {}, text
    return fm, body


def _ensure_adapters_loaded() -> None:
    """惰性导入各 kind 适配器模块，触发其 ``register_*`` 副作用。

    放在首次 parse 时执行，避免 import 期循环依赖；各阶段落地后在此追加导入。
    单个适配器导入失败仅降级为「无领域校验」，不阻断通用解析。
    """
    global _ADAPTERS_LOADED
    if _ADAPTERS_LOADED:
        return
    _ADAPTERS_LOADED = True
    # 各 kind 适配器在此惰性 import（import 即触发 register_*）。单个失败仅降级为
    # 「无领域校验」（走通用解析），不阻断其他 kind。
    for mod in (
        "negentropy.agents.skill_templates",  # Phase 1: skill_template
        # "negentropy.agents.routine_presets",  # Phase 2: routine_preset
        # "negentropy.agents.definitions.harness_materializer",  # Phase 3: harness_skill
        # "negentropy.agents.definitions.agent_factory",  # Phase 4: agent
    ):
        try:
            __import__(mod)
        except Exception:  # pragma: no cover — 适配器缺失/导入失败降级为无领域校验
            pass


def _generic_meta(raw: dict[str, Any], body: str) -> dict[str, Any]:
    """通用元信息抽取：从常见键位取列表 / 筛选所需的最小子集。"""
    meta: dict[str, Any] = {}
    for k in ("name", "display_name", "description", "category", "version"):
        v = raw.get(k)
        if v is not None:
            meta[k] = v
    for flag in ("is_global", "is_enabled", "enabled", "visibility", "enforcement_mode", "priority"):
        if flag in raw:
            meta[flag] = raw[flag]
    return meta


def parse_definition(kind: str, fmt: str, source: str) -> dict[str, Any]:
    """解析 + 领域校验，返回派生元信息（写库时回填 ``meta``）。

    Raises:
        DefinitionParseError: 格式非法 / 顶层非 mapping / 领域校验失败。
    """
    _ensure_adapters_loaded()

    if fmt == "yaml":
        try:
            raw = yaml.safe_load(source or "")
        except yaml.YAMLError as exc:
            raise DefinitionParseError(f"YAML 解析失败：{exc}") from exc
        if raw is None:
            raise DefinitionParseError("定义源为空")
        if not isinstance(raw, dict):
            raise DefinitionParseError("定义源顶层必须是 mapping / 对象")
        body = ""
    elif fmt == "markdown":
        raw, body = parse_frontmatter(source or "")
        if not isinstance(raw, dict) or not raw:
            raise DefinitionParseError("Markdown 定义源缺少合法 YAML frontmatter")
    else:
        raise DefinitionParseError(f"不支持的 format：{fmt}")

    validator = _VALIDATORS.get(kind)
    if validator is not None:
        validator(raw, source)  # 非法时抛 DefinitionParseError

    extractor = _META_EXTRACTORS.get(kind)
    return extractor(raw, body) if extractor is not None else _generic_meta(raw, body)
