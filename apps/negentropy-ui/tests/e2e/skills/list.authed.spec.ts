import { test, expect } from "@playwright/test";
import {
  applyDevCookie,
  UI_BASE,
  listSkillsViaApi,
  createSkillViaApi,
  deleteSkillViaApi,
  uniqueName,
} from "./_authed-helpers";

test.describe("Skills 列表 — 实机后端", () => {
  test.beforeEach(async ({ context }) => {
    await applyDevCookie(context);
  });

  test("L-1 /interface/skills 主页能渲染（dev cookie 注入后）", async ({ page }) => {
    await page.goto(`${UI_BASE}/interface/skills`);
    await expect(page.locator("h1", { hasText: "Skills" })).toBeVisible();
    // From Template / Add Skill 两个主入口必须出现
    await expect(page.getByTestId("skills-from-template")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Skill" })).toBeVisible();
  });

  test("L-2 后端真实数据驱动卡片网格（创建后该 Skill 出现）", async ({ page, context }) => {
    // 用唯一名字创建一个 Skill，确保 spec 间隔离（fullyParallel 模式下其他 spec 也在动 DB）。
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-l2"),
      description: "list-grid-probe",
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
      await page.goto(`${UI_BASE}/interface/skills`);
      await expect(page.getByTestId("skills-grid")).toBeVisible();
      // 卡片应包含我们刚创建的 display_name | name
      const expected = created.display_name || created.name;
      await expect(page.getByText(expected, { exact: false })).toBeVisible({
        timeout: 5_000,
      });
      // 同时回查 list API 一致（防 UI 漏渲染）
      const list = await listSkillsViaApi(context);
      expect(list.find((s) => s.id === created.id)).toBeTruthy();
    } finally {
      await deleteSkillViaApi(context, created.id);
    }
  });

  test("L-E1 dev cookie 失效（错误 secret）→ /api/interface/skills 401", async ({ context }) => {
    // 清掉合法 cookie 注入伪造 cookie
    await context.clearCookies();
    await context.addCookies([
      {
        name: "ne_sso",
        value: "eyJzb21lIjogImJyb2tlbiJ9.invalidsignature",
        domain: "localhost",
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 3600,
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    const resp = await context.request.get(`${UI_BASE}/api/interface/skills`);
    expect([401, 403]).toContain(resp.status());
  });

  test("L-E2 /api/interface/skills/templates 实机端点至少包含 paper_hunter", async ({ context }) => {
    const resp = await context.request.get(`${UI_BASE}/api/interface/skills/templates`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    const ids = (body as Array<{ template_id: string }>).map((t) => t.template_id);
    expect(ids).toContain("paper_hunter");
  });
});
