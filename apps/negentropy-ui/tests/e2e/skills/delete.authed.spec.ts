import { test, expect } from "@playwright/test";
import {
  applyDevCookie,
  UI_BASE,
  uniqueName,
  createSkillViaApi,
} from "./_authed-helpers";

test.describe("Skills 删除 — 实机后端", () => {
  test.beforeEach(async ({ context }) => {
    await applyDevCookie(context);
  });

  test("D-1 owner DELETE 后真实从列表消失", async ({ context }) => {
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-d1"),
      description: "delete me",
      category: "test",
      version: "1.0.0",
      config_schema: {},
      default_config: {},
      required_tools: [],
      is_enabled: true,
      priority: 0,
      visibility: "private",
    });

    const resp = await context.request.delete(`${UI_BASE}/api/interface/skills/${created.id}`);
    expect(resp.status()).toBe(204);

    const list = await context.request.get(`${UI_BASE}/api/interface/skills`);
    const ids = (await list.json()).map((s: { id: string }) => s.id);
    expect(ids).not.toContain(created.id);
  });

  test("D-2 重复 DELETE 同一 id 返回 403/404 之一（owner-check 优先）", async ({ context }) => {
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-d2"),
      description: "delete twice",
      category: "test",
      version: "1.0.0",
      config_schema: {},
      default_config: {},
      required_tools: [],
      is_enabled: true,
      priority: 0,
      visibility: "private",
    });
    const first = await context.request.delete(
      `${UI_BASE}/api/interface/skills/${created.id}`,
    );
    expect(first.status()).toBe(204);
    const second = await context.request.delete(
      `${UI_BASE}/api/interface/skills/${created.id}`,
    );
    expect([403, 404]).toContain(second.status());
  });
});
