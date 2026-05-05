import { test, expect } from "@playwright/test";
import { applyDevCookie, UI_BASE, deleteSkillViaApi } from "./_authed-helpers";

test.describe("Paper Hunter v0.2 — 引文图模板实机", () => {
  test.beforeEach(async ({ context }) => {
    await applyDevCookie(context);
  });

  test("V2-1 templates 列表同时含 paper_hunter 与 paper_hunter_v02", async ({ context }) => {
    const resp = await context.request.get(`${UI_BASE}/api/interface/skills/templates`);
    expect(resp.ok()).toBeTruthy();
    const data: Array<{ template_id: string; version: string }> = await resp.json();
    const ids = data.map((t) => t.template_id);
    expect(ids).toEqual(expect.arrayContaining(["paper_hunter", "paper_hunter_v02"]));
    const v02 = data.find((t) => t.template_id === "paper_hunter_v02");
    expect(v02?.version).toBe("0.2.0");
  });

  test("V2-2 安装 paper_hunter_v02 → required_tools 含 fetch_paper_citations + invoke 渲染含 Step 3", async ({
    context,
  }) => {
    const installed = await context.request.post(
      `${UI_BASE}/api/interface/skills/from-template`,
      { data: { template_id: "paper_hunter_v02" } },
    );
    expect(installed.status()).toBe(201);
    const skill = await installed.json();
    try {
      expect(skill.required_tools).toEqual(
        expect.arrayContaining([
          "fetch_papers",
          "fetch_paper_citations",
          "save_to_memory",
          "update_knowledge_graph",
        ]),
      );
      expect(skill.enforcement_mode).toBe("strict");

      const invokeResp = await context.request.post(
        `${UI_BASE}/api/interface/skills/${skill.id}/invoke`,
        {
          data: {
            variables: {
              query: "Reflexion agent",
              top_n: 2,
              days_back: 30,
              topic_tag: "ai-agent",
              citation_top_n: 3,
            },
          },
        },
      );
      expect(invokeResp.ok()).toBeTruthy();
      const inv = await invokeResp.json();
      expect(inv.rendered_prompt).toContain("Reflexion agent");
      // Phase 3 v0.2 prompt 必须包含引文步骤
      expect(inv.rendered_prompt).toContain("fetch_paper_citations");
      expect(inv.rendered_prompt).toContain("Step 3");
      // Resources 数量 ≥ 4（含 S2 API docs URL）
      expect(inv.resources.length).toBeGreaterThanOrEqual(4);
    } finally {
      await deleteSkillViaApi(context, skill.id);
    }
  });

  test("V2-3 paper_hunter v0.1 与 v0.2 在同 owner 名下能共存", async ({ context }) => {
    const v1 = await context.request.post(
      `${UI_BASE}/api/interface/skills/from-template`,
      { data: { template_id: "paper_hunter" } },
    );
    const v2 = await context.request.post(
      `${UI_BASE}/api/interface/skills/from-template`,
      { data: { template_id: "paper_hunter_v02" } },
    );
    const v1Skill = await v1.json();
    const v2Skill = await v2.json();
    try {
      expect(v1Skill.id).not.toBe(v2Skill.id);
      expect(v1Skill.name).toContain("ai-agent-paper-hunter");
      expect(v2Skill.name).toContain("ai-agent-paper-hunter-v2");
    } finally {
      await deleteSkillViaApi(context, v1Skill.id);
      await deleteSkillViaApi(context, v2Skill.id);
    }
  });
});
