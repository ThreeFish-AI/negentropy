# Negentropy Wiki

Negentropy 的知识库前端（Next.js 16 / React 19），以 ISR/SSG 方式渲染后端发布的内容，并经 `WIKI_API_BASE`（端口 `3292`）拉取数据。

> 本包是 [negentropy monorepo](../../README.md) 的工作区成员，请优先在仓库根目录操作。

## 启动

最简方式（仓库根目录，Docker 一键拉起全套）：

```bash
./dev            # 含 backend / ui / perceives / postgres
```

仅前端开发（热重载，需后端已运行于 :3292）：

```bash
pnpm install     # 在仓库根目录（pnpm workspace 单一 store）
pnpm dev:wiki    # → http://localhost:3092
```

## 关键信息

| 项 | 值 |
| :--- | :--- |
| 端口 | `3092` |
| 内容 API 基址 | `WIKI_API_BASE`（默认 `http://localhost:3292`） |
| ISR revalidate | 后端发布后回调 `/api/revalidate`（未配置则退化为被动 ISR） |
| 环境变量模板 | 见 [.env.example](./.env.example)（若有）或根 README |

## 相关

- 根 [README](../../README.md) · [Development Guide](../../docs/concepts/development.md)
- 共享协议包：[`@negentropy/agents-chat-core`](../../packages/agents-chat-core)
- 主聊天前端：[`negentropy-ui`](../negentropy-ui)
