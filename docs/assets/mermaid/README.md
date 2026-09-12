# Mermaid 文本源索引（archify 图的唯一可编辑源）

> 本目录是现役系统文档全部 Mermaid 图的**集中文本源 SSOT**。每张图四件套：
> `docs/assets/mermaid/<分类>/<slug>.mmd`（本文本源）→
> [archify](../../.agents/doc-media-assets.md) 重绘 `docs/assets/architecture/<分类>/<slug>.html` →
> [`scripts/capture-arch-diagram.mjs`](../../../scripts/capture-arch-diagram.mjs) 采集
> `<slug>-dark.png` / `<slug>-light.png`（文档内嵌一律用暗色 PNG）。
>
> **范围**：仅现役系统文档（`docs/concepts/`、`docs/reference/{perceives,wiki,paper-notes}/` 与 `docs/reference/` 根级设计文档、根与 i18n README、
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
| [035-kb--search-functions](./subsystems/035-kb--search-functions.mmd) | subsystems/035 §3 | workflow | ✓ | done | fix: 三条 %% fix 已写入 .mmd 头部：(1) 文档 §6.1 模块 |
| [035-kb--ingestion-sequence](./subsystems/035-kb--ingestion-sequence.mmd) | subsystems/035 §5.1 | sequence | ✓ | done | fix: 5 条 %% fix 已写入 .mmd 头部：(1) 摄取入口已异步化— |
| [035-kb--retrieval-levels](./subsystems/035-kb--retrieval-levels.mmd) | subsystems/035 §6 | workflow | ✓ | done | fix: 1) 源图「L0 扇出 Semantic/Keyword/RRF 三路并 |
| [035-kb--multi-catalog](./subsystems/035-kb--multi-catalog.mmd) | subsystems/035 §15.4（设计态 ADR） | architecture | ✓ | done | fix: 设计态 ADR 如实标注（未实现） |
| [035-kb--catalog-page-ui](./subsystems/035-kb--catalog-page-ui.mmd) | subsystems/035 §13 | architecture | ✓ | done | fix: 未解诊断为 6 条纯标签几何冲突（3× composition/labe |
| [036-kg--perception-pipeline](./subsystems/036-kg--perception-pipeline.mmd) | subsystems/036 §2 | workflow | ✓ | done |  |
| [036-kg--api-layering](./subsystems/036-kg--api-layering.mmd) | subsystems/036 §4.2 | architecture | ✓ | done | fix: GRAG 状态修正（已落地端点补绘） |
| [036-kg--llm-extraction-sequence](./subsystems/036-kg--llm-extraction-sequence.mmd) | subsystems/036 §5 | sequence | ✓ | done |  |
| [036-kg--dual-write](./subsystems/036-kg--dual-write.mmd) | subsystems/036 §5.2 | workflow | ✓ | done | fix: 1) 源块「写 AGE Edge」/「读 AGE (优先)」与实现不符： |
| [036-kg--extraction-sequence](./subsystems/036-kg--extraction-sequence.mmd) | subsystems/036 §6 | sequence | ✓ | done | fix: .mmd 头部记录 5 条 %% fix（均为「源图 = §5.4 目标 |
| [036-kg--index-build](./subsystems/036-kg--index-build.mmd) | subsystems/036 §7 | dataflow | ✓ | done |  |
| [036-kg--retrieval-sequence](./subsystems/036-kg--retrieval-sequence.mmd) | subsystems/036 §8 | sequence | ✓ | done | fix: 两处文档-代码漂移已在 .mmd 头部以 %% fix 行记录（均不影响 |
| [036-kg--retrieval-lifecycle](./subsystems/036-kg--retrieval-lifecycle.mmd) | subsystems/036 §9 | lifecycle | ✓ | done |  |
| [036-kg--feedback-loop](./subsystems/036-kg--feedback-loop.mmd) | subsystems/036 §10 | dataflow | ✓ | done | fix: 根因不是「边穿节点」本身，而是 alert 与 feedback 被放在 |
| [036-kg--engine-integration](./subsystems/036-kg--engine-integration.mmd) | subsystems/036 §11 |  | ✓ | done | fix: 事实核验零修正：15 节点与 11 条边全部命中代码锚点（agent.p |
| [039-routine--architecture-overview](./subsystems/039-routine--architecture-overview.mmd) | subsystems/039 §2 | architecture | ✓ | done |  |
| [039-routine--iteration-lifecycle](./subsystems/039-routine--iteration-lifecycle.mmd) | subsystems/039 §4.1 | lifecycle | ✓ | done |  |
| [039-routine--decision-lifecycle](./subsystems/039-routine--decision-lifecycle.mmd) | subsystems/039 §4.2 | lifecycle | ✓ | done | fix: 1) 未解诊断（转移标签「评分写回」压盖 evaluating）：按建议 |
| [039-routine--inspector-heartbeat](./subsystems/039-routine--inspector-heartbeat.mmd) | subsystems/039 §5 | sequence | ✓ | done |  |
| [039-routine--orchestration-loop](./subsystems/039-routine--orchestration-loop.mmd) | subsystems/039 §6 | workflow | ✓ | done | fix: ① 工作分支名以代码为准：routine/&lt;sanitize(ke |
| [040-faculty--routine-bridge](./subsystems/040-faculty--routine-bridge.mmd) | subsystems/040 | architecture | ✓ | done | fix: 落地状态修正：FacultyBridge 真实调用已接 INJECT-2 |
| [041-transcript--full-view](./subsystems/041-transcript--full-view.mmd) | subsystems/041 | workflow | ✓ | done |  |

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
| [framework--five-layers](./perceives/framework--five-layers.mmd) | perceives/framework.md | architecture | ✓ | done | fix: 对照代码核出 3 处修正，已写入 .mmd 头部 %% fix: 行并在 |
| [framework--engine-registry](./perceives/framework--engine-registry.mmd) | perceives/framework.md | architecture | ✓ | done | fix: 三处修正（均附 %% fix: 行）：1) 原图 R 节点 "app · |
| [framework--mcp-tools](./perceives/framework--mcp-tools.mmd) | perceives/framework.md | architecture | ✓ | done | fix: D-12 事实修正（均已写入 .mmd %% fix: 行与图内 amb |
| [framework--degradation-fallback](./perceives/framework--degradation-fallback.mmd) | perceives/framework.md | workflow | ✓ | done | fix: ① 按代码真实引擎集绘制降级链：Docling → OpenDataLo |
| [framework--pdf-stages](./perceives/framework--pdf-stages.mmd) | perceives/framework.md | dataflow | ✓ | done | fix: 引擎清单补齐：S2/S3/S4 补 opendataloader（con |
| [framework--webpage-stages](./perceives/framework--webpage-stages.mmd) | perceives/framework.md | workflow | ✓ | done | fix: mmd 携 1 条 %% fix：S3 短路语义补正——anti_det |
| [framework--engine-matrix](./perceives/framework--engine-matrix.mmd) | perceives/framework.md | architecture | ✓ | done | fix: ① R1 f3（MinerU→Marker）竖边"降级"标签与 Mine |
| [framework--prescan-strategy](./perceives/framework--prescan-strategy.mmd) | perceives/framework.md | workflow | ✓ | done | fix: 事实修正（写入 mmd %% fix: 行并落图/卡片）：1) 计划引擎 |
| [framework--lifecycle-sequence](./perceives/framework--lifecycle-sequence.mmd) | perceives/framework.md | sequence | ✓ | done | fix: 1) 「指标记录 (_observability)」幽灵引用修正：too |
| [framework--request-flow](./perceives/framework--request-flow.mmd) | perceives/framework.md | workflow | ✓ | done | fix: 1) "Memory Cache" 实为引擎 worker 子进程内 _ |
| [development--test-pyramid](./perceives/development--test-pyramid.mmd) | perceives/development.md | architecture | ✓ | done | fix: 单元测试文件数 40+ → 100（apps/negentropy-pe |
| [development--tool-anatomy](./perceives/development--tool-anatomy.mmd) | perceives/development.md | architecture | ✓ | done | fix: 事实修正（已写入 .mmd 头部 %% fix: 行并在图中更正）：1) |
| [development--ci-flow](./perceives/development--ci-flow.mmd) | perceives/development.md | workflow | ✓ | done | fix: 对照 monorepo 根 .github/workflows/nege |
| [apple-silicon--engine-pipeline](./perceives/apple-silicon--engine-pipeline.mmd) | perceives/agents/apple-silicon-tuning.md | workflow | ✓ | done | fix: (1)「扫描版→Marker」修正为 quick_scan 画像 is_ |
| [apple-silicon--vlm-auto-engine](./perceives/apple-silicon--vlm-auto-engine.mmd) | perceives/agents/apple-silicon-tuning.md | workflow | ✓ | done | fix: ① 判定序按代码校正：源图 pref=auto? 先于 is_apple |
| [pdf-engine--selection-matrix](./perceives/pdf-engine--selection-matrix.mmd) | perceives/agents/pdf-engine-selection.md | architecture | ✓ | done | fix: 3 条 %% fix: ① reason 串实际带 profile: 前 |
| [pdf-engine--reflow-chain](./perceives/pdf-engine--reflow-chain.mmd) | perceives/agents/pdf-engine-selection.md | workflow | ✓ | done | fix: 事实修正（写入 .mmd %% fix: 行）：1) reason 前缀 |
| [pdf-engine--fast-path](./perceives/pdf-engine--fast-path.mmd) | perceives/agents/pdf-engine-selection.md | workflow | ✓ | done | fix: ① reason 实串带 profile: 前缀（profile:sim |
| [readme-zh--five-layers](./perceives/readme-zh--five-layers.mmd) | perceives/zh-CN/README.md | architecture | ✓ | done | fix: 4 处修正（均有代码证据）：1) SDK 双模式——mode="mcp" |

