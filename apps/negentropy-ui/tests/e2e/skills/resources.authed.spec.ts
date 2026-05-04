import { test, expect } from "@playwright/test";
import {
  applyDevCookie,
  UI_BASE,
  uniqueName,
  createSkillViaApi,
  deleteSkillViaApi,
} from "./_authed-helpers";

test.describe("Skill resources — Layer 3 资源挂载实机", () => {
  test.beforeEach(async ({ context }) => {
    await applyDevCookie(context);
  });

  test("RES-1 创建带 5 类资源 → GET 完整回读", async ({ context }) => {
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-res"),
      description: "resources roundtrip",
      category: "test",
      version: "1.0.0",
      config_schema: {},
      default_config: {},
      required_tools: [],
      is_enabled: true,
      priority: 0,
      visibility: "private",
      resources: [
        { type: "url", ref: "https://x.com/a", title: "A" },
        { type: "kg_node", ref: "Topic/Skills", title: "S" },
        { type: "memory", ref: "00000000-0000-0000-0000-000000000000", title: "M" },
        { type: "corpus", ref: "papers", title: "P" },
        { type: "inline", ref: "literal-text", title: "I" },
      ],
    });
    const resp = await context.request.get(
      `${UI_BASE}/api/interface/skills/${created.id}`,
    );
    const body = await resp.json();
    expect(body.resources).toHaveLength(5);
    const types = body.resources.map((r: { type: string }) => r.type);
    expect(new Set(types)).toEqual(new Set(["url", "kg_node", "memory", "corpus", "inline"]));

    await deleteSkillViaApi(context, created.id);
  });

  test("RES-2 invoke 内 lazy=true 资源在响应里全部出现", async ({ context }) => {
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-res-invoke"),
      description: "invoke lazy resources",
      category: "test",
      version: "1.0.0",
      prompt_template: "look up {{ q }}",
      config_schema: {},
      default_config: { q: "X" },
      required_tools: [],
      is_enabled: true,
      priority: 0,
      visibility: "private",
      resources: [
        { type: "url", ref: "https://x.com/a", title: "A", lazy: true },
        { type: "url", ref: "https://x.com/b", title: "B", lazy: true },
      ],
    });
    const resp = await context.request.post(
      `${UI_BASE}/api/interface/skills/${created.id}/invoke`,
      { data: { variables: { q: "tau" } } },
    );
    const body = await resp.json();
    expect(body.rendered_prompt).toContain("look up tau");
    expect(body.resources).toHaveLength(2);
    await deleteSkillViaApi(context, created.id);
  });
});
