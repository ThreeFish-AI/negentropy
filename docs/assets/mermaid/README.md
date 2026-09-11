# Mermaid 文本源索引（archify 图的唯一可编辑源）

> 本目录是现役系统文档全部 Mermaid 图的**集中文本源 SSOT**。每张图四件套：
> `docs/assets/mermaid/<分类>/<slug>.mmd`（本文本源）→
> [archify](../../.agents/doc-media-assets.md) 重绘 `docs/assets/architecture/<分类>/<slug>.html` →
> [`scripts/capture-arch-diagram.mjs`](../../../scripts/capture-arch-diagram.mjs) 采集
> `<slug>-dark.png` / `<slug>-light.png`（文档内嵌一律用暗色 PNG）。
>
> **范围**：仅现役系统文档（`docs/concepts/`、`docs/reference/{perceives,wiki}/`、根与 i18n README、
> `apps/` README、`docs/.agents/` 巡检文档）。`docs/research/`（第三方调研）与
> `docs/reference/cognizes/`（已退役遗产）**不在此管线**，原地保留渲染。

## 约定

- **修改一张图**：只改对应 `.mmd` → 用 archify 从新文本重新生成 HTML（整体替换，严禁手改 HTML）→
  跑采集脚本再生 PNG → 三者同一次提交。
- **`.mmd` 文件头**：`%% source / %% slug / %% type / %% derived` 溯源注释；头注释之后是
  从原文档逐字节抽取的 mermaid 体（携带 `%% fix:` 行的图例外，其体为修正后文本）。
- **archify 类型映射**：`flowchart/graph → workflow`（组件图用 `architecture`）、
  `sequenceDiagram → sequence`、`stateDiagram-v2 → lifecycle`；
  `erDiagram / timeline / mindmap / quadrantChart / gantt / pie / gitGraph / classDiagram`
  无对应类型，**原地保留**（下表 `in-place` 行，不建 `.mmd`，避免文本源双份）。
- **不合格式**（wiki 渲染约束，判据见 [doc-media-assets](../../.agents/doc-media-assets.md)）：
  进 wiki 的文档只用纯 markdown `![]()` 内嵌暗色 PNG；`<picture>` 双主题仅限根 / i18n README 与 `.agents`。

## 索引

> 各分类行由对应重绘波次登记；`产物` 列 ✓ = html + dark/light PNG 已入库。

### core/（framework 与总览）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [negentropy-architecture](./core/negentropy-architecture.mmd) | [framework.md §2.1](../../concepts/framework.md) | architecture | ✓ +svg/mp4/gif | 旗舰 | 11 源码深链；文本源自原 `<details>` 折叠块迁入 |
| [framework--faculties-orchestration](./core/framework--faculties-orchestration.mmd) | framework.md §3.2 | architecture | ✓ | done | 源码深链；边标签升级为逐系部委派意图 |
| [framework--agent-collaboration-sequence](./core/framework--agent-collaboration-sequence.mmd) | framework.md §3.4 | sequence | ✓ | done | |
| [framework--standard-pipelines](./core/framework--standard-pipelines.mmd) | framework.md §4.1 | workflow | ✓ | done | |
| [framework--bootstrap-sequence](./core/framework--bootstrap-sequence.mmd) | framework.md §6.1 | workflow | ✓ | done | fix: D-9 挂载点 4→8 组（/knowledge 16 子路由） |
| [framework--observability-dataflow](./core/framework--observability-dataflow.mmd) | framework.md §6.4 | dataflow | ✓ | done | |
| [framework--engine-interior](./core/framework--engine-interior.mmd) | framework.md §6.5（新增） | architecture | ✓ | done | fix: D-1/D-2/D-14 全新补齐引擎内部七子系统 |
| [framework--schema-domains](./core/framework--schema-domains.mmd) | framework.md §8.2 | architecture | ✓ | done | fix: D-8 cognizes 遗产 .sql → models/ 九域 76 表 |
| [framework--connection-lifecycle](./core/framework--connection-lifecycle.mmd) | framework.md §9.5 | lifecycle | ✓ | done | 设计层状态机；代码口径差已在正文注记 |
| [framework--testing-pyramid](./core/framework--testing-pyramid.mmd) | framework.md §10.1 | architecture | ✓ | done | 单元基座按端拆分承载各自覆盖率门 |
| [framework--ci-cd-pipeline](./core/framework--ci-cd-pipeline.mmd) | framework.md §10.4 | workflow | ✓ | done | fix: 补 perceives/wiki 质量门事实 |
| [a2ui--fact-source](./core/a2ui--fact-source.mmd) | a2ui.md §3 | workflow | ✓ | done | 13 节点全部代码实证 |
| [a2ui--main-rail](./core/a2ui--main-rail.mmd) | a2ui.md §4 | workflow | ✓ | done | |
| [conversation-foundation--architecture](./core/conversation-foundation--architecture.mmd) | conversation-foundation.md | workflow | ✓ | done | Guide 节点按 user-guide/ 目录实况改绘 |
| [readme--faculties-en](./core/readme--faculties-en.mmd) | README.md（根） | architecture | ✓ | done | 英文内容，locale=en |
| [readme-zh--faculties](./core/readme-zh--faculties.mmd) | docs/i18n/zh-CN/README.md | architecture | ✓ | done | |

