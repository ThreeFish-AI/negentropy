import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT || 3210);
const baseURL = `http://127.0.0.1:${port}`;
const reuseExistingServer =
  process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true";

// Browser-session reuse knobs — see ../../docs/agents/browser-validation.md
const STORAGE_STATE =
  process.env.PLAYWRIGHT_STORAGE_STATE ??
  path.resolve(__dirname, ".auth/user.json");
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

const authProjects = AUTH_ENABLED
  ? [
      {
        name: "setup",
        testMatch: /.*\.setup\.ts$/,
        use: {
          ...devices["Desktop Chrome"],
          headless: false,
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