### wiki/（docs/reference/wiki/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [deployment--production-topology](./wiki/deployment--production-topology.mmd) | wiki/deployment.md | architecture | ✓ | done | fix: D-13 逐项核验并修正：(1) 生产出口改画 GitHub Pages |
| [deployment--local-build](./wiki/deployment--local-build.mmd) | wiki/deployment.md | workflow | ✓ | done | fix: 事实层零修正：8 节点/6 边全部对照 apps/negentropy/ |
| [kg--build-pipeline](./wiki/kg--build-pipeline.mmd) | wiki/design/knowledge-graph.md | workflow | ✓ | done | fix: 图体字节保持原样，修正以 5 条 %% fix 注释行随 .mmd 归档 |
| [ops--publish-flows](./wiki/ops--publish-flows.mmd) | wiki/ops.md | workflow | ✓ | done | fix: 源图 §2.1 为已作废的 SSG+ISR 架构，按仓库代码修正为现行纯 |
| [publishing--user-flow](./wiki/publishing--user-flow.mmd) | wiki/user-guide/publishing.md | workflow | ✓ | done | fix: 事实核验 6 节点/6 边全部与代码一致，无需语义修正（故 .mmd 未 |

### apps/（apps/*/ README 与管线文档）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [perceives-readme--five-layers](./apps/perceives-readme--five-layers.mmd) | apps/negentropy-perceives/README.md | architecture | ✓ | done | fix: Round 1 diagnostics: mcp→engines 自动路 |
| [influence--pipeline-layers](./apps/influence--pipeline-layers.mmd) | apps/negentropy-influence/pipeline/README.md | architecture | ✓ | done | fix: 事实修正 2 条（已写入 .mmd %% fix 行）：① 节点标签对齐 |
| [indextts--synthesis-flow](./apps/indextts--synthesis-flow.mmd) | apps/negentropy-influence/pipeline/INDEXTTS-2.5-ADVANCED.md | workflow | ✓ | done | fix: 零纠错。源图节点/边与本仓 pipeline/scripts 及上游 c |
| [indextts--reference-audio](./apps/indextts--reference-audio.mmd) | apps/negentropy-influence/pipeline/INDEXTTS-2.5-ADVANCED.md | workflow | ✓ | done | fix: 事实核验发现源图 2 处边级错误，交付图已按代码重绘（全部写入 .mmd |
| [voice-cloning--architecture](./apps/voice-cloning--architecture.mmd) | apps/negentropy-influence/pipeline/VOICE-CLONING.md | architecture | ✓ | done | fix: ①节点/边全量对照 pipeline/scripts 核验一致、零语义修 |