### design/（docs/concepts/design/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [context-layer--runtime-layering](./design/context-layer--runtime-layering.mmd) | design/context-layer.md §3 | architecture | ✓ | done | fix: ① 补全 Tools/Skills→PostgreSQL 两条边（builtin |
| [context-layer--evolution-levers](./design/context-layer--evolution-levers.mmd) | design/context-layer.md §7 | architecture | ✓ | done | fix: (1) 状态机补终态 rejected（代码 STATUS_REJECTED 存 |
| [self-evolving--consolidation-loop](./design/self-evolving--consolidation-loop.mmd) | design/self-evolving-agents.md §7 |  | ✓ | done | fix: 1) 补码证负反馈闭环边：memory_retrieval_logs 的 irr |
| [self-evolving--four-layer-loop](./design/self-evolving--four-layer-loop.mmd) | design/self-evolving-agents.md §2 |  | ✓ | done | fix: 对照仓库代码修正三处：(1) 评测引擎删「Agent-as-a-Judge」（文 |
| [context-layer--auto-channel](./design/context-layer--auto-channel.mmd) | design/context-layer.md §5 | workflow | ✓ | done | fix: 1) 事实修正（以代码为准）：原图把 _collect_kg_context() |
| [context-layer--assembler-planner](./design/context-layer--assembler-planner.mmd) | design/context-layer.md §6 | workflow | ✓ | done | fix: 源 mermaid 块#4 本身与代码事实自洽（「既有」节点全部核对通过、「新增 |
| [context-layer--request-injection](./design/context-layer--request-injection.mmd) | design/context-layer.md §2 | workflow | ✓ | done | fix: 4 处以代码为准的修正（.mmd 携 %% fix 行、facts 笔记逐条锚点 |
| [0002-ui--phase-roadmap](./design/0002-ui--phase-roadmap.mmd) | design/0002-ui-interaction-enhancements.md | workflow | ✓ | done | fix: 以代码为准修正五处：(1) 原图把 4.1-4.6 六项全部画成 RFC 000 |
| [context-layer--collect-phase](./design/context-layer--collect-phase.mmd) | design/context-layer.md §1 | dataflow | ✓ | done | fix: ① 拓扑修正（%% fix 已记录于 .mmd）：原块把 Collect 三机制 |
| [qa-delivery--push-gate](./design/qa-delivery--push-gate.mmd) | design/qa-delivery-pipeline.md | workflow | ✓ | done | fix: 三处按代码修正：1) 原图 PRGate 子图只画「入口→reusable」两层 |
| [docker-release--pipeline](./design/docker-release--pipeline.mmd) | design/docker-release-pipeline.md | workflow | ✓ | done | fix: D-7 修正已核验并落入产物：workflow matrix 实际为 wiki← |
| [sso--auth-flow](./design/sso--auth-flow.mmd) | design/sso.md | sequence | ✓ | done | fix: validate 三轮收敛（18 err → 1 err → 0/0）：R1 修 |
| [browser-mcp--seed-migration](./design/browser-mcp--seed-migration.mmd) | design/browser-automation-mcp-integration.md | workflow | ✓ | done | fix: 源图 11 节点精简为 8（workflow v2 ≤8 预算）：三执行入口（R |
| [skills--management-ui](./design/skills--management-ui.mmd) | design/skills.md | workflow | ✓ | done | fix: (1) SkillFormDialog → SkillFormDrawer：实际 |

