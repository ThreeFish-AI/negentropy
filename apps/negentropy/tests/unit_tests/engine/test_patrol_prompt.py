"""patrol_prompt 单测 — goal/acceptance/config 构造器（纯函数，无 IO）。"""

from __future__ import annotations

from negentropy.engine.routine.patrol_prompt import (
    CONTRACT_SCHEMA,
    PATROL_SYSTEM_PROMPT,
    build_acceptance_criteria,
    build_goal,
    build_routine_config,
)


def test_build_goal_injects_doc_params():
    g = build_goal(
        doc_id="doc-123",
        doc_title="论文 A",
        source_pdf_path="/tmp/patrol/doc-123/source.pdf",
        candidate_md_path="patrol-candidate.md",
    )
    assert "doc-123" in g
    assert "论文 A" in g
    assert "/tmp/patrol/doc-123/source.pdf" in g
    assert "patrol-candidate.md" in g
    assert "NegentropyEngine" in g


def test_build_acceptance_criteria_allows_unfixable_carveout():
    ac = build_acceptance_criteria(baseline_branch="origin/feature/1.x.x")
    assert "100" in ac
    assert "unfixable" in ac
    assert "origin/feature/1.x.x" in ac
    assert "pdf-fidelity-contract" in ac


def test_build_routine_config_shape():
    cfg = build_routine_config(
        doc_id="doc-9",
        source_pdf_path="/tmp/patrol/doc-9/source.pdf",
        candidate_md_path="patrol-candidate.md",
        source_read_dir="/tmp/patrol/doc-9",
        regression_sample=["s1", "s2", "s3"],
    )
    assert cfg["patrol"] is True
    assert cfg["doc_id"] == "doc-9"
    assert cfg["source_pdf_path"].endswith("source.pdf")
    assert cfg["candidate_md_path"] == "patrol-candidate.md"
    assert cfg["read_dirs"] == ["/tmp/patrol/doc-9"]
    assert cfg["regression_sample"] == ["s1", "s2", "s3"]
    assert cfg["system_prompt"] == PATROL_SYSTEM_PROMPT


def test_build_routine_config_extra_override():
    cfg = build_routine_config(
        doc_id="d",
        source_pdf_path="/a/b.pdf",
        candidate_md_path="c.md",
        source_read_dir="/a",
        regression_sample=[],
        extra={"max_turns": 600, "model": "claude-opus-4-8"},
    )
    assert cfg["max_turns"] == 600
    assert cfg["model"] == "claude-opus-4-8"


def test_system_prompt_contains_protocol_and_contract():
    # 三系部角色 + 非回归 + 红线 + JSON 契约 均应在协议中
    assert "ContemplationFaculty" in PATROL_SYSTEM_PROMPT
    assert "ActionFaculty" in PATROL_SYSTEM_PROMPT
    assert "InternalizationFaculty" in PATROL_SYSTEM_PROMPT
    assert "非回归" in PATROL_SYSTEM_PROMPT
    assert "refresh-markdown" in PATROL_SYSTEM_PROMPT  # 红线：禁止调生产重转
    assert "pdf-fidelity-contract" in PATROL_SYSTEM_PROMPT
    assert "doc_id" in CONTRACT_SCHEMA
