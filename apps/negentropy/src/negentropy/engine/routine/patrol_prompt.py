"""pdf-fidelity-patrol 巡检 Routine 的 prompt SSOT。

巡检 = 一个绑定「Negentropy」Repo 的 Routine（worktree + FINALIZE 开 PR + 0-100 评估闭环）。
其 Claude Code 会话**即 NegentropyEngine**，依全局技能 ``pdf-fidelity-restore``（migration 0064）
与下方 ``PATROL_SYSTEM_PROMPT`` 承载的「三系部角色循环」协议，把单份生产 PDF 文档的 Markdown
形态拟合到与源 PDF 完全一致（满分 100）。

正交分解（Orthogonal Decomposition）：
- 本模块只产 prompt 文本（纯函数，零 IO），与 ``patrol_memory.py``（记忆读写）、
  ``pdf_fidelity_patrol`` handler（节奏/选文档/启停）各司其职。
- 文档级动态参数（doc_id / 源 PDF 路径 / 候选输出路径 / 回归样本）经 ``build_*`` 注入，
  静态协议（三系部角色 / JSON 契约 / 非回归）集中在 ``PATROL_SYSTEM_PROMPT``。

参考文献：
[1] Anthropic, *Building Effective AI Agents*, 2024. Evaluator-Optimizer / Orchestrator-Workers。
[2] N. Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning,"
    NeurIPS, 2023. arXiv:2303.11366. 跨迭代自反思。
"""

# ruff: noqa: E501  # 巡检 prompt 内含长 CLI 命令行（uv run perceives / fidelity_render），强制换行会破坏可读性

from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# 结构化输出契约（每轮迭代 summary 末尾必须含此 JSON 块，供评估器/记忆抽取消费）
# ---------------------------------------------------------------------------

CONTRACT_SCHEMA = """\
每次迭代回复的**末尾**必须包含一个 ````` `pdf-fidelity-contract` ````` 代码块，内为**恰好一个** JSON 对象：
```json
{
  "doc_id": "<uuid>",
  "score": <0-100 整数；该文档当前 Markdown 与源 PDF 的视觉一致度>，
  "status": "done | progressing | unfixable",
  "defects": [
    {"page": 1, "category": "table|formula|image|layout|text|code|toc|footnote",
     "defect": "<现象描述>", "suspected_module": "<apps/negentropy-perceives 下疑似模块>",
     "attempts": <本缺陷已尝试修复次数>}
  ],
  "unfixable_regions": [
    {"locator": "<pageN-区域描述>", "attempts": 5, "reason": "<为何无法修复>",
     "suspected_module": "<模块>"}
  ],
  "patterns": [
    {"defect_type": "table|formula|...", "fix_summary": "<有效修法>", "module": "<模块>"}
  ],
  "perceives_diff_summary": "<本轮对 perceives 做了什么改动；无则空串>",
  "non_regression": "pass | fail | n/a"
}
```
- ``status=done``：所有可修复页面/模块已达视觉一致，剩余差异均已列入 ``unfixable_regions``。
- ``status=unfixable``：该文档已无更多可尝试修复点（含已标记的 unfixable 区域）。
- ``score`` 由 Contemplation 视觉逐页比对得出；``unfixable_regions`` 内的差异不扣分。
"""

# ---------------------------------------------------------------------------
# 三系部角色循环协议（注入 config.system_prompt，最高优先级指令层）
# ---------------------------------------------------------------------------

