import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

// eslint-config-next@16.x 仅提供 flat config 形态；legacy .eslintrc.json
// 借由 ESLINT_USE_FLAT_CONFIG=false 加载会触发 "Converting circular structure
// to JSON" 错误。本配置等价迁移自原 .eslintrc.json 的 next/core-web-vitals
// 扩展，保留范围不扩张以避免引入额外规则集。
const eslintConfig = defineConfig([
  ...nextVitals,
  {
    // react-hooks@6（随 next 16.x / React 19）新增 4 条规则，原 legacy
    // eslintrc + next/core-web-vitals 加载的是旧版插件未启用这些检查。
    // 为遵循最小干预（不在 CI 修复 PR 内顺手重构 14 处遗留 hook 用法），
    // 暂以 warning 形态保留信号，待专项 PR 清理后再升级为 error。
    rules: {
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([
    // eslint-config-next 默认忽略项（flat config 下需显式声明）
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 项目级生成产物 / 临时目录
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".temp/**",
  ]),
]);

export default eslintConfig;
