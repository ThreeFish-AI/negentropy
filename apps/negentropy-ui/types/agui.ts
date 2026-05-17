/**
 * AGUI 协议层 re-export shim（PR-2 过渡期）。
 *
 * 真实实现已迁入共享包 @negentropy/agents-chat-core/protocol。
 * 本 shim 保留旧 `@/types/agui` 导入路径以确保 ui 端零破坏迁移；
 * 后续 PR-4 将通过 codemod 批量改写为直接引用共享包后删除此文件。
 *
 * 详见 plan：
 * /Users/cm.huang/.claude/plans/system-instruction-you-are-working-hidden-knuth.md
 */
export * from "@negentropy/agents-chat-core/protocol";
