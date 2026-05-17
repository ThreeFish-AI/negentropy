import { defineConfig } from "tsup";

/**
 * agents-chat-core 构建配置。
 *
 * 设计要点：
 * - dual ESM + CJS：兼容 Next 15（wiki）与 Next 16（ui），以及未来 Node 端使用；
 * - target es2022：避免 import.meta 等较新语法在 Next 15 webpack 上炸；
 * - 子入口（protocol/client/parse/server）独立 chunk，便于 tree-shake；
 * - peerDependencies (@ag-ui/* / rxjs / zod) 不打入产物，由消费方提供单例。
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "protocol/index": "src/protocol/index.ts",
    "client/index": "src/client/index.ts",
    "parse/index": "src/parse/index.ts",
    "server/index": "src/server/index.ts",
  },
  format: ["esm", "cjs"],
  target: "es2022",
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  treeshake: true,
  external: [
    "@ag-ui/client",
    "@ag-ui/core",
    "@ag-ui/encoder",
    "rxjs",
    "zod",
  ],
});
