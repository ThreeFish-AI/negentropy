# Wiki 静态内容包 —— 开发种子 fixture（`content.fixture/`）

本目录是 **negentropy-wiki 的开发种子 fixture**（手写，固定 `negentropy-handbook`
publication），用于**全新 clone / CI build-smoke 的构建兜底**——保证在没有真实导出内容时
`next build` / `pnpm dev` 也能产出可用站点。

## 内容根二元结构与 git 策略（Single Source of Truth）

wiki 纯静态化后，站点内容来自「内容根目录」下的静态内容包；`content-source.ts` 按
三级优先解析内容根：

| 目录 | 角色 | git |
| --- | --- | --- |
| `content/` | **真实导出落点**（`sync-wiki-content.sh` / CI 写入，覆盖式 `_reset`） | **整体 gitignored**（环境相关，不入 git） |
| `content.fixture/`（本目录） | **开发种子 fixture**（构建兜底） | **入 git** |
| `WIKI_CONTENT_DIR` | 显式覆盖（单测 / 自定义部署） | — |

> **解析优先级**（见 `content-source.ts` 的 `resolveContentDir`）：
> `WIKI_CONTENT_DIR` > `content/`（存在 `index.json` 时）> `content.fixture/`。
> 即：有真实导出用真实，否则回退本 fixture。二者**物理隔离**——导出工具的覆盖式
> `_reset` 只动 `content/`，绝不波及本 fixture。

真实内容由**主站 publish 流程导出**（`WikiExportService` / `export_wiki_content.py`
从主站 DB 序列化已发布内容），经「**导出 → 重建**」链路投递，三条路径（详见
[`docs/reference/wiki/deployment.md`](../../../docs/reference/wiki/deployment.md)）：

- **本地直发远程**（不入 git）：`sync-wiki-content.sh` → `pnpm build` → `rsync out/` 到远程静态托管；
- **本地开发刷新**：`./scripts/cli.sh restart`（内置导出 + 重建）；
- **CI 自动**：publish webhook → `wiki-content-export.yml` 导出（bot 提交，非人工）。

> **请勿手改 `content/` 的真实内容**——内容归主站 Catalog 管理。本 fixture 仅作兜底种子。

## Schema

顶层索引 + 扁平 entry 存储 + 按 publication 分目录（`content/` 与 `content.fixture/` 同构）：

```
<内容根>/
├── index.json                              顶层索引（slug/id/版本 + 倒排映射）
├── publications.json                       listPublications() → { items, total }
├── entries/[entryId].json                  getEntryContent() → WikiEntryContent
│                                           （entryId 为全局唯一 UUID，扁平存储）
├── assets/[docId]/[file]                   烘焙的图片字节（仅 bake_assets=true 导出时产出，
│                                           markdown 图片引用为 /assets/{docId}/{file}）
└── publications/[pubSlug]/
    ├── publication.json                    getPublication() → WikiPublication
    ├── nav-tree.json                       getNavTree() → { publication_id, nav_tree:{items} }
    ├── entries-index.json                  getEntries() → { items, total } + slug_to_id 倒排
    └── graph.json                          getPublicationGraph() → WikiGraphResponse（可选）
```

字段形状与原主站 wiki API 响应**逐字段对齐**（导出端复用了路由层序列化逻辑，DRY），
故 `apps/negentropy-wiki/src/lib/content-source.ts`（`LocalContentClient`）可保持与
历史 HTTP 客户端完全一致的接口，所有页面零改动。
