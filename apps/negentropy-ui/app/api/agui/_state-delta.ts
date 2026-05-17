/**
 * AGUI BFF state_delta re-export shim（PR-2 过渡期）。
 *
 * 真实实现已迁入共享包 @negentropy/agents-chat-core/server。
 * 保留 Next.js App Router 私有模块 `./_state-delta` 路径以确保 ui 端
 * 零破坏迁移；后续 PR-4 将通过 codemod 批量改写后删除此文件。
 *
 * 注意：本文件位于 `app/api/agui/` 下，是 Next.js 路由的 `_` 前缀私有模块，
 * 由同目录 `route.ts` 通过 `./_state-delta` 引用；shim 只改变模块内部实现，
 * 路由约束不受影响。
 */
export * from "@negentropy/agents-chat-core/server";
