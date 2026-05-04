/**
 * Skills authed spec 共享辅助：动态签 ne_sso cookie 并注入到 BrowserContext。
 *
 * 用法：
 *   import { applyDevCookie, UI_BASE } from "./_authed-helpers";
 *
 *   test.beforeEach(async ({ context }) => {
 *     await applyDevCookie(context);
 *   });
 *   test("...", async ({ page }) => { await page.goto(`${UI_BASE}/interface/skills`); });
 *
 * 设计：
 * - 不依赖 .auth/* storageState 文件，每次 fresh 签发，secret 漂移即时暴露；
 * - 复用现有 utils/dev-cookie.ts 的 HMAC-SHA256 签名实现；
 * - 默认 cookie 域 ``localhost``，与 ctl.sh 启动的 UI（http://localhost:3192）匹配。
 */
import type { BrowserContext } from "@playwright/test";
import { buildPlaywrightStorageState } from "../utils/dev-cookie";

export const UI_BASE = process.env.NEGENTROPY_UI_BASE_URL || "http://localhost:3192";

export const NE_AUTH_TOKEN_SECRET =
  process.env.NE_AUTH_TOKEN_SECRET ||
  "7165f888de198ac617208b33dfa85f752aface07a28153979655d602565881c9";

export async function applyDevCookie(
  context: BrowserContext,
  options: {
    sub?: string;
    email?: string;
    roles?: string[];
  } = {},
): Promise<void> {
  const { storageState } = buildPlaywrightStorageState({
    secret: NE_AUTH_TOKEN_SECRET,
    sub: options.sub,
    email: options.email,
    roles: options.roles,
    cookieDomain: "localhost",
    cookieSecure: false,
  });

  await context.addCookies(
    storageState.cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    })),
  );
}

export async function createSkillViaApi(
  context: BrowserContext,
  payload: Record<string, unknown>,
): Promise<{ id: string; name: string; display_name: string | null }> {
  const resp = await context.request.post(`${UI_BASE}/api/interface/skills`, {
    data: payload,
  });
  if (!resp.ok()) {
    throw new Error(`createSkillViaApi failed: ${resp.status()} ${await resp.text()}`);
  }
  const body = await resp.json();
  return { id: body.id, name: body.name, display_name: body.display_name };
}

export async function deleteSkillViaApi(context: BrowserContext, id: string): Promise<void> {
  await context.request.delete(`${UI_BASE}/api/interface/skills/${id}`);
}

export async function listSkillsViaApi(
  context: BrowserContext,
): Promise<Array<{ id: string; name: string }>> {
  const resp = await context.request.get(`${UI_BASE}/api/interface/skills`);
  if (!resp.ok()) {
    throw new Error(`listSkillsViaApi failed: ${resp.status()}`);
  }
  return resp.json();
}

/** 用 owner_short 自动后缀的 name 生成器，避免并发 spec 之间 name 冲突。 */
export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
