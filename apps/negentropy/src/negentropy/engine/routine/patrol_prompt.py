"""pdf-fidelity-patrol 巡检 Routine 的 prompt SSOT（三杠杆 + 真实 wiki 渲染闭环）。

巡检 = 一个绑定「Negentropy」Repo 的 Routine（worktree + FINALIZE 开 PR + 全绿率评估闭环）。
其 Claude Code 会话**即 NegentropyEngine**，依全局技能 ``pdf-fidelity-restore``（migration 0064/0090）
与下方 ``PATROL_SYSTEM_PROMPT`` 承载的「分层闭环 + 三杠杆归因」协议，把单份生产 PDF 文档的
Markdown 形态拟合到与源 PDF 视觉一致（逐页校验全绿率达合格阈值）。

**核心改造（相对旧版）**：
1. 拟合范围从「仅 perceives 三模块」扩散到**三杠杆**：工程代码（perceives 管线 + 摄取层 +
   导出层 + 渲染层 wiki/ui）+ Skills 本身 + 流程自身。
2. 对照对象从 ``_fidelity_render`` 的 Python-Markdown 近似渲染换成**真实 wiki 渲染栈**
   （``patrol_wiki_env`` 起的 ``next dev``，react-markdown + remark/rehype 全栈）。
3. 闭环改为**分层**：fast inner loop（worktree CLI 候选 → 真实 wiki 截图 → 程序化逐页预筛 →
   视觉聚焦 → 三杠杆归因 → 全绿率评分 → 一根因修复）+ Real-Render Gate（真 Rebuild
   ``refresh_markdown(resume=false)`` + 重发 wiki 作地面真值校准）。
4. 评分从「100-Σ扣分」改为「逐页校验全绿率 pass_pages/total×100」——CC 自评与 Judge 复核
   锁同一份 ``program-checks.json`` + defects，根治 ISSUE-128 ±20 振荡。

正交分解（Orthogonal Decomposition）：
- 本模块只产 prompt 文本（纯函数，零 IO），与 ``patrol_memory.py``（记忆）、
  ``patrol_wiki_env.py``（wiki 渲染环境）、``pdf_fidelity_patrol`` handler（节奏/选文档/启停）
  各司其职。
- 文档级动态参数（doc_id / 源 PDF 路径 / 候选路径 / wiki 环境 / 回归样本 / 历史缺陷）经
  ``build_*`` 注入，静态协议（分层闭环 / 三杠杆 / JSON 契约 / 非回归）集中在 ``PATROL_SYSTEM_PROMPT``。

参考文献：
[1] Anthropic, *Building Effective AI Agents*, 2024. Evaluator-Optimizer / Orchestrator-Workers。
[2] N. Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning,"
    NeurIPS, 2023. arXiv:2303.11366. 跨迭代自反思。
"""

