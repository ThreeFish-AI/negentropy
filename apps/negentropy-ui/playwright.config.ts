import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT || 3210);
const baseURL = `http://127.0.0.1:${port}`;
const reuseExistingServer =
  process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true";

// Browser-session reuse knobs — see ../../docs/agents/browser-validation.md
//
// 协议边界（Browser Validation Protocol §3 / §4）：
// 本配置仅服务两类 B 类隔离场景：
//   ① E2E `setup` project：在用户启动的有头 Chromium 内由**真人**一次性手动完成
//      Google OAuth，随后 `storageState` 落到 .auth/user.json 复用；
//   ② 本地自签 `ne_sso` dev-cookie 注入（dev-cookie.setup.ts / chromium-devcookie），
//      不接触 Google OAuth。
// **禁止**用本套 Playwright 实例驱动 Google OAuth / SSO 自动登录跳转——所有依赖
// 登录态的 AI Agent 即时验证一律走 mcp__chrome_devtools__* 接入用户常用 Chrome
// 主 profile 与真实登录用户（详见 ../../docs/agents/browser-validation.md §3-§5）。
//
// AUTH_MODE 切换两种登录态注入方式（双 setup 共存）：
// - "google"（默认；headless=false）：跑 auth.setup.ts，由真人在浏览器内手动完成 Google 同意屏。
// - "dev-cookie"（headless=true）：跑 dev-cookie.setup.ts，自签注入 ne_sso cookie，CI 友好。
const AUTH_MODE = (process.env.PLAYWRIGHT_AUTH_MODE ?? "google") as
  | "google"
  | "dev-cookie";
const DEFAULT_STORAGE_STATE_FILE =
  AUTH_MODE === "dev-cookie" ? ".auth/dev-admin.json" : ".auth/user.json";
const STORAGE_STATE =
  process.env.PLAYWRIGHT_STORAGE_STATE ??
  path.resolve(__dirname, DEFAULT_STORAGE_STATE_FILE);
const USER_DATA_DIR = process.env.PLAYWRIGHT_USER_DATA_DIR;
const AUTH_ENABLED = process.env.PLAYWRIGHT_AUTH === "1";

const userDataLaunchOptions = USER_DATA_DIR
  ? { launchOptions: { args: [`--user-data-dir=${USER_DATA_DIR}`] } }
  : {};

const baseProjects = [
  {
    name: "chromium",
    testIgnore: [/.*\.setup\.ts$/, /.*\.authed\.spec\.ts$/],
    use: { ...devices["Desktop Chrome"] },
  },
];

// AUTH_MODE 决定 setup project 的入口文件，避免两条路径在同一次运行中冲突。
// - "google"：跑 auth.setup.ts，需手动完成 OAuth 同意屏（headless=false）。
// - "dev-cookie"：跑 dev-cookie.setup.ts，自签 ne_sso 注入 storageState（headless=true，CI 友好）。
const setupTestMatch =
  AUTH_MODE === "dev-cookie" ? /dev-cookie\.setup\.ts$/ : /auth\.setup\.ts$/;
const setupHeadless = AUTH_MODE === "dev-cookie";

// chromium-devcookie：authed spec 专用 project，**不依赖 OAuth setup**，与上面的
// authProjects 正交。spec 通过 utils/dev-cookie.ts 现签 ne_sso 并 addCookies 到上下文，
// 直接 hit ctl.sh 启动的真实 backend + UI（默认 http://localhost:3192）。
//
// **CI 默认禁用**：authed spec 需要外部 backend + PostgreSQL；CI smoke job 仅启
// Playwright webServer (pnpm build && pnpm start)，没有 backend，因此默认跳过。
// 显式开启：导出 ``PLAYWRIGHT_DEVCOOKIE=1``（约定）或 ``NE_AUTH_TOKEN_SECRET``
// （隐含意图：你已经有合法 secret → 通常意味着本地完整栈已起）。
const NEGENTROPY_UI_BASE_URL =
  process.env.NEGENTROPY_UI_BASE_URL || "http://localhost:3192";
const DEVCOOKIE_ENABLED =
  process.env.PLAYWRIGHT_DEVCOOKIE === "1" ||
  Boolean(process.env.NE_AUTH_TOKEN_SECRET);

const devCookieProjects = DEVCOOKIE_ENABLED
  ? [
      {
        name: "chromium-devcookie",
        testMatch: /.*\.authed\.spec\.ts$/,
        use: {
          ...devices["Desktop Chrome"],
          baseURL: NEGENTROPY_UI_BASE_URL,
        },
      },
    ]
  : [];

const authProjects = AUTH_ENABLED
  ? [
      {
        name: "setup",
        testMatch: setupTestMatch,
        use: {
          ...devices["Desktop Chrome"],
          headless: setupHeadless,
          ...userDataLaunchOptions,
        },
      },
      {
        name: "chromium-authenticated",
        dependencies: ["setup"],
        testMatch: /.*\.authed\.spec\.ts$/,
        use: {
          ...devices["Desktop Chrome"],
          storageState: STORAGE_STATE,
          ...userDataLaunchOptions,
        },
      },
    ]
  : [];

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  fullyParallel: true,
  snapshotPathTemplate:
    "{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.15 },
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm build && pnpm start",
    url: baseURL,
    reuseExistingServer,
    gracefulShutdown: {
      signal: "SIGTERM",
      timeout: 5_000,
    },
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    },
    timeout: 180_000,
  },
  projects: [...authProjects, ...devCookieProjects, ...baseProjects],
});
