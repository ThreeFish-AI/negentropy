import { test, expect } from "@playwright/test";
import {
  applyDevCookie,
  UI_BASE,
  uniqueName,
  createSkillViaApi,
  deleteSkillViaApi,
} from "./_authed-helpers";

test.describe("Skills 权限 — 实机 RBAC", () => {
  test("A-1 admin sub 可见所有 Skill（owner-A 创建后 admin 仍能 GET）", async ({
    browser,
  }) => {
    // owner A: 普通 user 角色
    const ownerCtx = await browser.newContext();
    await applyDevCookie(ownerCtx, {
      sub: "google:owner-a",
      email: "owner-a@example.com",
      roles: ["user"],
    });
    const created = await createSkillViaApi(ownerCtx, {
      name: uniqueName("authed-rbac"),
      description: "owner-a private",
      category: "test",
      version: "1.0.0",
      config_schema: {},
      default_config: {},
      required_tools: [],
      is_enabled: true,
      priority: 0,
      visibility: "private",
    });

    // admin: 应该能看到（plugin_common admin 优先）
    const adminCtx = await browser.newContext();
    await applyDevCookie(adminCtx, {
      sub: "google:dev-admin",
      email: "dev-admin@example.com",
      roles: ["admin"],
    });
    const resp = await adminCtx.request.get(
      `${UI_BASE}/api/interface/skills/${created.id}`,
    );
    expect(resp.ok()).toBeTruthy();

    // 清理
    await deleteSkillViaApi(adminCtx, created.id);
    await ownerCtx.close();
    await adminCtx.close();
  });

  test("A-E1 secret 漂移导致整模块 401", async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.addCookies([
      {
        name: "ne_sso",
        value: "tampered.payload.signature",
        domain: "localhost",
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 3600,
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    const resp = await ctx.request.get(`${UI_BASE}/api/interface/skills`);
    expect([401, 403]).toContain(resp.status());
    await ctx.close();
  });
});
