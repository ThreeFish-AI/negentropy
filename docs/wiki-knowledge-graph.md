# Wiki 知识图谱（按 Publication 切片发布）

## 概述

将后端 [`negentropy`](../apps/negentropy) Knowledge 模块构造的知识图谱（KG）按 **Wiki Publication 维度**切片，发布到 [`negentropy-wiki`](../apps/negentropy-wiki) SSG 站点，让用户在 Wiki 浏览文档的同时，能查看这些文档所涉及的实体与关系。

### 核心约束（与设计取向）

| 约束 | 含义 | 落地策略 |
|---|---|---|
| **Wiki 无状态** | Wiki 端不引入数据库 / 缓存层 / 文件持久化 | 所有切片在后端 SQL 中完成；Wiki 仅 HTTP 拉取 |
| **Wiki 静态部署** | 仍是 Next.js SSG + ISR，不引入 SSR 复杂数据流 | 服务端 fetch 注入到客户端组件 props；Sigma WebGL 通过 `dynamic({ ssr: false })` 懒加载 |
| **最小干预** | 不破坏现有 Markdown 发布流水线 | 全部为追加（4 个新 endpoint、1 个新路由、1 个新组件） |
| **单一事实源** | 反查逻辑收敛在后端 | Wiki 端不做二次过滤 |

## 数据流（与现有 Markdown 发布完全同构）

```mermaid
flowchart LR
  subgraph Backend["后端 Knowledge API"]
    direction TB
    pub[wiki_publications]
    entries[wiki_publication_entries]
    docs[knowledge_documents]
    mentions[kg_entity_mentions]
    ents[kg_entities]
    rels[kg_relations]

    pub --> entries
    entries -->|document_id| docs
    docs -->|document_id| mentions
    mentions -->|entity_id| ents
    ents -->|src/tgt| rels
  end

  subgraph WikiSSG["Wiki SSG (Next.js)"]
    direction TB
    page["[pubSlug]/graph/page.tsx"]
    api["wiki-api.ts<br/>getPublicationGraph"]
    canvas["WikiGraphCanvas<br/>(Sigma + ForceAtlas2)"]
    revalidate["/api/revalidate<br/>(HMAC webhook)"]

    page -->|SSR fetch| api
    api -->|hydrate| canvas
  end

  Backend -.->|GET /knowledge/wiki/publications/{pub_id}/graph| api
  Backend -.->|POST publish webhook| revalidate
  revalidate -.->|revalidatePath| page

  classDef be fill:#1e3a5f,stroke:#3b82f6,color:#dbeafe
  classDef wk fill:#3a1e5f,stroke:#a855f7,color:#f3e8ff
  class pub,entries,docs,mentions,ents,rels be
  class page,api,canvas,revalidate wk
```

## Publication 维度切片算法

**节点反查路径**（单次 SQL CTE）：

```sql
-- 1. 反查文档集合
SELECT document_id
FROM wiki_publication_entries
WHERE publication_id = :pub_id
  AND entry_kind = 'DOCUMENT';

-- 2. 反查实体集合（DISTINCT）
SELECT DISTINCT m.entity_id
FROM kg_entity_mentions m
WHERE m.document_id IN (:document_ids);

-- 3. 加载节点（按 importance 排序，可截断）
SELECT * FROM kg_entities
WHERE id IN (:entity_ids) AND is_active = TRUE
ORDER BY importance_score DESC NULLS LAST, mention_count DESC
LIMIT :max_nodes;

-- 4. 加载边（两端都在节点集合内，剔除悬挂边）
SELECT * FROM kg_relations
WHERE source_id IN (:kept_node_ids)
  AND target_id IN (:kept_node_ids)
  AND is_active = TRUE;
```

**关键不变量**：source/target 都在节点集合内的边才保留 —— 截断 / 过滤后**不出现悬挂边**。

### 跨 corpus publication 处理

阶段一（首版）按 `corpus_id` 各自保留，节点 `metadata.corpus_id` 标注，**不做** canonical 合并。与 `routes/graph.py` 单 corpus 语义一致，最小化首版改动面。

