import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * agents-chat-core 单测配置。
 *
 * 主要由 ui 端的 92 个测试文件作为事实回归（通过 shim 透明覆盖），
 * 本包仅维护少量 smoke 用例验证：
 *   - 模块导出契约（确保 shim 重导出的符号齐全）
 *   - 关键运行时（zod schema / state-delta 派生）
 *
 * 完整功能性单测在 PR-4 codemod 阶段会从 ui 端整体迁移过来。
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@negentropy/agents-chat-core/protocol": resolve(__dirname, "src/protocol/index.ts"),
      "@negentropy/agents-chat-core/client": resolve(__dirname, "src/client/index.ts"),
      "@negentropy/agents-chat-core/parse": resolve(__dirname, "src/parse/index.ts"),
      "@negentropy/agents-chat-core/server": resolve(__dirname, "src/server/index.ts"),
      "@negentropy/agents-chat-core": resolve(__dirname, "src/index.ts"),
    },
  },
});