### operations/（docs/concepts/operations/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [development--workflow](./operations/development--workflow.mmd) | operations/development.md §3 | workflow | ✓ | done | fix: D-11：后端开发入口按真实流程用 uv run negentropy  |
| [docker-operations--compose-topology](./operations/docker-operations--compose-topology.mmd) | operations/docker-operations.md §1.1 | architecture | ✓ | done | fix: D-5/D-6 必改项均已落实并带 %% fix 行：(1) 移除幽灵边 |
| [docker-operations--troubleshooting](./operations/docker-operations--troubleshooting.mmd) | operations/docker-operations.md §6 | workflow | ✓ | done | fix: mmd 携带 3 条 %% fix：(1)「按启动顺序」实为 compo |
| [local-llm-ollama--setup-path](./operations/local-llm-ollama--setup-path.mmd) | operations/local-llm-ollama.md | workflow | ✓ | done | fix: 4 条 %% fix：(1) 原图云 Key 路径止于「对话」无对照终点 |

### subsystems/（docs/concepts/subsystems/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [025-memory--automation-gates](./subsystems/025-memory--automation-gates.mmd) | subsystems/025 §5 | workflow | ✓ | done | fix: 无需 %% fix: 修正（文档块与引用源码逐项核验一致：24h/5 会话阈值、 |
| [025-memory--session-summarizer](./subsystems/025-memory--session-summarizer.mmd) | subsystems/025 §5.4 | workflow | ✓ | done | fix: 两处 %% fix：(1) 源图「Session Summarizer」节点在代 |
| [025-memory--runner-sequence](./subsystems/025-memory--runner-sequence.mmd) | subsystems/025 §4 | sequence | ✓ | done | fix: 1) 事实修正（mmd 头部 %% fix: 三行 + notes）：简化路径由 |
| [025-memory--dedup-stages](./subsystems/025-memory--dedup-stages.mmd) | subsystems/025 §5.6 | workflow | ✓ | done | fix: mmd 头 %% fix 两项：(1) 补 Stage 3「判定无矛盾 → 通过 |
| [025-memory--hybrid-search-levels](./subsystems/025-memory--hybrid-search-levels.mmd) | subsystems/025 §6.1 | workflow | ✓ | done | fix: ①决策门「有 embedding_fn？」校正为「query 向量可用？」：代码 |
| [025-memory--forms-dimensions](./subsystems/025-memory--forms-dimensions.mmd) | subsystems/025 §1 | architecture | ✓ | done | fix: EX→FL 边标签由「instructions 表」改为「memories /  |
| [025-memory--dashboard-ui](./subsystems/025-memory--dashboard-ui.mmd) | subsystems/025 §3 | architecture | ✓ | done | fix: 五处文档-代码偏差校正（详见 .mmd %% fix 行与 .temp/arch |
| [025-memory--audit-api-sequence](./subsystems/025-memory--audit-api-sequence.mmd) | subsystems/025 §7.3 | sequence | ✓ | done | fix: 1) 幂等性检查从源图 MGS 自环改为 MGS→PostgreSQL 的 SE |
| [037-federated--cross-corpus-search](./subsystems/037-federated--cross-corpus-search.mmd) | subsystems/037 §4 | workflow | ✓ | done | fix: ① Stage 3 触发集合补 global_summary（hybrid_pl |
| [025-memory--lifecycle](./subsystems/025-memory--lifecycle.mmd) | subsystems/025 §2 | lifecycle | ✓ | done | fix: 无 %% fix: 行——代码核验未发现需改拓扑的文档-代码不一致（全部转换与  |
| [037-federated--kg-topology](./subsystems/037-federated--kg-topology.mmd) | subsystems/037 §3 | architecture | ✓ | done | fix: 1) KgRelation 原图是 Corpus-A 内孤立节点，实为 corp |
| [025-memory--retrieval-logging](./subsystems/025-memory--retrieval-logging.mmd) | subsystems/025 §6.5 | dataflow | ✓ | done | fix: 终点节点「调整 retention_score 权重」校正为「自进化调权」：代码 |
| [025-memory--control-plane](./subsystems/025-memory--control-plane.mmd) | subsystems/025 §8 | architecture | ✓ | done | fix: 4 处文档-代码不一致按当前实现修正（mmd 头 %% fix: 行）：1) p |
| [025-memory--telemetry-collection](./subsystems/025-memory--telemetry-collection.mmd) | subsystems/025 §11.4 | dataflow | ✓ | done | fix: 无内容级修正（faithful redraw，未加 %% fix 行）。结构性调 |