阶段二（可选）通过 `kg_entity_canonical` + `kg_entity_alias` 折叠跨 corpus 同名实体，借 `kg_cross_corpus_bridge` 增加跨域边。

## API 契约

### `GET /knowledge/wiki/publications/{pub_id}/graph`

整图切片。仅 `status='published'` 的 publication 暴露。

**查询参数**：
- `max_nodes`：1–1000，默认 300
- `min_importance`：≥0，默认 0
- `include_isolated`：默认 false（剔除无边孤立节点）

**响应**（`WikiGraphResponse`）：
```json
{
  "publication_id": "uuid",
  "version": 3,
  "status": "ok | no_kg | empty",
  "nodes": [
    {
      "id": "ent-1",
      "label": "Negentropy",
      "type": "concept",
      "importance": 0.85,
      "community_id": 2,
      "entry_slugs": ["intro", "design"],
      "mention_count_in_pub": 12,
      "metadata": { "corpus_id": "...", "confidence": 0.95 }
    }
  ],
  "edges": [
    { "source": "ent-1", "target": "ent-2", "label": "RELATED_TO", "type": "RELATED_TO", "weight": 1.0, "metadata": { } }
  ],
  "truncated": false,
  "total_entities": 256,
  "corpus_ids": ["..."]
}
```

**ETag / Cache-Control**：`"{pub_id}:{version}"` + `max-age=300`，与 SSG ISR 5 分钟窗口一致。

### `GET /knowledge/wiki/publications/{pub_id}/graph/entities`

实体扁平列表（分页）。供未来"实体面板/搜索"使用。

### `GET /knowledge/wiki/publications/{pub_id}/graph/entities/{entity_id}`

实体详情：基本信息 + 邻居（仅 publication 节点集合内）+ 提及该实体的 Wiki entries。

### `GET /knowledge/wiki/entries/{entry_id}/graph`

单 entry 局部图：该文档涉及的实体 + 1 跳邻居。响应附 `center_entity_ids` 供前端高亮。

### 错误码

| Code | HTTP | 说明 |
|---|---|---|
| `WIKI_PUB_NOT_FOUND` | 404 | publication 不存在 |
| `WIKI_PUB_NOT_PUBLISHED` | 403 | publication 状态非 published（draft / archived） |
| `WIKI_GRAPH_ENTITY_NOT_FOUND` | 404 | 实体不在 publication 节点集合内 |
| `WIKI_ENTRY_NOT_FOUND` | 404 | entry 不存在或非 DOCUMENT 类型 |

## Wiki 站点改动

### 新增

| 文件 | 职责 |
|---|---|
| [`apps/negentropy-wiki/src/app/[pubSlug]/graph/page.tsx`](../apps/negentropy-wiki/src/app/[pubSlug]/graph/page.tsx) | SSG 入口，服务端 fetch + 状态分支 |
| [`apps/negentropy-wiki/src/components/WikiGraphCanvas.tsx`](../apps/negentropy-wiki/src/components/WikiGraphCanvas.tsx) | 客户端 Sigma WebGL 渲染（dynamic 懒加载） |
| [`apps/negentropy-wiki/src/lib/wiki-graph-types.ts`](../apps/negentropy-wiki/src/lib/wiki-graph-types.ts) | 类型声明（与 `wiki-api.ts` 解耦） |

### 修改

- [`wiki-api.ts`](../apps/negentropy-wiki/src/lib/wiki-api.ts)：追加 4 个 graph 方法（不修改既有签名）
- [`WikiHeader.tsx`](../apps/negentropy-wiki/src/components/WikiHeader.tsx)：tabs 末尾新增"知识图谱"入口，`entries_count > 0` 时显示
- [`api/revalidate/route.ts`](../apps/negentropy-wiki/src/app/api/revalidate/route.ts)：追加 `/{pubSlug}/graph` 路径与 `wiki-graph:${pubSlug}` tag 的 revalidate
- [`package.json`](../apps/negentropy-wiki/package.json)：新增 `sigma` / `graphology` / `graphology-layout-forceatlas2`（与主站版本对齐）

## 与主站 Graph 组件的关系（复用策略）

