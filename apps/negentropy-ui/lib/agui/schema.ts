/**
 * AGUI 协议层 re-export shim（PR-2 过渡期）。
 *
 * 真实实现已迁入共享包 @negentropy/agents-chat-core/protocol。
 * 保留旧 `@/lib/agui/schema` 导入路径以确保 ui 端零破坏迁移；
 * 后续 PR-4 将通过 codemod 批量改写后删除此文件。
 */
export * from "@negentropy/agents-chat-core/protocol";
