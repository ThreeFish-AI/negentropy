# Negentropy Wiki

Negentropy 的知识库发布站点（Next.js 16 / React 19），**纯静态导出**（`output: export`），
运行时无 Node 服务端、无后端、无数据库依赖，可由任意静态托管提供服务。

> 本包是 [negentropy monorepo](../../README.md) 的工作区成员，请优先在仓库根目录操作。

## 内容来源（纯静态）

站点内容来自仓库内的 [`content/`](./content/) 静态内容包（主站 publish 流程导出、
经 CI 自动提交）。构建期 `next build` 读取 `content/` 烘焙为静态 HTML，**不调用主站 API、
不读主站数据库**。详见 [`content/README.md`](./content/README.md)。

## 启动 / 开发

最简方式（仓库根目录，Docker 一键拉起全套，含 wiki 静态站点）：

```bash
./dev            # backend / ui / perceives / postgres + wiki
```

仅 wiki 开发（热重载，**零后端/DB 依赖**——读本地 `content/`）：

```bash
pnpm install             # 仓库根目录（pnpm workspace 单一 store）
pnpm dev:wiki            # → http://localhost:3092
```

构建纯静态产物 + Pagefind 搜索索引（`out/`）：

```bash
pnpm --filter negentropy-wiki build   # next build（export）+ postbuild pagefind
pnpm --filter negentropy-wiki start   # 用 `serve` 本地预览 out/（:3092）
```

独立部署验证（仅 wiki 容器，断网可用）：

```bash
docker compose -f docker-compose.wiki.yml up --build
```

## 关键信息

| 项 | 值 |
| :--- | :--- |
| 端口 | `3092`（容器内 `80`，静态托管） |
| 构建产物 | `out/`（纯静态 HTML + `out/pagefind/` 搜索索引） |
| 内容来源 | `content/`（CI 提交的静态内容包；非运行时 API） |
| 运行时依赖 | **无**（静态托管即可，零后端/DB） |
| Dockerfile | [`docker/wiki/Dockerfile`](../../docker/wiki/Dockerfile)（static-web-server 托管 `out/`） |

## 架构要点

- 数据访问层 `src/lib/wiki-api.ts` 导出 `wikiApi` 单例（类型 + 导航纯函数，client-safe）；
  实现为 `src/lib/content-source.ts` 的 `LocalContentClient`（读 `content/`，`server-only`）。
  两者接口一致，页面/generate 零耦合数据源细节。
- 内容刷新：主站 publish → `trigger_wiki_redeploy` 触发 CI 重新导出 `content/` 并提交 →
  push 触发 wiki 重建部署（无运行时 ISR）。
- 已移除（纯静态化）：Agent 对话、SSO 登录、评论、标注、阅读统计；搜索改 Pagefind，
  知识图谱改静态烘焙。

## 相关

- 根 [README](../../README.md) · [Wiki 运维指引](../../docs/reference/wiki/ops.md)
- 主聊天前端：[`negentropy-ui`](../negentropy-ui)
- 静态内容导出：[`apps/negentropy/scripts/export_wiki_content.py`](../negentropy/scripts/export_wiki_content.py)