主站 [`apps/negentropy-ui/app/knowledge/graph/_components/SigmaGraphCanvas.tsx`](../apps/negentropy-ui/app/knowledge/graph/_components/SigmaGraphCanvas.tsx) 是双击展开 / 增量加载 / 实体面板的全能交互组件。

Wiki 场景定位于"**只读浏览 + 点击跳转**"。我们**精简重做**（约 150 行 vs 主站 297 行）：

- ✅ 拷贝：`buildGraph` / `nodeSize` / `nodeColor` / ForceAtlas2 配置（真正的复用价值）
- ❌ 剥离：增量加载（`fetchGraphSubgraph`）、双击展开、实体面板状态
- ➕ 新增：节点点击 → `router.push(/${pubSlug}/${node.entry_slugs[0]})` 跳转到首个相关文档

颜色常量（实体类型 + 社区色）独立拷贝到 Wiki 组件内，避免跨工程依赖。

## 性能与降级

- **典型规模**：50–200 文档 × 平均 30 mentions → 去重后 200–800 实体，JSON < 500 KB
- **截断策略**：
  - ≤ 500 节点：完整返回
  - 500–1000 节点：按 `importance_score DESC` 截断，附 `truncated=true`
- **客户端 bundle**：Sigma 组件 `"use client"` 自动切分进 graph 路由独立 chunk，非图谱页面零体积影响
- **大图自动降级**：节点数 > 500 时 `page.tsx` 自动从 [`WikiGraphCanvas`](../apps/negentropy-wiki/src/components/WikiGraphCanvas.tsx)（Sigma WebGL）切换到 [`WikiForceGraphCanvas`](../apps/negentropy-wiki/src/components/WikiForceGraphCanvas.tsx)（react-force-graph-2d / Canvas 2D + d3-force-3d），避免 WebGL 在大图初始化卡顿与低端设备 OOM；两个组件交互模型一致（节点点击 → `router.push(entry_slugs[0])`）
- **空 KG 兜底**：API 返回 `status='no_kg'`，前端展示"该发布暂未构建知识图谱"
- **未发布**：API 返回 403，Wiki 首页/入口不会出现该 publication

## 验证方案

### 后端

- **集成测试** [`tests/integration_tests/knowledge/test_wiki_graph_service.py`](../apps/negentropy/tests/integration_tests/knowledge/test_wiki_graph_service.py)：
  - 空 publication → `status='empty'`
  - 单文档 / 多文档切片正确
  - 悬挂边过滤
  - `max_nodes` 截断
  - 实体详情邻居范围限定在 publication 内
  - 单 entry 局部图

### Wiki

- **单元测试** [`tests/lib/wiki-api-graph.test.ts`](../apps/negentropy-wiki/tests/lib/wiki-api-graph.test.ts)：API 客户端方法的查询参数序列化、ISR 选项透传、错误透传

### 浏览器实机回归

按 [浏览器验证协议](./agents/browser-validation.md) 接入用户常用 Chrome 主 profile：

1. 现有 `/`、`/[pubSlug]`、`/[pubSlug]/[...entrySlug]` 不受影响
2. `/[pubSlug]/graph` SSG 首屏可见节点、无客户端等待
3. Sigma 可交互（拖拽 / 缩放 / 点击）
4. 节点点击 → 跳转到 `/[pubSlug]/{entry_slug}`
5. 后端 publish → Wiki 图谱通过 webhook 立即刷新
6. 未构建 KG / 空 publication 友好空态
7. 截断边界（≥ max_nodes）显示橙色提示横幅

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 跨 corpus 同名实体未合并造成视觉重复 | 节点 `metadata.corpus_id` 着色；阶段二走 canonical 合并 |
| 大 publication SQL 反查慢 | 已有 `ix_kg_mentions_document`；硬上限 1000 节点 |
| Sigma WebGL bundle 膨胀首屏 | `dynamic({ ssr: false })` 懒加载，独立 chunk |
| 节点点击跳转失败（entry_slug 漂移） | `entry_slugs[]` 反查与 nav-tree 同 SSOT；缺失则不跳转 |
| ISR webhook 失败导致图谱滞后 | 5 分钟 ISR 兜底（复用既有 fail-safe 链路） |
