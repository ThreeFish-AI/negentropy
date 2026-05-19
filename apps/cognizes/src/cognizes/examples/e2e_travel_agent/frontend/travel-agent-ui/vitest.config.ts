import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: false, // 忽略 CSS 文件
    deps: {
      // 处理第三方包的 CSS 导入
      inline: [/@copilotkit/],
    },
  },
});
