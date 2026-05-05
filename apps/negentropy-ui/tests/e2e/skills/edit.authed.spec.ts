import { test, expect } from "@playwright/test";
import {
  applyDevCookie,
  UI_BASE,
  uniqueName,
  createSkillViaApi,
  deleteSkillViaApi,
} from "./_authed-helpers";

test.describe("Skills 编辑 — 实机后端", () => {
  test.beforeEach(async ({ context }) => {
    await applyDevCookie(context);
  });

  test("U-1 PATCH enforcement_mode warning → strict 持久化", async ({ context }) => {
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-u1"),
      description: "edit enforcement",
      category: "test",
      version: "1.0.0",
      config_schema: {},
      default_config: {},
      required_tools: [],
      is_enabled: true,
      priority: 0,
      visibility: "private",
    });

    const resp = await context.request.patch(`${UI_BASE}/api/interface/skills/${created.id}`, {
      data: { enforcement_mode: "strict" },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.enforcement_mode).toBe("strict");

    await deleteSkillViaApi(context, created.id);
  });

  test("U-2 PATCH 非法 enforcement_mode 返回 400", async ({ context }) => {
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-u2"),
      description: "edit invalid enforcement",
      category: "test",
      version: "1.0.0",
      config_schema: {},
      default_config: {},
      required_tools: [],
      is_enabled: true,
      priority: 0,
      visibility: "private",
    });
    const resp = await context.request.patch(`${UI_BASE}/api/interface/skills/${created.id}`, {
      data: { enforcement_mode: "panic" },
    });
    expect(resp.status()).toBe(400);
    await deleteSkillViaApi(context, created.id);
  });

  test("U-3 PATCH 替换 resources 数组（新增 / 删除）", async ({ context }) => {
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-u3"),
      description: "edit resources",
      category: "test",
      version: "1.0.0",
      config_schema: {},
      default_config: {},
      required_tools: [],
      is_enabled: true,
      priority: 0,
      visibility: "private",
      resources: [{ type: "url", ref: "https://a", title: "A" }],
    });

    const resp = await context.request.patch(`${UI_BASE}/api/interface/skills/${created.id}`, {
      data: {
        resources: [
          { type: "corpus", ref: "papers", title: "Papers" },
          { type: "kg_node", ref: "Topic/X", title: "X" },
        ],
      },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.resources).toHaveLength(2);
    expect(body.resources[0].type).toBe("corpus");

    await deleteSkillViaApi(context, created.id);
  });
});