### agents/（docs/.agents/ 巡检与决策文档）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [patrol--doc-status-lifecycle](./agents/patrol--doc-status-lifecycle.mmd) | .agents/pdf-fidelity-patrol-status.md | lifecycle | ✓ | done | fix: ① 合格阈值默认已由 95 收紧至 99（PR #1080，config |
| [patrol--patrol-sequence](./agents/patrol--patrol-sequence.mmd) | .agents/pdf-fidelity-patrol-status.md | sequence | ✓ | done | fix: 见上 |
| [patrol--escalation-flow](./agents/patrol--escalation-flow.mmd) | .agents/pdf-fidelity-patrol-status.md | workflow | ✓ | done | fix: 三条 %% fix 随 .mmd 携带并落入图/cards：(1) 清  |
| [issue--session-stale-sequence](./agents/issue--session-stale-sequence.mmd) | .agents/issue.md（ISSUE-066 缩进块） | sequence | ✓ | done | fix: 1) 源图 SUS->>SUS 自环（POST /api/agui/se |
| [wiki-ordering--effective-rank](./agents/wiki-ordering--effective-rank.mmd) | .agents/wiki-docs-ordering.md | workflow | ✓ | done | fix: 源图与代码零偏差，无 %% fix: 行。重绘适配：① 5 泳道语义分组 |

### paper-notes/（docs/reference/paper-notes/ 与 reference 根级设计文档）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [horizon-context--collect-enrich-activate](./paper-notes/horizon-context--collect-enrich-activate.mmd) | paper-notes/horizon-context.md §2 | dataflow | ✓ | done | 三段流水线：三源并列汇入目录 → 显式/隐式双轨（冲突浮出人工裁决）→ 四因子排序 → 三类消费者 |
| [horizon-context--declaration-execution](./paper-notes/horizon-context--declaration-execution.mmd) | paper-notes/horizon-context.md §3 | workflow | ✓ | done | 声明相（五段式+结构校验门）→ 执行相（双层 RBAC + 策略 A 聚合）；workflow v2 重排为单行主链 |
| [context-layer-blueprint--architecture](./paper-notes/context-layer-blueprint--architecture.mmd) | context-layer-blueprint.md §1 | architecture | ✓ | done | 五正交层总体架构；重绘砍 2 条低值边（裁决/反馈环路由姊妹图与卡片承载） |
| [context-layer-blueprint--object-lifecycle](./paper-notes/context-layer-blueprint--object-lifecycle.mmd) | context-layer-blueprint.md §2 | lifecycle | ✓ | done | 对象生命周期状态机；3 泳道并为 2（冲突与终态合流）保垂直容纳 |

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
