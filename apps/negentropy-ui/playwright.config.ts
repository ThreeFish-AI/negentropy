import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT || 3210);
const baseURL = `http://127.0.0.1:${port}`;
const reuseExistingServer =
  process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true";

// Browser-session reuse knobs — see ../../docs/agents/browser-validation.md
//
// AUTH_MODE 切换两种登录态注入方式（双 setup 共存）：
// - "google"（默认；headless=false）：跑 auth.setup.ts，需用户手动完成 Google 同意屏。
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
const setupTestMatch =
  AUTH_MODE === "dev-cookie" ? /dev-cookie\.setup\.ts$/ : /auth\.setup\.ts$/;
const setupHeadless = AUTH_MODE === "dev-cookie";

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
  projects: [...authProjects, ...baseProjects],
});