### user-guide/（docs/concepts/user-guide/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [chat-essentials--request-sequence](./user-guide/chat-essentials--request-sequence.mmd) | user-guide/chat-essentials | sequence | ✓ | done | fix: 原图 3 处失真已在 .mmd 头部以 %% fix: 标注并落图：(1 |
| [chat-essentials--agent-dispatch-sequence](./user-guide/chat-essentials--agent-dispatch-sequence.mmd) | user-guide/chat-essentials | sequence | ✓ | done | fix: 共 6 条 %% fix（已写入 .mmd 头部，均有代码行号佐证）：
 |
| [interface--plugin-system](./user-guide/interface--plugin-system.mmd) | user-guide/interface | architecture | ✓ | done | fix: 三处事实纠偏（均已写入 .mmd 的 %% fix: 行与 facts  |
| [interface--model-onboarding](./user-guide/interface--model-onboarding.mmd) | user-guide/interface | workflow | ✓ | done | fix: 依代码取证修正源图 4 处语义错位（均在 .mmd 以 %% fix:  |
| [knowledge-management--ingest-flow](./user-guide/knowledge-management--ingest-flow.mmd) | user-guide/knowledge-management | workflow | ✓ | done | fix: 对照代码核出原 Mermaid 三处失真，已写入 .mmd 的 %% f |
| [memory-automation--tasks-tab](./user-guide/memory-automation--tasks-tab.mmd) | user-guide/memory-automation | workflow | ✓ | done | fix: 三处修正（均已写入 .mmd 的 %% fix: 行）：(1) 结构性错 |
| [memory-basics--write-read](./user-guide/memory-basics--write-read.mmd) | user-guide/memory-basics | workflow | ✓ | done | fix: ①巩固管线步骤修正：原图 Segment→Dedup→Store→Ext |
| [papers-curation--sequence](./user-guide/papers-curation--sequence.mmd) | user-guide/papers-curation | sequence | ✓ | done | fix: 对照代码核出源图 4 处需修正/补全，已在 .mmd 头部以 %% fi |
| [quickstart--first-chat-sequence](./user-guide/quickstart--first-chat-sequence.mmd) | user-guide/quickstart | sequence | ✓ | done | fix: 共 8 条修正（全部写入 .mmd 头部 %% fix: 行，逐条证据见 |
| [transcript-view--studio-layout](./user-guide/transcript-view--studio-layout.mmd) | user-guide/transcript-view | workflow | ✓ | done |  |

### perceives/（docs/reference/perceives/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |

### wiki/（docs/reference/wiki/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |

### apps/（apps/*/ README 与管线文档）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |

### agents/（docs/.agents/ 巡检与决策文档）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |

### 原地保留（无 archify 对应类型 / 不在本管线）

| 位置 | 类型 | 说明 |
| :--- | :--- | :--- |
| 025-the-memory-system.md（ER / timeline） | erDiagram / timeline | 无对应类型 |
| 035-the-knowledge-base.md（ER） | erDiagram | 无对应类型 |
| 036-the-knowledge-graph.md（timeline） | timeline | 无对应类型 |
| 039-the-routine-system.md（ER） | erDiagram | 无对应类型 |
| conversation-foundation.md（象限图） | quadrantChart | 无对应类型 |
| docs/research/**（247 块） | 各类 | 第三方系统调研，不进本管线 |
| docs/reference/cognizes/**（96 块） | 各类 | 已退役项目遗产，不进本管线 |
| apps/negentropy-influence/episodes/**/planning.md（8 块） | flowchart | 分集内容分镜，非架构图 |
| apps/negentropy-wiki/content.fixture/**（1 块） | flowchart | 测试 fixture |