# ruff: noqa: E501  # 巡检 prompt 内含长 CLI 命令行（uv run perceives / patrol_wiki_env），强制换行会破坏可读性

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
  "score": <0-100 整数 = round(pass_pages/total_pages×100)；逐页校验全绿率>,
  "score_method": "page_pass_rate",
  "pass_pages": <全绿页数>, "total_pages": <总页数>,
  "status": "done | progressing | unfixable",
  "defects": [
    {"page": 1, "category": "table|formula|image|image_size|layout|text|code|toc|footnote|paragraph_order",
     "severity": "blocker|major|minor", "defect": "<现象描述>",
     "evidence": {"pdf_bbox": [x,y,w,h], "wiki_selector": "<CSS selector / DOM Range>",
                  "pdf_crop_path": "<路径>", "wiki_crop_path": "<路径>", "program_check": "<程序化判据>"},
     "check_method": "programmatic | vision | hybrid",
     "attribution": {"lever": "code|skill|process",
                     "layer": "render_wiki|render_ui|render_sim|ingest|pipeline|export|skill|process",
                     "target_file": "<相对 worktree 根的路径>",
                     "root_cause_hypothesis": "<一句话根因>",
                     "confidence": "high|medium|low",
                     "dual_source_check": "md_only|render_only|both|not_checked"},
     "attempts": <本缺陷已尝试修复次数>, "status": "open|fixing|unfixable"}
  ],
  "page_checks_summary": {"green": <n>, "yellow": <n>, "red": <n>,
                          "by_category": {"table": {"green": <n>, "warn": <n>}, ...}},
  "unfixable_regions": [
    {"locator": "<pageN-区域描述>", "attempts": 5, "reason": "<为何无法修复>",
     "attribution": {"layer": "<层>", "target_file": "<模块>"}}
  ],
  "patterns": [
    {"defect_type": "table|formula|...", "fix_summary": "<有效修法>",
     "attribution": {"lever": "<杠杆>", "layer": "<层>", "target_file": "<模块>"}}
  ],
  "diff_summary": "<本轮对【代码/Skill/流程】做了什么改动；无则空串>",
  "non_regression": "pass | fail | n/a"
}
```
- ``score`` = 逐页校验全绿率 ``round(pass_pages/total_pages×100)``；``unfixable_regions`` 内的差异
  不计入 pass_pages（carve-out）。``score_method=page_pass_rate`` 必填（供 Judge 校验口径一致）。
- ``status=done``：所有可修复页/模块已达逐页一致（全绿或仅剩 unfixable）。
- ``status=unfixable``：该文档已无更多可尝试修复点（含已标记的 unfixable 区域）。
- 每个 defect **必须**填 ``attribution.{lever,layer,target_file}``（三杠杆归因，见路由表），
  ``dual_source_check`` 声明是否经 DB markdown 层 + 渲染层双源验证（防误归因）。
- ``diff_summary`` 不限 perceives——可含渲染层 / 摄取层 / 导出层 / Skill / 流程（prompt 自身）改动。
"""

# ---------------------------------------------------------------------------
# 分层闭环 + 三杠杆归因协议（注入 config.system_prompt，最高优先级指令层）
# ---------------------------------------------------------------------------

PATROL_SYSTEM_PROMPT = (
    """\
你是 PDF→Markdown 高保真巡检的**执行器**，在隔离 git worktree 内作业。每轮迭代评估该文档当前\
Markdown（经真实 wiki 渲染栈渲染）与源 PDF 的逐页视觉保真度，给出全绿率评分 + 结构化缺陷清单\
（三杠杆归因）；若未达标且有可修复项，做**一个逻辑根因**的改动并重转复核。**严禁过度探查**——\
这是历史 context 耗尽、零推进的根因。

## 三杠杆拟合范围（可改的对象，按归因路由表选定）
- **①工程代码**：
  - 管线层 ``apps/negentropy-perceives/.../pipeline/stages/pdf/*``、``pipeline/engine_selector.py``、\
    ``pipeline/batch_merge.py``、``ops/pdf.py``（文字/段落/表格/公式/图片提取、引擎选型、跨片合并、图片尺寸）。
  - 摄取层 ``apps/negentropy/.../knowledge/ingestion/extraction.py``（图片链接重写）、``knowledge/_shared.py``。
  - 导出层 ``apps/negentropy/.../knowledge/lifecycle/wiki_export_service.py``（资产 bake/重写）。
  - 渲染层 wiki ``apps/negentropy-wiki/src/components/markdown/MarkdownRenderer.tsx`` 及子组件\
    （ZoomableImage/ResponsiveTable/AnchorHeading/CodeBlock/MermaidDiagram）；\
    渲染层 ui ``apps/negentropy-ui/features/knowledge/components/DocumentMarkdownRenderer.tsx``\
    （sanitize schema、DocumentImage figcaption、parsePixelValue）、``utils/markdown-plugins.ts``。
- **②Skills 本体**：``.agent/skills/pdf-fidelity-restore/SKILL.md`` +\
  ``apps/negentropy/.../agents/skill_templates/pdf_fidelity_restore.yaml``（SSOT 双写，沉淀跨 doc insight / 升级归因路由）。
- **③流程自身**：本 prompt（采样/评分/归因/闭环编排）、``evaluator.py``（Judge 口径）——仅当拟合动作是\
  「改进巡检流程自身」时才改（慎改，影响面大）。

## 硬性约束（防 context 耗尽 — 曾致整轮 abort、零推进）
- **不 spawn Agent 子任务**、不通读任一杠杆全部源码、不写「架构画像报告」、不 WebSearch。
- 视觉读图**每轮 ≤ 8 对**（PDF 页 PNG + wiki 区段 PNG 各 1 = 1 对）：先跑 ``patrol_page_check`` 程序化\
  全页预筛，仅 ``vision_required`` 页进视觉队列（既逐页覆盖又不撑爆上下文）。
- 改代码仅 ``grep -rn`` 定位目标函数、只读该函数上下文。**单轮一个逻辑根因**：≤3 文件、≤2 杠杆、\
  1 commit（根因一句话概括）；禁止单轮同时改 perceives+wiki+ui+Skill+prompt 五处。
- 候选 Markdown 只写指定候选路径 / wiki 内容根，**inner loop 绝不写生产 knowledge_documents.markdown_content**\
  （仅 Real-Render Gate 经 ``refresh_markdown(resume=false)`` 写生产，作地面真值）。
- 仅在 worktree 内改代码；源 PDF 只读。
- **checkpoint 热更铁律**：每轮重转前清 checkpoint（精确到该 PDF 的 sha1，见 inner loop 步骤 1）——\
  auto_batch resume 按源 PDF SHA-1 缓存切片，不清则复用旧切片、你的 perceives 改动不生效。
- **图注勿双渲染**：多数图注已烘入 figure region PNG 像素，渲染层勿据 ``alt`` 另 render ``figcaption``\
  （会双图注）；仅核对像素内图注与源 PDF 是否一致。

## 缺陷归因路由表（defect 类别 → 杠杆/层/责任文件，先验）
| 缺陷类别 | 首选层 | 判据 |
|---|---|---|
| table 结构错 | pipeline | DB markdown 表格源码错→pipeline；源码对渲染错→render_wiki/render_ui |
| formula ParseError/双份 | pipeline+render | DB ``$...$`` 对但浏览器报错→渲染层/引擎版本；DB 缺失→pipeline |
| image 404 | ingest+export | wiki 错 ui 对→export；ui 错 wiki 对→ingest；皆错→资产未落地(ingest) |
| image 显示尺寸 | pipeline+render | DB 无 width→pipeline ``ops/pdf.py``；有 width 渲染错→render sanitize/parsePixelValue |
| figure 双图注 | render+skill | 一份 MD 两栈 figcaption 行为不同→渲染层不对称 + Skill 沉淀铁律 |
| layout/text/code/toc/footnote | pipeline/render | 按 DB 层 vs 渲染层双源判定（见决策树） |
| 仅旧模拟栈可见 | render_sim（不计分） | DB + wiki/ui 均正确，仅旧 ``_fidelity_render`` 错→流程伪缺陷，记 insight 不扣分 |

## 双源验证决策树（每个 defect 归因前必走，防误归到 perceives）
Step A：缺陷在候选 Markdown 源码（候选 MD 文件）里存在吗？
  是 → pipeline/ingest 层（Step B）；否 → 渲染层或流程伪缺陷（Step C）
Step B：图片链接是否 ``/api/documents/.../assets/`` 形式？是但 404 → ingest/export；否 → ingest _rewrite；其他 → pipeline（产出源头）
Step C：wiki 渲染错还是 ui 渲染错？仅 wiki → render_wiki；仅 ui → render_ui；皆错一致 → 共享根因；\
皆对仅旧模拟栈错 → render_sim（不计分）。``attribution.dual_source_check`` 必填以证未跳步。

## 分层闭环（严格顺序，勿偏离）
### A. Fast Inner Loop（每轮，秒级，不写生产）
1. **清 checkpoint（精确到 sha1）**：``rm -rf "<perceives_workdir>/output/.batch_state/<sha1[:12]>"``\
   （sha1 由 ``perceives parse-pdf`` 首跑产出日志给出；不确定时可 ``rm -rf output/.batch_state`` 兜底）。
2. **CLI 重转（worktree 代码，即时反映改动）**：\
   ``uv run --project apps/negentropy-perceives perceives parse-pdf "<source_pdf_path>" -o "<candidate_md_path>" --method auto``
3. **发布候选到 wiki 内容根（原子写 entries/{entry_id}.json，真实 schema）**：\
   ``uv run --project apps/negentropy python -m negentropy.engine.routine.patrol_wiki_env publish-candidate --content-root "<wiki_content_root>" --markdown-file "<candidate_md_path>" --doc-id "<doc_id>" --title "<doc_title>" --filename "<doc_filename>"``
4. **等 wiki dev server 可服务 + 程序化逐页预筛**：\
   ``uv run --project apps/negentropy python -m negentropy.engine.routine.patrol_wiki_env wait-ready --port <wiki_dev_port>``；\
   ``uv run --project apps/negentropy-perceives python -m negentropy.perceives.tools.patrol_page_check --pdf "<source_pdf_path>" --wiki-url "<wiki_url>" --out-dir "/tmp/<doc_id>/check"``\
   （产出 ``program-checks.json`` + ``align-index.json``；``vision_required_pages`` 列表）。
5. **截图**：源 PDF 各页 PNG（``uv run --project apps/negentropy-perceives python -m negentropy.perceives.tools._fidelity_render --pdf "<source_pdf_path>" --markdown "<candidate_md_path>" --out-dir "/tmp/<doc_id>/render"`` 仅取其 ``pdf_pages``；候选不再用其 markdown PNG）；\
   wiki 真页用 ``mcp__playwright__browser_navigate("<wiki_url>")`` + ``browser_take_screenshot(fullPage=true)``，并对 ``vision_required`` 页按需 ``clip``/element 区段截图。
6. **视觉聚焦比对**：Read ``vision_required`` 页的 PDF 页 PNG + wiki 区段 PNG（≤8 对），逐项比对\
   文字 / 段落顺序 / 图片（原图+显示尺寸）/ 目录锚点 / 表格 / 数学公式 / 代码块 / 脚注。
7. **结构化缺陷 + 三杠杆归因**：每个 defect 填 ``attribution.{lever,layer,target_file}`` +\
   ``dual_source_check``（走上方决策树）；``check_method`` 标 programmatic/vision/hybrid。
8. **全绿率评分**：``score = round(pass_pages/total_pages×100)``（``pass_pages`` = 全维度 green 或\
   仅剩 unfixable 的页数；``unfixable_regions`` 不计）。
9. （仅当 score<阈值 且有**可修复** defect）**一个逻辑根因修复**：按归因路由表 grep 定位目标杠杆/文件，\
   改 ≤3 文件 ≤2 杠杆 → 回步骤 1（本轮回到此为止即可收尾）。
10. 反复 ≥5 次未修复的局部区域 → 记 ``unfixable``（契约内列出，评分不计、后续避开）。

### B. Real-Render Gate（每 N=min(5, max_iter/3) 轮 / 达 inner 阈值 / FINALIZE 前必做一次）
- 真 Rebuild（清 checkpoint 全量重跑 + 写生产 markdown_content）：调\
  ``POST /knowledge/base/{corpus_id}/documents/{doc_id}/refresh_markdown`` body ``{"resume": false}``\
  （经 live perceives :2992；与本轮 worktree 代码改动**独立**——跨 Routine 合并部署后才反映代码杠杆）。
- 重发 wiki：把生产 markdown_content 读回写 wiki 内容根（步骤 3 的 publish-candidate，markdown 换成生产态），\
  或直接 ``WikiExportService.export_single_entry``（含 asset bake）。
- 截图真 wiki 页 + PDF 页（步骤 5），给**地面真值评分**，校准 inner loop 评分漂移（CLI vs MCP 路径差异、\
  asset 未 bake 致 inner 图片缺漏等）。

### C. 降级（``wiki_render_available=false`` 时）
- wiki dev server 不可起：回退 ``_fidelity_render.render_page_pairs``（legacy Python-Markdown 近似渲染），\
  标本轮降级（``diff_summary`` 注明）；仅作离线兜底，缺陷归因时警惕 ``render_sim`` 伪缺陷。

## 非回归门控（FINALIZE 开 PR 前必做，按本轮改动杠杆分派）
- ①pipeline：用**本轮改动后** perceives 重转 ``regression_sample``（注入的一组多样化生产 PDF doc_id）+ 采样评分；\
  任一样本分数下降 >3 分或转换失败 → **不得开 PR**，回退改动。
- ①渲染层（wiki/ui）：改动后渲染栈渲染回归样本 Markdown（``patrol_page_check`` 或截图对照），不得引入新视觉缺陷。
- ①摄取层：回归样本图片链接 HTTP 200 探针 + Markdown 链接形式正确、标题回填未退化。
- ①导出层：回归样本 export bake 后图片可达性。
- ②Skill：``SKILL.md`` 与 ``yaml`` 正文骨架一致（SSOT 双写）。
- ③流程：新 prompt 跑回归样本，整体评分不降超容差。
- **零代码改动即无 PR**：若本轮（及历轮）未对任何杠杆做代码/Skill/prompt 改动（worktree 相对基线 0 提交），\
  说明该文档已达标 → **不得开 PR**，直接以 done 收尾。候选 Markdown 与 wiki 内容根产物是隔离工作区\
  **之外**的临时评估产物，**绝不**纳入 worktree / commit / PR。

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
    qualified_threshold: int,
    known_unfixable_regions: list[dict[str, Any]] | None = None,
    wiki_env: dict[str, Any] | None = None,
    known_defects: list[dict[str, Any]] | None = None,
) -> str:
    """构造巡检 Routine 的 goal（文档级动态参数 + wiki 环境注入）。

    - ``qualified_threshold``：合格分阈值（全绿率口径，达此或仅剩 unfixable 即 done）。
    - ``known_unfixable_regions``：该文档已知 unfixable 区域（跨 Routine 记忆复用），注入避让清单。
    - ``wiki_env``：巡检 wiki 渲染环境（url/port/content_root/entry_id/可用性），驱动 inner loop 真实渲染。
    - ``known_defects``：上轮历史缺陷（``TAG_DEFECT``），注入以优先复核是否复现（纵向非回归）。
    """
    unfixable_hint = ""
    if known_unfixable_regions:
        locators = ", ".join(
            str(r.get("locator") or "").strip()
            for r in known_unfixable_regions
            if isinstance(r, dict) and str(r.get("locator") or "").strip()
        )
        if locators:
            unfixable_hint = f"\n- **已知 unfixable 区域（勿再尝试修复，评分不计）**：{locators}"

    wiki_hint = "\n- **wiki 渲染环境不可用（降级 legacy 近似渲染）**：走 _fidelity_render 离线兜底。"
    if wiki_env and wiki_env.get("wiki_render_available"):
        wiki_hint = (
            f"\n- **wiki 渲染环境（真实 wiki app 渲染栈）**：url=`{wiki_env.get('wiki_url')}` "
            f"port={wiki_env.get('wiki_dev_port')} content_root=`{wiki_env.get('wiki_content_root')}` "
            f"entry_id=`{wiki_env.get('wiki_entry_id')}` slug=`{wiki_env.get('wiki_entry_slug')}`"
        )

    defects_hint = ""
    if known_defects:
        summary = ", ".join(f"p{d.get('page')}({d.get('category')})" for d in known_defects[:12] if isinstance(d, dict))
        if summary:
            defects_hint = f"\n- **上轮历史缺陷（优先复核是否复现，纵向非回归）**：{summary}"

    return (
        f"本轮迭代：评估生产 PDF《{doc_title}》（doc_id={doc_id}）当前 Markdown 与源 PDF 的逐页视觉保真度（全绿率）。\n"
        f"- 源 PDF（只读）：{source_pdf_path}\n"
        f"- 候选 Markdown（每轮覆盖写）：{candidate_md_path}{unfixable_hint}{wiki_hint}{defects_hint}\n"
        "严格按 system_prompt 分层闭环执行（inner: 清checkpoint→CLI重转→publish-candidate→程序化预筛"
        "→截图→视觉聚焦→三杠杆归因→全绿率评分→一根因修复；gate: refresh_markdown(resume=false)+重发wiki作地面真值）。"
        "**勿过度探查、勿逐页读全部图、勿 spawn Agent 子任务**——这是上轮 context 耗尽未推进的根因。"
        f"score≥{qualified_threshold}（全绿率合格阈值）或仅剩 unfixable 即 done。"
    )


def build_acceptance_criteria(*, baseline_branch: str, qualified_threshold: int) -> str:
    """构造巡检 Routine 的 acceptance_criteria（全绿率口径）。

    合格阈值为 ``qualified_threshold``（默认 95）：全绿率达此即判合格 done。允许在仅剩 unfixable
    carve-out 时达成（carve-out 页不计 pass_pages），避免死循环。
    **评分口径 = 逐页校验全绿率** ``score = round(pass_pages/total_pages×100)``（非旧「100-Σ扣分」），
    与 Judge 复核锁同一份 ``program-checks.json`` + defects，根治 ISSUE-128 ±20 振荡。
    """
    return (
        "该文档所有页面/模块（文字、段落顺序、高清原图及显示尺寸、目录锚点、表格、数学公式、"
        "代码块、脚注）经**真实 wiki 渲染栈**渲染后与源 PDF 逐页视觉一致；或剩余差异均已计入 "
        "`pdf-fidelity-unfixable`（≥5 次修复失败）并由 Internalization 写入记忆——此时亦可判 done。\n"
        "**评分口径（重要）**：``score = round(pass_pages/total_pages×100)``（逐页校验全绿率）。"
        f"达 {qualified_threshold} 即合格（如 37 页需 ≥36 页全绿）。每个 defect 须填三杠杆归因 "
        "(`attribution.lever/layer/target_file`) + `dual_source_check`；done 时 defects 为空（或仅剩 "
        f"unfixable）。**勿对已收敛文档压低分数**，致本应成功的 Routine 误判失败。\n"
        "完成判据：每轮以 `pdf-fidelity-contract` JSON 收尾（含 `score_method=page_pass_rate` + "
        f"`pass_pages/total_pages`）；done 时 score≥{qualified_threshold} 且 defects 为空（或仅剩 unfixable）；"
        f"各杠杆改动经非回归门控通过后以 PR 合回基线 `{baseline_branch}`。"
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
    - ``system_prompt``：承载分层闭环 + 三杠杆归因协议（最高优先级）。
    - ``read_dirs``：授予源 PDF 所在目录为只读源（CC 可读不可写）。
    - wiki 环境（``wiki_url`` / ``wiki_dev_port`` / ``wiki_content_root`` / ``wiki_dev_pid`` 等）经
      ``extra`` 由 handler 的 ``_setup_patrol_wiki_env`` 注入。
    """
    cfg: dict[str, Any] = {
        "patrol": True,
        "doc_id": doc_id,
        "source_pdf_path": source_pdf_path,
        "candidate_md_path": candidate_md_path,
        "regression_sample": regression_sample,
        "system_prompt": PATROL_SYSTEM_PROMPT,
        "read_dirs": [source_read_dir],
        # Plan Review 保持启用（CC ↔ NegentropyEngine 正常交流方案、恰当时 Approve）。
        # 注：unified 闭环下 plan 段**已强制走 PreToolUse 钩子**（orchestrator 文末，根治断链），
        # 故此 via_hook 值**不再影响 plan 段**，仅遗留作 legacy 非 unified 路径开关。
        "plan_review_via_hook": False,
        # 开启「Judge verdict=pass 亦判成功」旁路（消费见 orchestrator.decide()）。全绿率口径下
        # CC 自评与 Judge 评分一致，accept_verdict_pass 作收敛 carve-out 的第二成功通道（与阈值并列）。
        "accept_verdict_pass": True,
        # 停滞判定分数容差带（消费见 orchestrator.decide()）。全绿率口径理论上消振荡，但程序化预筛
        # 阈值未校准前仍可能小幅波动；保留容差防假阳性 no_progress 误杀（ISSUE-128 教训）。
        "no_progress_score_tolerance": 20,
        # Judge 历史锚定（消费见 orchestrator._do_evaluate / evaluator.evaluate）。全绿率 + 结构化
        # defects 喂 Judge 后，锚定使评分带 delta 证据、与轨迹一致。显式置 True 防全局默认翻转失锚。
        "judge_anchor_enabled": True,
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
