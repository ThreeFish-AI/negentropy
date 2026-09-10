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

### operations/（docs/concepts/operations/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |

### subsystems/（docs/concepts/subsystems/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |

### user-guide/（docs/concepts/user-guide/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |

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
