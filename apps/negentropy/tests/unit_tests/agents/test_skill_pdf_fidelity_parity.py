"""SKILL.md ↔ skill_template 定义源（DB） pdf_fidelity_restore 双 SSOT 骨架一致性守卫。

两 twin（文件技能 ``.agent/skills/pdf-fidelity-restore/SKILL.md`` 供 Routine 的 Claude Code；
DB 定义源 ``definitions(kind=skill_template, key=pdf_fidelity_restore)`` 供一核五翼）正文骨架须
保持一致。Phase 1 后 skill_template 源已入库（原 YAML 文件删除），故 YAML 侧经
``load_all()`` 从 DB 读取。本测试断言共享章节头 + R10 关键约束子串 + 8 项校验维度在两处
**同时存在**，防止改一处漏改另一处的静默漂移。
"""

from __future__ import annotations

from pathlib import Path

from negentropy.agents.skill_templates import load_all

# 本文件：apps/negentropy/tests/unit_tests/agents/ → parents[5] = 仓库根
_REPO_ROOT = Path(__file__).resolve().parents[5]
_SKILL_MD = _REPO_ROOT / ".agent/skills/pdf-fidelity-restore/SKILL.md"


async def _yaml_prompt_template() -> str:
    tpl = {t.template_id: t for t in await load_all()}["pdf_fidelity_restore"]
    return tpl.prompt_template or ""


def test_skill_md_file_exists():
    assert _SKILL_MD.exists(), f"SKILL.md not found at {_SKILL_MD}"


async def test_twin_shared_section_headers():
    """共享章节头须同时存在于两 twin（骨架一致）。"""
    md = _SKILL_MD.read_text(encoding="utf-8")
    body = await _yaml_prompt_template()
    for header in (
        "## 输入",
        "## 一比一还原范围",
        "## 流程",
        "## 关键洞察",
        "## 反模式",
        "## 完成判据",
        "## 资源",
    ):
        assert header in md, f"SKILL.md missing header {header}"
        assert header in body, f"YAML prompt_template missing header {header}"


async def test_twin_r10_constraints_present_in_both():
    """R10 沉淀的关键约束子串须同时存在于两 twin（改一处漏另一处即红）。"""
    md = _SKILL_MD.read_text(encoding="utf-8")
    body = await _yaml_prompt_template()
    for needle in ("热更", ".batch_state", "figcaption", "浏览器渲染态", "slice_index"):
        assert needle in md, f"SKILL.md missing R10 constraint: {needle}"
        assert needle in body, f"YAML prompt_template missing R10 constraint: {needle}"


async def test_twin_fidelity_dimensions_present_in_both():
    """一比一还原的 8 项维度须同时存在于两 twin。"""
    md = _SKILL_MD.read_text(encoding="utf-8")
    body = await _yaml_prompt_template()
    for dim in ("段落顺序", "图片显示尺寸", "目录", "表格", "数学公式", "代码块", "脚注"):
        assert dim in md, f"SKILL.md missing dimension: {dim}"
        assert dim in body, f"YAML prompt_template missing dimension: {dim}"


async def test_yaml_version_bumped_and_perceives_link_fixed():
    """version 升到 1.2.0（三杠杆改造），且 perceives 资源指针修死链→monorepo 子树。"""
    tpl = {t.template_id: t for t in await load_all()}["pdf_fidelity_restore"]
    assert tpl.version == "1.2.0"
    refs = " ".join(str(r.get("ref", "")) for r in tpl.resources)
    assert "github.com/negentropy/negentropy-perceives" not in refs  # 旧死链已移除
    assert "ThreeFish-AI/negentropy" in refs  # 指向真实 monorepo
