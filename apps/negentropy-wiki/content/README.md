# Wiki 静态内容包（`content/`）

本目录是 **negentropy-wiki 站点的唯一内容来源**。wiki 站点纯静态化后，不再在
运行时或构建时调用主站后端，而是直接读取本目录下的 JSON 文件，由 `next build`
烘焙为静态 HTML。

## 来源（Single Source of Truth）

本目录由 **主站 publish 流程导出、经 CI 自动提交**（方案 A）：

```
主站 UI「同步并发布」
  → 后端 WikiExportService 序列化已发布内容
  → CI workflow 运行 export_wiki_content.py 写入本目录
  → git bot 提交并 push → 触发 wiki 重建部署
```

> 当前仓库内为**开发种子 fixture**（手写，便于本地 `pnpm dev` / `next build` 验证）。
> CI 首次导出后会以同 schema 覆盖替换为真实内容。**请勿手改真实内容**——内容归
> 主站 Catalog 管理；此处仅由 CI 维护。

## Schema

顶层索引 + 扁平 entry 存储 + 按 publication 分目录：

```
content/
├── index.json                              顶层索引（slug/id/版本 + 倒排映射）
├── publications.json                       listPublications() → { items, total }
├── entries/[entryId].json                  getEntryContent() → WikiEntryContent
│                                           （entryId 为全局唯一 UUID，扁平存储）
└── publications/[pubSlug]/
    ├── publication.json                    getPublication() → WikiPublication
    ├── nav-tree.json                       getNavTree() → { publication_id, nav_tree:{items} }
    ├── entries-index.json                  getEntries() → { items, total } + slug_to_id 倒排
    └── graph.json                          getPublicationGraph() → WikiGraphResponse（可选）
```

字段形状与原主站 wiki API 响应**逐字段对齐**（导出端复用了路由层序列化逻辑，DRY），
故 `apps/negentropy-wiki/src/lib/content-source.ts`（`LocalContentClient`）可保持与
历史 HTTP 客户端完全一致的接口，所有页面零改动。
