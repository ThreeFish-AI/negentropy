import { test, expect } from "@playwright/test";
import {
  applyDevCookie,
  UI_BASE,
  uniqueName,
  createSkillViaApi,
  deleteSkillViaApi,
} from "./_authed-helpers";

test.describe("Skill enforcement — fail-close 行为实机", () => {
  test.beforeEach(async ({ context }) => {
    await applyDevCookie(context);
  });

  test("ENF-1 默认 enforcement_mode=warning（向后兼容）", async ({ context }) => {
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-enf-default"),
      description: "no enforcement passed",
      category: "test",
      version: "1.0.0",
      config_schema: {},
      default_config: {},
      required_tools: [],
      is_enabled: true,
      priority: 0,
      visibility: "private",
    });
    const resp = await context.request.get(
      `${UI_BASE}/api/interface/skills/${created.id}`,
    );
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.enforcement_mode).toBe("warning");
    await deleteSkillViaApi(context, created.id);
  });

  test("ENF-2 strict 创建后 missing_tools 在 invoke 响应里可见", async ({ context }) => {
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-enf-strict"),
      description: "strict + required tools",
      category: "test",
      version: "1.0.0",
      prompt_template: "ping",
      config_schema: {},
      default_config: {},
      required_tools: ["fetch_papers", "save_to_memory"],
      is_enabled: true,
      priority: 0,
      visibility: "private",
      enforcement_mode: "strict",
    });
    const resp = await context.request.post(
      `${UI_BASE}/api/interface/skills/${created.id}/invoke`,
      { data: { variables: {} } },
    );
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.missing_tools).toEqual(
      expect.arrayContaining(["fetch_papers", "save_to_memory"]),
    );
    await deleteSkillViaApi(context, created.id);
  });
});
