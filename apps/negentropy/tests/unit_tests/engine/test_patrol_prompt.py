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
        qualified_threshold=95,
    )
    assert "doc-123" in g
    assert "论文 A" in g
    assert "/tmp/patrol/doc-123/source.pdf" in g
    assert "patrol-candidate.md" in g
    assert "保真度" in g  # 紧凑目标：本轮逐页视觉保真度（全绿率）
    assert "分层闭环" in g  # 新闭环结构（inner + gate）
    assert "95" in g  # 合格阈值注入 done 判定
    assert "合格阈值" in g


def test_build_goal_injects_known_unfixable_regions():
    """已知 unfixable 区域注入避让清单（跨 Routine 记忆复用——修复「只写不读」半失效）。"""
    g = build_goal(
        doc_id="doc-9",
        doc_title="论文 B",
        source_pdf_path="/tmp/patrol/doc-9/source.pdf",
        candidate_md_path="patrol-candidate.md",
        qualified_threshold=95,
        known_unfixable_regions=[
            {"locator": "page3-table2"},
            {"locator": "page7-formula1"},
            {"locator": ""},  # 空 locator 应被过滤
        ],
    )
    assert "已知 unfixable 区域" in g
    assert "page3-table2" in g
    assert "page7-formula1" in g
    assert "评分不计" in g


def test_build_goal_no_unfixable_hint_when_empty():
    """无已知 unfixable 区域时不附加避让段（避免空提示噪声）。"""
    g = build_goal(
        doc_id="d",
        doc_title="t",
        source_pdf_path="/p.pdf",
        candidate_md_path="c.md",
        qualified_threshold=95,
        known_unfixable_regions=None,
    )
    assert "已知 unfixable 区域" not in g


def test_build_acceptance_criteria_allows_unfixable_carveout():
    ac = build_acceptance_criteria(baseline_branch="origin/feature/1.x.x", qualified_threshold=95)
    assert "95" in ac  # 合格阈值（全绿率口径）
    assert "100" in ac  # pass_pages/total_pages×100（全绿率公式）
    assert "unfixable" in ac
    assert "origin/feature/1.x.x" in ac
    assert "pdf-fidelity-contract" in ac
    assert "评分口径" in ac  # 全绿率口径（防评估器压分致本应成功的 Routine 误判 Failed）
    assert "pass_pages" in ac  # 全绿率公式字段


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
    # Plan Review 保持启用，但走 clean stdin 应答（非 deny 钩子→is_error）
    assert cfg["plan_review_via_hook"] is False
    # 巡检完成判据含「仅剩 unfixable 即 done」carve-out，threshold=100 与 Judge 评分尺度失配，
    # 故开启 accept_verdict_pass 旁路让 Judge 的 pass 成为第二成功通道（防 no_progress 误判 failed）
    assert cfg["accept_verdict_pass"] is True
    # Judge 历史锚定显式启用：巡检 ±20 振荡的根因之一是无锚点独立重打分，锚定使评分带 delta 证据。
    assert cfg["judge_anchor_enabled"] is True


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


def test_build_routine_config_source_task_key():
    """handler 透传 source_task_key 便于 Scheduler UI 反查派生 Routine。"""
    cfg = build_routine_config(
        doc_id="d",
        source_pdf_path="/a/b.pdf",
        candidate_md_path="c.md",
        source_read_dir="/a",
        regression_sample=[],
        extra={"source_task_key": "pdf_fidelity_patrol"},
    )
    assert cfg["source_task_key"] == "pdf_fidelity_patrol"


def test_system_prompt_contains_protocol_and_contract():
    # 分层闭环 + 三杠杆 + 防过度探查 + 非回归 + 红线 + JSON 契约 均应在协议中
    assert "uv run --project apps/negentropy-perceives perceives parse-pdf" in PATROL_SYSTEM_PROMPT
    assert "_fidelity_render" in PATROL_SYSTEM_PROMPT  # legacy 降级渲染底座
    assert "视觉聚焦" in PATROL_SYSTEM_PROMPT  # 程序化全页预筛 + 视觉聚焦（防逐页读全图撑爆上下文）
    assert "不 spawn Agent" in PATROL_SYSTEM_PROMPT  # 防过度探查（曾致 context 耗尽 abort）
    assert "三杠杆" in PATROL_SYSTEM_PROMPT  # 拟合范围：工程代码 + Skills + 流程
    assert "Inner Loop" in PATROL_SYSTEM_PROMPT  # 分层闭环：fast inner loop
    assert "Real-Render Gate" in PATROL_SYSTEM_PROMPT  # 分层闭环：地面真值门控
    assert "归因路由表" in PATROL_SYSTEM_PROMPT  # 缺陷三杠杆归因
    assert "双源验证决策树" in PATROL_SYSTEM_PROMPT  # 防误归因到 perceives
    assert "非回归" in PATROL_SYSTEM_PROMPT
    assert "绝不写生产 knowledge_documents.markdown_content" in PATROL_SYSTEM_PROMPT  # inner loop 红线
    assert "refresh_markdown(resume=false)" in PATROL_SYSTEM_PROMPT  # gate 真 Rebuild 入口
    assert "pdf-fidelity-contract" in PATROL_SYSTEM_PROMPT
    # 零代码改动即无 PR（修「PR 仅含 patrol-candidate.md」根因：候选是 worktree 外临时产物、不纳入交付）
    assert "零代码改动" in PATROL_SYSTEM_PROMPT
    # R10 沉淀：每轮重转前须清 checkpoint，否则 auto_batch resume 复用旧切片、perceives 改动不生效
    assert ".batch_state" in PATROL_SYSTEM_PROMPT
    assert "doc_id" in CONTRACT_SCHEMA
    assert "page_pass_rate" in CONTRACT_SCHEMA  # 全绿率口径
    assert "attribution" in CONTRACT_SCHEMA  # 三杠杆归因字段
