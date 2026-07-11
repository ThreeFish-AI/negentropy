"""
Routine Presets 加载器 — 单元测试。

覆盖：
1. 内置 4 个预设（DB, kind=routine_preset）能被 ``load_all()`` 加载并命中关键字段；
2. SemVer 校验：非法版本号被跳过且不冒泡；
3. approval_mode 非法值被跳过；
4. 缺失必填字段时整个预设被丢弃。

注：Phase 2 后 ``load_all()`` 从 DB（``definitions``）读取（原 ``routine_presets/*.yaml`` 已删除），
故 (1) 依赖 conftest 的 ``upgrade head``（迁移 0097 已播种 4 个内置预设）；(2)(3)(4) 为
``_coerce_preset`` 纯单元测试。
"""

from __future__ import annotations

from negentropy.agents.routine_presets import RoutinePreset, _coerce_preset, load_all


async def test_load_all_includes_builtin_presets():
    presets = await load_all()
    assert presets, "至少应该加载到内置 routine_preset 定义源（DB 播种）"
    by_id = {p.preset_id: p for p in presets}
    for pid in ("code_quality_audit", "documentation_enhancement", "preening_substrate", "test_enhancement"):
        assert pid in by_id, f"missing builtin preset: {pid}"
    preening = by_id["preening_substrate"]
    assert preening.category == "architecture"
    assert preening.approval_mode == "first"
    assert preening.max_iterations == 20
    assert preening.goal  # 预填字段非空
    assert preening.acceptance_criteria


def test_coerce_preset_invalid_semver_returns_none():
    raw = {
        "preset_id": "bad",
        "display_name": "Bad",
        "description": "d",
        "category": "x",
        "version": "not-a-version",
        "goal": "g",
        "acceptance_criteria": "ac",
    }
    assert _coerce_preset(raw) is None


def test_coerce_preset_invalid_approval_mode_returns_none():
    raw = {
        "preset_id": "weird",
        "display_name": "Weird",
        "description": "d",
        "category": "x",
        "version": "1.0.0",
        "goal": "g",
        "acceptance_criteria": "ac",
        "approval_mode": "never",
    }
    assert _coerce_preset(raw) is None


def test_coerce_preset_missing_required_field_returns_none():
    raw = {
        "preset_id": "missing",
        "display_name": "Missing",
        "category": "x",
        "version": "1.0.0",
    }  # no description / goal / acceptance_criteria
    assert _coerce_preset(raw) is None


def test_coerce_preset_strips_and_defaults():
    raw = {
        "preset_id": " ok ",
        "display_name": "OK",
        "description": "d",
        "category": "x",
        "version": "1.0.0",
        "goal": "g",
        "acceptance_criteria": "ac",
    }
    coerced = _coerce_preset(raw)
    assert isinstance(coerced, RoutinePreset)
    assert coerced.preset_id == "ok"
    assert coerced.approval_mode == "auto"  # default
    assert coerced.success_score_threshold == 85
    assert coerced.title == "OK"  # falls back to display_name
