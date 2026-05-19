/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NEXT_PUBLIC_API_BASE_URL": JSON.stringify(""),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      vitest: path.resolve(__dirname, "node_modules/vitest"),
      "@testing-library/react": path.resolve(
        __dirname,
        "node_modules/@testing-library/react",
      ),
      "@testing-library/user-event": path.resolve(
        __dirname,
        "node_modules/@testing-library/user-event",
      ),
      swr: path.resolve(__dirname, "node_modules/swr"),
      "next-themes": path.resolve(__dirname, "node_modules/next-themes"),
      "@faker-js/faker": path.resolve(
        __dirname,
        "node_modules/@faker-js/faker",
      ),
      msw: path.resolve(__dirname, "node_modules/msw"),
    },
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./test/setup.ts",
    include: [
      "../tests/ui/unit/**/*.{test,spec}.{ts,tsx}",
      "../tests/ui/integration/**/*.{test,spec}.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      vitest: path.resolve(__dirname, "node_modules/vitest"),
      "@testing-library/react": path.resolve(
        __dirname,
        "node_modules/@testing-library/react",
      ),
      "@testing-library/user-event": path.resolve(
        __dirname,
        "node_modules/@testing-library/user-event",
      ),
      swr: path.resolve(__dirname, "node_modules/swr"),
      "next-themes": path.resolve(__dirname, "node_modules/next-themes"),
      "@faker-js/faker": path.resolve(
        __dirname,
        "node_modules/@faker-js/faker",
      ),
      msw: path.resolve(__dirname, "node_modules/msw"),
    },
  },
});
