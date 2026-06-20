# Wiki 静态内容包（`content/`）

本目录是 **negentropy-wiki 站点的唯一内容来源**。wiki 站点纯静态化后，不再在
运行时或构建时调用主站后端，而是直接读取本目录下的 JSON 文件，由 `next build`
烘焙为静态 HTML。

## 来源与 git 策略（Single Source of Truth）

本目录由**主站 publish 流程导出**（`WikiExportService` / `export_wiki_content.py`
从主站 DB 序列化已发布内容）：

```
主站 UI「同步并发布」
  → 后端 WikiExportService 序列化已发布内容
  → export_wiki_content.py 写入本目录（content/）
  → next build 烘焙为静态 out/ → 部署
```

> **git 策略（重要）**：真实导出内容**环境相关、不入 git**——`.gitignore` 仅放行
> 开发种子 fixture（`negentropy-handbook` + `README.md` + 顶层 `index.json` /
> `publications.json` + 2 个固定 UUID entries），忽略所有真实导出物（随机 UUID entries、
> 其它 publication slug）。fixture 供本地 `pnpm build` / CI build-smoke 使用。
>
> 真实内容经「**导出 → 部署**」链路投递，有三条路径（详见
> [`docs/reference/wiki/deployment.md`](../../../docs/reference/wiki/deployment.md)）：
> - **本地直发远程**（不入 git）：`sync-wiki-content.sh` → `pnpm build` → `rsync out/` 到远程静态托管；
> - **本地开发刷新**：`./scripts/cli.sh restart`（内置导出 + 重建）；
> - **CI 自动**：publish webhook → `wiki-content-export.yml` 导出（bot 提交，非人工）。
>
> **请勿手改本目录的真实内容**——内容归主站 Catalog 管理。

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
