"""pdf_fidelity_restore 双 SSOT 骨架一致性守卫（skill_template ↔ harness_skill，均 DB）。

两 twin：
- ``definitions(kind=skill_template, key=pdf_fidelity_restore)`` —— 供一核五翼（runtime 注入）；
- ``definitions(kind=harness_skill, key=pdf-fidelity-restore)`` —— 供 Claude Code（渲染回
  ``.agent/skills/pdf-fidelity-restore/SKILL.md``）。
正文骨架须保持一致。Phase 1+3 后两侧均入库，本测试经 DB 读取两侧 source/prompt_template，
断言共享章节头 + R10 关键约束子串 + 8 项校验维度在两处**同时存在**，防止改一处漏改另一处。
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


async def _harness_skill_source() -> str:
    """读取 harness_skill DB 行（key=pdf-fidelity-restore）的整段 SKILL.md 源文本。

    AsyncSessionLocal 须在函数内惰性 import，以拾取 conftest ``patch_db_globals`` 的
    monkeypatch（模块顶层 ``from ... import`` 会绑定原始未 patch 的 session）。
    """
    from sqlalchemy import select

    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.definition import Definition

    async with AsyncSessionLocal() as db:
        row = (
            await db.execute(
                select(Definition).where(
                    Definition.kind == "harness_skill",
                    Definition.key == "pdf-fidelity-restore",
                )
            )
        ).scalar_one_or_none()
    return row.source if row is not None else ""


def test_skill_md_file_exists():
    """盘上 SKILL.md 是 harness_skill DB 行的渲染产物（materializer 生成），应存在于 git。"""
    assert _SKILL_MD.exists(), f"SKILL.md not found at {_SKILL_MD}"


async def test_twin_shared_section_headers():
    """共享章节头须同时存在于两 twin（骨架一致）。"""
    md = await _harness_skill_source()
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
        assert header in md, f"harness_skill source missing header {header}"
        assert header in body, f"skill_template prompt_template missing header {header}"


async def test_twin_r10_constraints_present_in_both():
    """R10 沉淀的关键约束子串须同时存在于两 twin（改一处漏另一处即红）。"""
    md = await _harness_skill_source()
    body = await _yaml_prompt_template()
    for needle in ("热更", ".batch_state", "figcaption", "浏览器渲染态", "slice_index"):
        assert needle in md, f"harness_skill source missing R10 constraint: {needle}"
        assert needle in body, f"skill_template prompt_template missing R10 constraint: {needle}"


async def test_twin_fidelity_dimensions_present_in_both():
    """一比一还原的 8 项维度须同时存在于两 twin。"""
    md = await _harness_skill_source()
    body = await _yaml_prompt_template()
    for dim in ("段落顺序", "图片显示尺寸", "目录", "表格", "数学公式", "代码块", "脚注"):
        assert dim in md, f"harness_skill source missing dimension: {dim}"
        assert dim in body, f"skill_template prompt_template missing dimension: {dim}"


async def test_yaml_version_bumped_and_perceives_link_fixed():
    """version 升到 1.2.0（三杠杆改造），且 perceives 资源指针修死链→monorepo 子树。"""
    tpl = {t.template_id: t for t in await load_all()}["pdf_fidelity_restore"]
    assert tpl.version == "1.2.0"
    refs = " ".join(str(r.get("ref", "")) for r in tpl.resources)
    assert "github.com/negentropy/negentropy-perceives" not in refs  # 旧死链已移除
    assert "ThreeFish-AI/negentropy" in refs  # 指向真实 monorepo
