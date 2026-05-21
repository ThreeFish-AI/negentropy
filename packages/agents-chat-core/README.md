# @negentropy/agents-chat-core

> AGUI 协议层与 Mention 解析共享库 —— 一主五翼 6 Agents 对话协议 SSOT

## 目标

`apps/negentropy-ui`（全功能控制台）与 `apps/negentropy-wiki`（知识发布站点）
共用同一套 AGUI 协议契约（types / schema / NDJSON 流 / NdjsonHttpAgent /
mention 解析 / state_delta 派生），避免协议层双写漂移。

完整设计见
[计划文件](../../../.claude/plans/system-instruction-you-are-working-hidden-knuth.md)。

## 子入口

| 入口                                    | 来源（迁移自 ui）                               | 说明                                 |
| --------------------------------------- | ----------------------------------------------- | ------------------------------------ |
| `@negentropy/agents-chat-core/protocol` | `types/agui.ts` + `lib/agui/{schema,stream}.ts` | AGUI 事件类型 / zod 校验 / NDJSON 帧 |
| `@negentropy/agents-chat-core/client`   | `lib/agui/ndjson-agent.ts`                      | `NdjsonHttpAgent` + resume 重连      |
| `@negentropy/agents-chat-core/parse`    | `utils/mention-parser.ts` + `types/mention.ts`  | Mention 纯函数解析                   |
| `@negentropy/agents-chat-core/server`   | `app/api/agui/_state-delta.ts`                  | BFF 端 state_delta 派生              |

## 当前阶段

- **PR-1（本次）**：骨架占位，仅建立 workspace + 包结构，源码尚未迁移
- **PR-2**：迁移 ui 端 6 类源文件到本包，ui 内保留 re-export shim
- **PR-3**：wiki 端 BFF + ChatWidget 注入
- **PR-4**：ui 端 codemod 删除 shim

## 协议契约要点

- `@ag-ui/client` / `@ag-ui/core` / `rxjs` / `zod` 通过根 `pnpm-workspace.yaml`
  的 `catalog:` 锁定单一版本，列于 `peerDependencies`，避免双实例化
- 构建 target `es2022`，兼容 Next 15（wiki）与 Next 16（ui）
- dual ESM/CJS 产物，`tsup` 构建
