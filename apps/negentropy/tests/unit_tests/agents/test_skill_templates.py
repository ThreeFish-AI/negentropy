"""
Skill Templates 加载器 — 单元测试。

覆盖：
1. 内置 ``paper_hunter.yaml`` 必须能被加载并命中关键字段；
2. SemVer 校验：非法版本号被跳过且不冒泡；
3. enforcement_mode 兜底：非法值降级为 ``warning``；
4. 缺失必填字段时整个模板被丢弃。
"""

from __future__ import annotations

from pathlib import Path

from negentropy.agents.skill_templates import SkillTemplate, _coerce_template, load_all


def test_load_all_includes_paper_hunter():
    templates = load_all()
    assert templates, "至少应该加载到内置 paper_hunter.yaml"
    by_id = {t.template_id: t for t in templates}
    assert "paper_hunter" in by_id
    tpl = by_id["paper_hunter"]
    assert tpl.name == "ai-agent-paper-hunter"
    assert tpl.version == "0.1.0"
    assert "fetch_papers" in tpl.required_tools
    assert "save_to_memory" in tpl.required_tools
    assert "update_knowledge_graph" in tpl.required_tools
    assert tpl.enforcement_mode == "strict"
    assert any(r.get("type") == "corpus" for r in tpl.resources)


def test_coerce_template_invalid_semver_returns_none():
    raw = {
        "template_id": "bad",
        "name": "bad-skill",
        "category": "x",
        "version": "not-a-version",
    }
    assert _coerce_template(raw) is None


def test_coerce_template_invalid_enforcement_falls_back_to_warning():
    raw = {
        "template_id": "weird",
        "name": "weird-skill",
        "category": "x",
        "version": "1.0.0",
        "enforcement_mode": "panic",
    }
    coerced = _coerce_template(raw)
    assert isinstance(coerced, SkillTemplate)
    assert coerced.enforcement_mode == "warning"


def test_coerce_template_missing_required_field_returns_none():
    raw = {"template_id": "missing", "name": "x", "version": "1.0.0"}  # no category
    assert _coerce_template(raw) is None


def test_paper_hunter_yaml_lives_under_skill_templates_dir():
    """物理位置守门：避免无意中把 yaml 挪走破坏加载。"""
    path = Path(__file__).resolve().parents[3] / "src/negentropy/agents/skill_templates/paper_hunter.yaml"
    assert path.exists(), f"paper_hunter.yaml not found at {path}"


def test_load_all_includes_document_translate():
    """内置 Translate 技能模板：精准挂载 InfluenceFaculty（is_global=False）。"""
    templates = load_all()
    by_id = {t.template_id: t for t in templates}
    assert "document_translate" in by_id
    tpl = by_id["document_translate"]
    assert tpl.name == "document-translate"
    assert tpl.version == "1.0.0"
    assert tpl.required_tools == ["invoke_claude_code"]
    assert tpl.enforcement_mode == "warning"
    assert tpl.is_global is False
    assert tpl.visibility == "public"
    # 模板变量齐全（服务端渲染依赖）
    for var in ("{{ workdir }}", "{{ chunk_count }}", "{{ target_language }}", "{{ tool_timeout }}"):
        assert var in (tpl.prompt_template or ""), f"missing template var: {var}"


def test_document_translate_yaml_lives_under_skill_templates_dir():
    path = Path(__file__).resolve().parents[3] / "src/negentropy/agents/skill_templates/document_translate.yaml"
    assert path.exists(), f"document_translate.yaml not found at {path}"
