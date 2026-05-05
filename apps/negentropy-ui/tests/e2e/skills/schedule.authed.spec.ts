import { test, expect } from "@playwright/test";
import {
  applyDevCookie,
  UI_BASE,
  uniqueName,
  createSkillViaApi,
  deleteSkillViaApi,
} from "./_authed-helpers";

test.describe("Skills 定时调度 — Phase 3 实机", () => {
  test.beforeEach(async ({ context }) => {
    await applyDevCookie(context);
  });

  test("S-1 创建 schedule + GET 列表 + 手动 Run + 删除", async ({ context }) => {
    const skill = await createSkillViaApi(context, {
      name: uniqueName("authed-s1"),
      description: "schedule create+run+delete",
      category: "test",
      version: "1.0.0",
      prompt_template: "ping {{ q }}",
      config_schema: {},
      default_config: { q: "init" },
      required_tools: [],
      is_enabled: true,
      priority: 0,
      visibility: "private",
    });
    try {
      // 创建 schedule（很久之后才会触发，避免 tick 抢跑）
      const create = await context.request.post(
        `${UI_BASE}/api/interface/skills/${skill.id}/schedules`,
        {
          data: {
            cron_expr: "0 9 * * 1",
            enabled: true,
            vars: { q: "scheduled" },
          },
        },
      );
      expect(create.status()).toBe(201);
      const body = await create.json();
      expect(body.cron_expr).toBe("0 9 * * 1");
      expect(body.next_run_at).toBeTruthy();
      const scheduleId: string = body.id;

      // 列表
      const list = await context.request.get(
        `${UI_BASE}/api/interface/skills/${skill.id}/schedules`,
      );
      const items: Array<{ id: string }> = await list.json();
      expect(items.find((s) => s.id === scheduleId)).toBeTruthy();

      // 手动 Run（tick 等不及，直接触发）
      const run = await context.request.post(
        `${UI_BASE}/api/interface/skills/${skill.id}/schedules/${scheduleId}/run`,
      );
      expect(run.ok()).toBeTruthy();
      const ranBody = await run.json();
      expect(ranBody.last_run_at).toBeTruthy();

      // Delete
      const del = await context.request.delete(
        `${UI_BASE}/api/interface/skills/${skill.id}/schedules/${scheduleId}`,
      );
      expect(del.status()).toBe(204);
    } finally {
      await deleteSkillViaApi(context, skill.id);
    }
  });

  test("S-2 非法 cron_expr 返回 400", async ({ context }) => {
    const skill = await createSkillViaApi(context, {
      name: uniqueName("authed-s2"),
      description: "bad cron",
      category: "test",
      version: "1.0.0",
      config_schema: {},
      default_config: {},
      required_tools: [],
      is_enabled: true,
      priority: 0,
      visibility: "private",
    });
    try {
      const resp = await context.request.post(
        `${UI_BASE}/api/interface/skills/${skill.id}/schedules`,
        { data: { cron_expr: "not-a-cron" } },
      );
      expect(resp.status()).toBe(400);
    } finally {
      await deleteSkillViaApi(context, skill.id);
    }
  });
});