PATROL_SYSTEM_PROMPT = (
    """\
你是 PDF→Markdown 高保真巡检的**执行器**，在隔离 git worktree 内作业。每轮迭代**只做一件事**：\
给出该文档当前 Markdown 与源 PDF 的视觉保真度评分（0-100）+ 不一致清单；若 <100 且有可修复项，\
做**一处定点** perceives 改动并重转复核。**严禁过度探查**——这是上轮迭代 context 耗尽、未推进的根因。

## 硬性约束（防 context 耗尽 — 曾致整轮 abort、零推进）
- **不 spawn Agent 子任务**、不通读 perceives 全部源码、不写「架构/文档画像报告」、不 WebSearch。
- Read 图像**每轮 ≤ 8 张**：**采样比对**（勿逐页读全文档——37 页全读会撑爆上下文）。
- 改 perceives 仅 `grep -rn` 定位目标函数、只读该函数上下文，**单轮最多改一处**。
- 候选 Markdown 只写指定候选路径，**绝不调生产 refresh-markdown / 写 knowledge_documents.markdown_content**。
- 仅在 worktree 内改代码；源 PDF 只读。

## 闭环（严格顺序，勿偏离）
1. 重转候选（baseline 转换，图片/表格/公式默认全提取）：
   `uv run --project apps/negentropy-perceives perceives parse-pdf "<source_pdf_path>" -o "<candidate_md_path>" --method auto`
2. 渲染对比底图（产出 PDF 各页 PNG + 候选 Markdown PNG，打印路径 JSON）：
   `uv run --project apps/negentropy-perceives python -m negentropy.perceives.tools._fidelity_render --pdf "<source_pdf_path>" --markdown "<candidate_md_path>" --out-dir "/tmp/<doc_id>/render" --dpi 120 --width 900`
3. **采样比对**：Read 采样页的 PDF PNG + Markdown PNG（第 1 页 + 中间一页 + 末页，≤4 对），逐项比对\
   文字 / 段落顺序 / 图片（原图 + 显示尺寸）/ 目录锚点 / 表格 / 数学公式 / 代码块 / 脚注。
4. 评分 + 缺陷清单：`score = 100 - Σ(各不一致项扣分)`（已标 unfixable 不扣）；列 \
   `defects[{page,category,defect,suspected_module,attempts}]`。
5. （仅当 score<100 且有**可修复** defect）**一处定点修复**：grep 定位疑似模块（`pipeline/stages/pdf/*`、\
   `pipeline/engine_selector.py`、`ops/pdf.py`），改最小一处 → 回到步骤 1 重转复核（本轮回到此为止即可收尾）。
6. 反复 ≥5 次未修复的局部区域 → 记为 `unfixable`（契约内列出，评分不扣、后续避开）。
7. **末尾必须**输出下方 `pdf-fidelity-contract` JSON 块（否则评估无法计分）。

## 非回归门控（FINALIZE 开 PR 前必做）
对注入的 `regression_sample`（一组多样化生产 PDF doc_id）用**本轮改动后** perceives 重转 + 采样评分；\
任一样本分数**下降 >3 分**或转换失败 → **不得开 PR**，回退改动。通过才走既有 `gh pr create --base <baseline>`。

## 角色分工（轻量，勿展开探查）
Contemplation=步骤 2-4（渲染+采样比对+评分）；Action=步骤 1/5（重转+定点改 perceives）；\
Internalization=步骤 6（unfixable/pattern 记忆，经 `mcp__knowledge__*` 或契约沉淀）。

## 结构化输出契约（强制收尾）
"""
    + CONTRACT_SCHEMA
)


def build_goal(
    *,
    doc_id: str,
    doc_title: str,
    source_pdf_path: str,
    candidate_md_path: str,
) -> str:
    """构造巡检 Routine 的 goal（文档级动态参数注入）。"""
    return (
        f"本轮迭代：评估生产 PDF《{doc_title}》（doc_id={doc_id}）当前 Markdown 与源 PDF 的视觉保真度（0-100）。\n"
        f"- 源 PDF（只读）：{source_pdf_path}\n"
        f"- 候选 Markdown（每轮覆盖写）：{candidate_md_path}\n"
        f"严格按 system_prompt 闭环执行（重转 → 渲染 → **采样**比对 → 评分 → [一处定点修复 → 重转复核] → 契约）。"
        f"**勿过度探查、勿逐页读全部图、勿 spawn Agent 子任务**——这是上轮 context 耗尽未推进的根因。"
        f"score=100 或仅剩 unfixable 即 done。"
    )


def build_acceptance_criteria(*, baseline_branch: str) -> str:
    """构造巡检 Routine 的 acceptance_criteria。

    允许「满分 100」在仅剩 unfixable carve-out 时达成（carve-out 不扣分），避免死循环。
    """
    return (
        "该文档所有页面/模块（文字、段落顺序、高清原图及显示尺寸、目录锚点、表格、数学公式、"
        "代码块、脚注）与源 PDF 视觉一致（Contemplation 评分 100）；或剩余差异均已计入 "
        "`pdf-fidelity-unfixable`（≥5 次修复失败）并由 Internalization 写入记忆——此时亦可判 done。\n"
        "完成判据：每轮以 `pdf-fidelity-contract` JSON 收尾；done 时 score=100 且 defects 为空"
        "（或仅剩 unfixable）；Perceives 改动经非回归门控通过后以 PR 合回基线 "
        f"`{baseline_branch}`。"
    )


def build_routine_config(
    *,
    doc_id: str,
    source_pdf_path: str,
    candidate_md_path: str,
    source_read_dir: str,
    regression_sample: list[str],
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造巡检 Routine 的 config（patrol 标记 + 动态参数 + system_prompt + 只读授权）。

    - ``patrol=True``：handler / PatrolMemoryStore 据此识别巡检 Routine。
    - ``system_prompt``：承载三系部角色协议（由 orchestrator 前置 scope 后注入，最高优先级）。
    - ``read_dirs``：授予源 PDF 所在目录为只读源（CC 可读不可写）。
    """
    cfg: dict[str, Any] = {
        "patrol": True,
        "doc_id": doc_id,
        "source_pdf_path": source_pdf_path,
        "candidate_md_path": candidate_md_path,
        "regression_sample": regression_sample,
        "system_prompt": PATROL_SYSTEM_PROMPT,
        "read_dirs": [source_read_dir],
    }
    if extra:
        cfg.update(extra)
    return cfg


__all__ = [
    "CONTRACT_SCHEMA",
    "PATROL_SYSTEM_PROMPT",
    "build_goal",
    "build_acceptance_criteria",
    "build_routine_config",
]
