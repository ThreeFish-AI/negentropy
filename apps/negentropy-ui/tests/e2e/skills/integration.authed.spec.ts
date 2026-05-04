import { test, expect } from "@playwright/test";
import {
  applyDevCookie,
  UI_BASE,
  deleteSkillViaApi,
  listSkillsViaApi,
} from "./_authed-helpers";

test.describe("Skills 跨模块联动 — 实机", () => {
  test.beforeEach(async ({ context }) => {
    await applyDevCookie(context);
  });

  test("X-1 GET /api/interface/skills/templates 暴露 paper_hunter", async ({ context }) => {
    const resp = await context.request.get(`${UI_BASE}/api/interface/skills/templates`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    const tpl = (body as Array<{ template_id: string }>).find(
      (t) => t.template_id === "paper_hunter",
    );
    expect(tpl).toBeTruthy();
  });

  test("X-2 from-template 一键安装 paper_hunter，list 可见且 invoke 渲染成功", async ({ context }) => {
    const installed = await context.request.post(
      `${UI_BASE}/api/interface/skills/from-template`,
      { data: { template_id: "paper_hunter" } },
    );
    expect(installed.status()).toBe(201);
    const skill = await installed.json();
    try {
      expect(skill.required_tools).toContain("fetch_papers");
      expect(skill.enforcement_mode).toBe("strict");
      expect((skill.resources || []).length).toBeGreaterThanOrEqual(2);

      // list 可见
      const list = await listSkillsViaApi(context);
      expect(list.find((s) => s.id === skill.id)).toBeTruthy();

      // invoke 渲染（用 default_config 默认值）
      const invokeResp = await context.request.post(
        `${UI_BASE}/api/interface/skills/${skill.id}/invoke`,
        {
          data: {
            variables: {
              query: "ReAct agent",
              top_n: 3,
              days_back: 30,
              topic_tag: "ai-agent",
            },
          },
        },
      );
      expect(invokeResp.ok()).toBeTruthy();
      const inv = await invokeResp.json();
      expect(inv.rendered_prompt).toContain("ReAct agent");
      expect(inv.rendered_prompt).toContain("3");
      expect(inv.resources.length).toBeGreaterThan(0);
    } finally {
      await deleteSkillViaApi(context, skill.id);
    }
  });

  test("X-3 from-template 第二次同模板自动追加 owner_short 后缀避免重名", async ({ context }) => {
    const first = await context.request.post(
      `${UI_BASE}/api/interface/skills/from-template`,
      { data: { template_id: "paper_hunter" } },
    );
    const firstSkill = await first.json();
    const second = await context.request.post(
      `${UI_BASE}/api/interface/skills/from-template`,
      { data: { template_id: "paper_hunter" } },
    );
    const secondSkill = await second.json();
    try {
      expect(secondSkill.id).not.toBe(firstSkill.id);
      expect(secondSkill.name).not.toBe(firstSkill.name);
    } finally {
      await deleteSkillViaApi(context, firstSkill.id);
      await deleteSkillViaApi(context, secondSkill.id);
    }
  });

  test("X-4 from-template 模板不存在返回 404", async ({ context }) => {
    const resp = await context.request.post(
      `${UI_BASE}/api/interface/skills/from-template`,
      { data: { template_id: "non-existent-template" } },
    );
    expect(resp.status()).toBe(404);
  });
});
