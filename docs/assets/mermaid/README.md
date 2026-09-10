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
- **不合格式**（wiki 渲染约束，判据见 [doc-media-assets](../.agents/doc-media-assets.md)）：
  进 wiki 的文档只用纯 markdown `![]()` 内嵌暗色 PNG；`<picture>` 双主题仅限根 / i18n README 与 `.agents`。

## 索引

> 各分类行由对应重绘波次登记；`产物` 列 ✓ = html + dark/light PNG 已入库。

### core/（framework 与总览）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [negentropy-architecture](./core/negentropy-architecture.mmd) | [framework.md §2.1](../../concepts/framework.md) | architecture | ✓ +svg/mp4/gif | 旗舰 | 11 源码深链；文本源自原 `<details>` 折叠块迁入 |

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
