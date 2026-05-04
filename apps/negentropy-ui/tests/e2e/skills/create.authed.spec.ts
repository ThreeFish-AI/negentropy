import { test, expect } from "@playwright/test";
import {
  applyDevCookie,
  UI_BASE,
  uniqueName,
  deleteSkillViaApi,
} from "./_authed-helpers";

test.describe("Skills 创建 — 实机后端", () => {
  test.beforeEach(async ({ context }) => {
    await applyDevCookie(context);
  });

  test("C-1 通过 BFF POST 创建 Skill 并能从 GET 列表查到", async ({ context }) => {
    const name = uniqueName("authed-c1");
    const resp = await context.request.post(`${UI_BASE}/api/interface/skills`, {
      data: {
        name,
        description: "authed create test",
        category: "test",
        version: "1.0.0",
        config_schema: {},
        default_config: {},
        required_tools: [],
        is_enabled: true,
        priority: 0,
        visibility: "private",
        enforcement_mode: "warning",
        resources: [],
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.name).toBe(name);
    expect(body.enforcement_mode).toBe("warning");
    expect(body.resources).toEqual([]);

    // verify it appears in list
    const list = await context.request.get(`${UI_BASE}/api/interface/skills`);
    const names = (await list.json()).map((s: { name: string }) => s.name);
    expect(names).toContain(name);

    await deleteSkillViaApi(context, body.id);
  });

  test("C-E1 重名后端返回 400 Skill name already exists", async ({ context }) => {
    const name = uniqueName("authed-dup");
    const first = await context.request.post(`${UI_BASE}/api/interface/skills`, {
      data: {
        name,
        description: "first",
        category: "test",
        version: "1.0.0",
        config_schema: {},
        default_config: {},
        required_tools: [],
        is_enabled: true,
        priority: 0,
        visibility: "private",
      },
    });
    expect(first.status()).toBe(201);
    const firstBody = await first.json();

    const second = await context.request.post(`${UI_BASE}/api/interface/skills`, {
      data: {
        name,
        description: "duplicate",
        category: "test",
        version: "1.0.0",
        config_schema: {},
        default_config: {},
        required_tools: [],
        is_enabled: true,
        priority: 0,
        visibility: "private",
      },
    });
    expect(second.status()).toBe(400);
    const detail = await second.json();
    expect(JSON.stringify(detail)).toContain("already exists");

    await deleteSkillViaApi(context, firstBody.id);
  });

  test("C-2 创建带 enforcement_mode=strict + resources 多项", async ({ context }) => {
    const name = uniqueName("authed-strict");
    const resp = await context.request.post(`${UI_BASE}/api/interface/skills`, {
      data: {
        name,
        description: "strict + resources",
        category: "test",
        version: "1.0.0",
        prompt_template: "use {{ tool }}",
        config_schema: {},
        default_config: {},
        required_tools: ["save_to_memory"],
        is_enabled: true,
        priority: 5,
        visibility: "private",
        enforcement_mode: "strict",
        resources: [
          { type: "url", ref: "https://example.com/a", title: "A" },
          { type: "kg_node", ref: "Topic/X", title: "X" },
        ],
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.enforcement_mode).toBe("strict");
    expect(body.resources).toHaveLength(2);
    await deleteSkillViaApi(context, body.id);
  });
});
