/**
 * Dev cookie setup project — 注入自签 ne_sso 会话，适合 CI 与本地实机回归。
 *
 * 与 `auth.setup.ts` 互为兜底：
 * - `auth.setup.ts`：headless=false 真实 Google OAuth 登录，签出 storageState；用于本地首次接入 / 真用户灰度。
 * - `dev-cookie.setup.ts`：headless=true 自签 cookie 注入，无任何外部依赖；CI 默认走这条路径。
 *
 * 受 `PLAYWRIGHT_AUTH_MODE` 环境变量控制：
 *   PLAYWRIGHT_AUTH_MODE=dev-cookie pnpm test:e2e
 *
 * 严禁在生产环境执行；NE_AUTH_TOKEN_SECRET 仅本地 .env.local 持有，与后端 tokens.py 共享同一密钥。
 *
 * 协议参考：
 * - docs/agents/browser-validation.md（自签 cookie 三步自检）
 * - docs/issue.md ISSUE-035（Google OAuth 风控阻断 sandbox 浏览器）
 */
import path from "node:path";
import { test as setup, expect } from "@playwright/test";
import {
  buildPlaywrightStorageState,
} from "./utils/dev-cookie";

const STORAGE_STATE =
  process.env.PLAYWRIGHT_STORAGE_STATE ??
  path.resolve(__dirname, "../../.auth/dev-admin.json");

const COOKIE_DOMAIN = process.env.PLAYWRIGHT_COOKIE_DOMAIN ?? "127.0.0.1";

setup("通过自签 dev cookie 注入 admin 会话", async ({ page }) => {
  const secret = process.env.NE_AUTH_TOKEN_SECRET ?? "";
  if (!secret) {
    throw new Error(
      "NE_AUTH_TOKEN_SECRET 必须设置；可从 apps/negentropy/.env.local 读取或显式 export。",
    );
  }

  const { storageState, cookieValue } = buildPlaywrightStorageState({
    secret,
    cookieDomain: COOKIE_DOMAIN,
  });

  // 直接写 storageState 到磁盘，让后续 chromium-authenticated 复用。
  await page.context().addCookies(storageState.cookies);

  // 自检：访问 /api/auth/me 验证后端真的认这个 cookie（密钥一致性）。
  const meResponse = await page.request.get("/api/auth/me");
  expect(
    meResponse.ok(),
    `/api/auth/me 必须在注入 dev cookie 后返回 2xx；若 401 则后端 NE_AUTH_TOKEN_SECRET 与前端不一致。token 头部=${cookieValue.slice(0, 24)}...`,
  ).toBe(true);

  await page.context().storageState({ path: STORAGE_STATE });
});
