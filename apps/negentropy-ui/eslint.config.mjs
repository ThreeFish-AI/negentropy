import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/hooks/useSessionManager",
              message:
                "useSessionManager 已废弃。会话列表逻辑请改用 useSessionListService；会话详情、hydration 与 projection 逻辑请改用 useSessionService。",
            },
            {
              name: "@/hooks/useSessionManager.ts",
              message:
                "useSessionManager 已废弃。会话列表逻辑请改用 useSessionListService；会话详情、hydration 与 projection 逻辑请改用 useSessionService。",
            },
          ],
          patterns: [
            {
              group: ["**/hooks/useSessionManager", "**/hooks/useSessionManager.*"],
              message:
                "禁止新增对 legacy hook useSessionManager 的依赖。请迁移到 useSessionListService 或 useSessionService。",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated artifacts:
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".temp/**",
  ]),
]);

export default eslintConfig;
