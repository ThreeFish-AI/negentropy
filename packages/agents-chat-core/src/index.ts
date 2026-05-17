/**
 * @negentropy/agents-chat-core 顶层桶导出。
 *
 * 该包是 AGUI 协议层（types + schema + stream + ndjson-agent）与 Mention 解析的
 * 单一事实源（SSOT），供 apps/negentropy-ui（控制台）与 apps/negentropy-wiki
 * （知识发布站点）双端共用，避免协议层双写漂移（split-brain）。
 *
 * 推荐按子路径深度引用以最大化 tree-shake：
 *   - "@negentropy/agents-chat-core/protocol"  — AGUI 事件类型 / zod schema / NDJSON 流
 *   - "@negentropy/agents-chat-core/client"    — NdjsonHttpAgent（含 resume 重连）
 *   - "@negentropy/agents-chat-core/parse"     — Mention 纯函数解析
 *   - "@negentropy/agents-chat-core/server"    — BFF 端 state_delta 派生工具
 *
 * 详见 plan：
 * /Users/cm.huang/.claude/plans/system-instruction-you-are-working-hidden-knuth.md
 */
export * from "./protocol/index.js";
export * from "./client/index.js";
export * from "./parse/index.js";
export * from "./server/index.js";
