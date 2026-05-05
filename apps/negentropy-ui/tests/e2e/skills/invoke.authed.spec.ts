import { test, expect } from "@playwright/test";
import {
  applyDevCookie,
  UI_BASE,
  uniqueName,
  createSkillViaApi,
  deleteSkillViaApi,
} from "./_authed-helpers";

test.describe("Skill invoke — Layer 2 按需展开实机端到端", () => {
  test.beforeEach(async ({ context }) => {
    await applyDevCookie(context);
  });

  test("INV-1 invoke 渲染 Jinja2 变量并附带资源摘要", async ({ context }) => {
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-inv"),
      description: "invoke-test",
      category: "test",
      version: "1.0.0",
      prompt_template: "Hello {{ user }}, top_n={{ n }}",
      config_schema: {},
      default_config: { user: "world", n: 1 },
      required_tools: ["fetch_papers"],
      is_enabled: true,
      priority: 0,
      visibility: "private",
      resources: [{ type: "url", ref: "https://example.com", title: "Example" }],
    });

    const resp = await context.request.post(
      `${UI_BASE}/api/interface/skills/${created.id}/invoke`,
      { data: { variables: { user: "Alice", n: 7 } } },
    );
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.rendered_prompt).toContain("Hello Alice");
    expect(body.rendered_prompt).toContain("top_n=7");
    expect(body.resources).toHaveLength(1);
    expect(body.missing_tools).toContain("fetch_papers");

    await deleteSkillViaApi(context, created.id);
  });

  test("INV-2 disabled Skill invoke 返回 409", async ({ context }) => {
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-inv-disabled"),
      description: "disabled",
      category: "test",
      version: "1.0.0",
      prompt_template: "noop",
      config_schema: {},
      default_config: {},
      required_tools: [],
      is_enabled: false,
      priority: 0,
      visibility: "private",
    });
    const resp = await context.request.post(
      `${UI_BASE}/api/interface/skills/${created.id}/invoke`,
      { data: { variables: {} } },
    );
    expect(resp.status()).toBe(409);
    await deleteSkillViaApi(context, created.id);
  });

  test("INV-3 invoke 不存在的 skill_id 返回 404 / 403（plugin-access 守门）", async ({ context }) => {
    const fakeId = "00000000-0000-4000-8000-000000000000";
    const resp = await context.request.post(
      `${UI_BASE}/api/interface/skills/${fakeId}/invoke`,
      { data: { variables: {} } },
    );
    expect([403, 404]).toContain(resp.status());
  });
});
