# Negentropy UI

Negentropy 的主聊天前端（Next.js 16 / React 19 / Tailwind），经 [AG-UI 协议](https://github.com/ag-ui-protocol/ag-ui) 与后端 `NegentropyEngine`（端口 `3292`）交互。

> 本包是 [negentropy monorepo](../../README.md) 的工作区成员，请优先在仓库根目录操作。

## 启动

最简方式（仓库根目录，Docker 一键拉起全套）：

```bash
./dev            # 含 backend / wiki / perceives / postgres
```

仅前端开发（热重载，需后端已运行于 :3292）：

```bash
pnpm install     # 在仓库根目录（pnpm workspace 单一 store）
pnpm dev:ui      # → http://localhost:3192
```

## 关键信息

| 项 | 值 |
| :--- | :--- |
| 端口 | `3192` |
| 后端基址 | `AGUI_BASE_URL`（默认 `http://localhost:3292`） |
| 健康检查 | `GET /api/health` |
| 环境变量模板 | [.env.example](./.env.example) → 复制为 `.env.local` |

## 相关

- 根 [README](../../README.md) · [Development Guide](../../docs/concepts/development.md)
- 共享协议包：[`@negentropy/agents-chat-core`](../../packages/agents-chat-core)
- Wiki 前端：[`negentropy-wiki`](../negentropy-wiki)
