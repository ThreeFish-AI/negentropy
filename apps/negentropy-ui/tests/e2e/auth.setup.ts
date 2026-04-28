import path from "node:path";
import { test as setup, expect } from "@playwright/test";

// 持久化路径：默认 apps/negentropy-ui/.auth/user.json，受 .gitignore 保护。
// 详见 docs/agents/browser-validation.md。
const STORAGE_STATE =
  process.env.PLAYWRIGHT_STORAGE_STATE ??
  path.resolve(__dirname, "../../.auth/user.json");

// 留给用户在 Google 同意屏中手动完成登录的时间上限（5 分钟）。
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

setup("通过 Google OAuth 登录并持久化会话", async ({ page }) => {
  await page.goto("/auth/google/login");

  // 用户在弹出的 Google 页面手动完成账号选择 / 二步验证后，浏览器会回跳到 baseURL。
  // 必须同时约束 host，避免在跳往 accounts.google.com 的瞬间被误判为"已离开 /auth/google"。
  await page.waitForURL(
    (url) =>
      (url.host.startsWith("127.0.0.1") || url.host.startsWith("localhost")) &&
      !url.pathname.startsWith("/auth/google"),
    { timeout: LOGIN_TIMEOUT_MS },
  );

  // 二次校验登录态：项目自带 /api/auth/me 应返回当前用户。
  const meResponse = await page.request.get("/api/auth/me");
  expect(meResponse.ok(), "/api/auth/me 应该在登录后返回 2xx").toBe(true);

  await page.context().storageState({ path: STORAGE_STATE });
});
